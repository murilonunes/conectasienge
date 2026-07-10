import { NextRequest, NextResponse } from "next/server";
import { guardPermission } from "@/lib/app-users";
import { findSupplierQuoteIntegration, findSupplierQuoteIntegrationByKey, recordSupplierQuoteEvent } from "@/lib/supplier-quote-portal";

export const dynamic = "force-dynamic";

type QuotationAction = "create" | "attach-items" | "add-supplier" | "add-item" | "send-negotiation";

type PurchaseRequestPayload = {
  purchaseRequestId: number;
  items: Array<{
    purchaseRequestId: number;
    purchaseRequestItemNumber: number;
    deliveryRequirementNumber: number;
  }>;
};

type QuotationItemInsertPayload = {
  buildingId?: number;
  productId?: number;
  detailId?: number;
  trademarkId?: number;
  quantity?: number;
  unitySymbol?: string;
  notes?: string;
  deliveryRequirements?: Array<{
    requirementDate: string;
    requirementQuantity: number;
  }>;
  buildingsApropriations?: Array<{
    buildingUnitId?: number;
    costEstimationItemReference?: string;
    percentage?: number;
  }>;
};

type NegotiationItemInput = {
  quotationItemNumber: number;
  quotedQuantity?: number;
  negotiatedQuantity?: number;
  unitPrice?: number;
  selected?: boolean;
  supplierNotes?: string;
};

type NegotiationInput = {
  negotiationNumber?: number;
  supplierAnswerDate?: string;
  validity?: string;
  seller?: string;
  discount?: number;
  freightType?: "NONE" | "INCLUDED" | "PAID";
  freightPrice?: number;
  internalNotes?: string;
  supplierNotes?: string;
  paymentTerms?: Array<{
    description?: string;
    selected?: boolean;
    paymentTerms: Array<{ numberOfdays: number; percentage: number }>;
  }>;
  items?: NegotiationItemInput[];
  authorize?: boolean;
  responseId?: number;
};

type QuotationCreateRequest = {
  action?: QuotationAction;
  buyerId?: string;
  date?: string;
  confirm?: boolean;
  dryRun?: boolean;
  purchaseQuotationId?: number;
  purchaseQuotationItemNumber?: number;
  supplierId?: number;
  request?: PurchaseRequestPayload;
  item?: QuotationItemInsertPayload;
  negotiation?: NegotiationInput;
  force?: boolean;
};

type SiengePostResult =
  | {
      ok: true;
      endpoint: string;
      status: number;
      location: string | null;
      body: unknown;
    }
  | {
      ok: false;
      endpoint: string;
      status: number;
      apiMessage: unknown;
    };

type SiengePreflight = {
  action: QuotationAction;
  checkedAt: string;
  quotation?: SiengeLookupSummary;
  supplier?: SiengeLookupSummary & { supplierInfo?: Record<string, unknown> };
  latestNegotiationNumber?: number;
  hints: string[];
  // Sinalizações estruturadas usadas nos bloqueios de duplicidade (os hints são
  // apenas texto para leitura humana e podem mudar sem quebrar a lógica).
  existing: {
    itemNumbers: number[];
    productId: boolean;
    supplierOnItem: boolean;
  };
};

type SiengeLookupSummary = {
  endpoint: string;
  ok: boolean;
  status: number;
  exists: boolean;
  body?: unknown;
  apiMessage?: unknown;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function parseIdFromLocation(location: string | null) {
  if (!location) return undefined;
  const match = location.match(/purchase-quotations\/(\d+)/i) || location.match(/\/(\d+)$/);
  return match ? Number(match[1]) : undefined;
}

// Diferente de parseIdFromLocation: para negociações o location termina em
// .../purchase-quotations/{quotationId}/suppliers/{supplierId}/negotiations/{negotiationNumber},
// então é preciso pegar o último segmento, não o primeiro número (que seria o id da cotação).
function parseTrailingIdFromLocation(location: string | null) {
  if (!location) return undefined;
  const match = location.match(/\/(\d+)\/?$/);
  return match ? Number(match[1]) : undefined;
}

function siengeConfig() {
  const tenant = process.env.SIENGE_TENANT;
  const username = process.env.SIENGE_USERNAME;
  const password = process.env.SIENGE_PASSWORD;
  if (!tenant || !username || !password) {
    return {
      error: "Credenciais do Sienge não configuradas. Preencha SIENGE_TENANT, SIENGE_USERNAME e SIENGE_PASSWORD."
    };
  }
  return { tenant, username, password };
}

function authHeaders(username: string, password: string) {
  return {
    Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
    Accept: "application/json",
    "Content-Type": "application/json"
  };
}

async function parseSiengeResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (response.status === 204 || response.headers.get("content-length") === "0") return undefined;
  if (contentType.includes("json")) {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }
  const text = await response.text();
  return text || undefined;
}

function itemPayloads(request?: PurchaseRequestPayload, purchaseQuotationId?: number) {
  return (request?.items || [])
    .filter((item) =>
      Number.isFinite(item.purchaseRequestId)
      && Number.isFinite(item.purchaseRequestItemNumber)
      && Number.isFinite(item.deliveryRequirementNumber)
    )
    .map((item) => ({
      endpoint: purchaseQuotationId
        ? `/v1/purchase-quotations/${purchaseQuotationId}/items/from-purchase-request`
        : "/v1/purchase-quotations/{purchaseQuotationId}/items/from-purchase-request",
      body: item
    }));
}

function supplierPayload(purchaseQuotationId: number, purchaseQuotationItemNumber: number, supplierId: number) {
  return {
    endpoint: `/v1/purchase-quotations/${purchaseQuotationId}/items/${purchaseQuotationItemNumber}/suppliers`,
    body: { supplierId }
  };
}

function negotiationUpdatePayload(negotiation: NegotiationInput) {
  return {
    supplierAnswerDate: negotiation.supplierAnswerDate || todayIso(),
    validity: negotiation.validity || undefined,
    seller: negotiation.seller || undefined,
    discount: Number(negotiation.discount) || 0,
    freightType: negotiation.freightType || "NONE",
    freightPrice: Number(negotiation.freightPrice) || 0,
    valueOtherExpenses: 0,
    applyIpiFreight: false,
    internalNotes: negotiation.internalNotes || undefined,
    supplierNotes: negotiation.supplierNotes || undefined,
    paymentTerms: negotiation.paymentTerms?.length ? negotiation.paymentTerms : undefined
  };
}

function negotiationItemPayload(item: NegotiationItemInput) {
  const quotedQuantity = Number(item.quotedQuantity) || Number(item.negotiatedQuantity) || 0;
  return {
    quotedQuantity,
    negotiatedQuantity: Number(item.negotiatedQuantity) || quotedQuantity,
    unitPrice: Number(item.unitPrice) || 0,
    discount: 0,
    discountPercentage: 0,
    increasePercentage: 0,
    ipiTaxPercentage: 0,
    issTaxPercentage: 0,
    icmsTaxPercentage: 0,
    freightUnitPrice: 0,
    selectedOption: item.selected === true,
    supplierNotes: item.supplierNotes?.slice(0, 4000) || undefined
  };
}

function validNegotiationItems(negotiation?: NegotiationInput) {
  return (negotiation?.items || []).filter((item) => Number.isFinite(item.quotationItemNumber) && item.quotationItemNumber > 0);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function responseResults(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (!record) return [];
  if (Array.isArray(record.results)) return record.results;
  if (Array.isArray(record.data)) return record.data;
  return Object.keys(record).length ? [record] : [];
}

function hasSiengeContent(value: unknown) {
  return responseResults(value).length > 0;
}

function containsNumberForKeys(value: unknown, keys: string[], expected: number): boolean {
  if (!Number.isFinite(expected) || expected <= 0) return false;
  if (Array.isArray(value)) return value.some((item) => containsNumberForKeys(item, keys, expected));
  const record = asRecord(value);
  if (!record) return false;
  return Object.entries(record).some(([key, current]) => {
    if (keys.includes(key) && Number(current) === expected) return true;
    return containsNumberForKeys(current, keys, expected);
  });
}

function recordHasNumber(record: Record<string, unknown>, keys: string[], expected: number) {
  return keys.some((key) => Number(record[key]) === expected);
}

function containsSupplierForItem(value: unknown, supplierId: number, itemNumber: number): boolean {
  if (!supplierId || !itemNumber) return false;
  if (Array.isArray(value)) return value.some((item) => containsSupplierForItem(item, supplierId, itemNumber));
  const record = asRecord(value);
  if (!record) return false;
  const hasSupplier = recordHasNumber(record, ["supplierId", "creditorId"], supplierId);
  const hasItem = recordHasNumber(record, ["quotationItemNumber", "purchaseQuotationItemNumber", "itemNumber", "purchaseRequestItemNumber"], itemNumber);
  if (hasSupplier && hasItem) return true;
  return Object.values(record).some((current) => containsSupplierForItem(current, supplierId, itemNumber));
}

function summarizeSupplier(body: unknown) {
  const supplier = responseResults(body).map(asRecord).find(Boolean);
  if (!supplier) return undefined;
  return {
    id: supplier.id ?? supplier.creditorId,
    name: supplier.name ?? supplier.corporateName ?? supplier.companyName ?? supplier.creditorName,
    tradeName: supplier.tradeName ?? supplier.fantasyName,
    cnpj: supplier.cnpj,
    cpf: supplier.cpf,
    document: supplier.document ?? supplier.documentNumber ?? supplier.taxId,
    city: supplier.city,
    state: supplier.state ?? supplier.uf,
    active: supplier.active
  };
}

function lookupSummary(result: SiengePostResult): SiengeLookupSummary {
  return {
    endpoint: result.endpoint,
    ok: result.ok || result.status === 404,
    status: result.status,
    exists: result.ok ? hasSiengeContent(result.body) : false,
    body: result.ok ? result.body : undefined,
    apiMessage: result.ok ? undefined : result.apiMessage
  };
}

function negotiationAuthorized(record: Record<string, unknown> | undefined) {
  if (!record) return false;
  if (record.authorized === true) return true;
  const statusText = [record.situation, record.status, record.negotiationSituation, record.situationDescription]
    .map((value) => String(value || ""))
    .join(" ")
    .toUpperCase();
  return /AUTORIZAD|AUTHORIZED/.test(statusText);
}

async function findLatestNegotiation(tenant: string, username: string, password: string, purchaseQuotationId: number, supplierId: number): Promise<{ number: number; authorized: boolean } | undefined> {
  const result = await callSienge(tenant, username, password, "GET", `/v1/purchase-quotations/all/negotiations?quotationNumber=${purchaseQuotationId}`);
  if (!result.ok || !result.body || typeof result.body !== "object") return undefined;
  const results = (result.body as { results?: Array<{ suppliers?: Array<{ supplierId?: number; latestNegotiation?: Array<Record<string, unknown> & { negotiationId?: number }> }> }> }).results || [];
  for (const quotation of results) {
    const supplier = quotation.suppliers?.find((current) => Number(current.supplierId) === supplierId);
    const latest = supplier?.latestNegotiation?.[0];
    const negotiationId = Number(latest?.negotiationId);
    if (Number.isFinite(negotiationId) && negotiationId > 0) {
      return { number: negotiationId, authorized: negotiationAuthorized(latest) };
    }
  }
  return undefined;
}

async function runPreflight(action: QuotationAction, body: QuotationCreateRequest, config: { tenant: string; username: string; password: string }): Promise<SiengePreflight> {
  const purchaseQuotationId = Number(body.purchaseQuotationId) || 0;
  const supplierId = Number(body.supplierId) || 0;
  const itemNumbers = Array.from(new Set([
    Number(body.purchaseQuotationItemNumber) || 0,
    ...(body.request?.items || []).map((item) => Number(item.purchaseRequestItemNumber) || 0)
  ].filter((value) => value > 0)));
  const productId = Number(body.item?.productId) || 0;
  const preflight: SiengePreflight = {
    action,
    checkedAt: new Date().toISOString(),
    hints: [],
    existing: { itemNumbers: [], productId: false, supplierOnItem: false }
  };

  if (purchaseQuotationId > 0) {
    preflight.quotation = lookupSummary(await callSienge(
      config.tenant,
      config.username,
      config.password,
      "GET",
      `/v1/purchase-quotations/all/negotiations?quotationNumber=${purchaseQuotationId}`
    ));
    if (preflight.quotation.exists) {
      preflight.hints.push("Cotação localizada no Sienge antes da gravação.");
    }
    itemNumbers.forEach((itemNumber) => {
      if (containsNumberForKeys(preflight.quotation?.body, ["quotationItemNumber", "purchaseQuotationItemNumber", "itemNumber", "purchaseRequestItemNumber"], itemNumber)) {
        preflight.existing.itemNumbers.push(itemNumber);
        preflight.hints.push(`Item ${itemNumber} já aparece nos dados retornados pelo Sienge.`);
      }
    });
    if (productId && containsNumberForKeys(preflight.quotation.body, ["productId", "insumoId", "materialId"], productId)) {
      preflight.existing.productId = true;
      preflight.hints.push(`Insumo ${productId} já aparece nos dados retornados pelo Sienge.`);
    }
    if (supplierId && itemNumbers.some((itemNumber) => containsSupplierForItem(preflight.quotation?.body, supplierId, itemNumber))) {
      preflight.existing.supplierOnItem = true;
      preflight.hints.push(`Fornecedor ${supplierId} já aparece no item informado desta cotação no Sienge.`);
    } else if (supplierId && containsNumberForKeys(preflight.quotation.body, ["supplierId", "creditorId"], supplierId)) {
      preflight.hints.push(`Fornecedor ${supplierId} já aparece nesta cotação no Sienge.`);
    }
  }

  if (supplierId > 0) {
    const supplierLookup = lookupSummary(await callSienge(config.tenant, config.username, config.password, "GET", `/v1/creditors/${supplierId}`));
    preflight.supplier = {
      ...supplierLookup,
      supplierInfo: summarizeSupplier(supplierLookup.body)
    };
    if (supplierLookup.exists) {
      const name = preflight.supplier.supplierInfo?.name;
      preflight.hints.push(name ? `Fornecedor localizado no Sienge: ${String(name)}.` : "Fornecedor localizado no Sienge.");
    }
  }

  if (action === "send-negotiation" && purchaseQuotationId && supplierId) {
    const latest = await findLatestNegotiation(config.tenant, config.username, config.password, purchaseQuotationId, supplierId);
    if (latest && !latest.authorized) {
      preflight.latestNegotiationNumber = latest.number;
      preflight.hints.push(`Negociação ${latest.number} já existe para este fornecedor e será reutilizada.`);
    } else if (latest?.authorized) {
      // Negociação autorizada não deve ser sobrescrita: uma nova rodada é criada.
      preflight.hints.push(`A negociação ${latest.number} já está autorizada no Sienge; uma nova rodada será criada.`);
    }
  }

  return preflight;
}

function dryRunResponse(body: QuotationCreateRequest, payload: Record<string, unknown>) {
  return NextResponse.json({
    mode: "dry-run",
    action: body.action || "create",
    message: "Payload pronto para conferência. Confirme a gravação para executar no Sienge.",
    ...payload
  });
}

async function callSienge(tenant: string, username: string, password: string, method: "POST" | "PUT" | "PATCH" | "GET", endpoint: string, body?: unknown): Promise<SiengePostResult> {
  const url = `https://api.sienge.com.br/${tenant}/public/api${endpoint}`;
  const response = await fetch(url, {
    method,
    headers: authHeaders(username, password),
    body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
    cache: "no-store"
  });

  if (!response.ok) {
    return {
      ok: false,
      endpoint: `${method} ${endpoint}`,
      status: response.status,
      apiMessage: await parseSiengeResponse(response)
    };
  }

  return {
    ok: true,
    endpoint: `${method} ${endpoint}`,
    status: response.status,
    location: response.headers.get("location"),
    body: await parseSiengeResponse(response)
  };
}

function postSienge(tenant: string, username: string, password: string, endpoint: string, body: unknown): Promise<SiengePostResult> {
  return callSienge(tenant, username, password, "POST", endpoint, body);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// O Sienge limita a taxa de chamadas (429) quando várias gravações saem em sequência
// rápida (ex.: vincular vários itens de uma solicitação). Espera um pouco entre
// chamadas e tenta de novo com backoff quando toma 429 ou erro 5xx transitório.
async function callSiengeWithBackoff(
  tenant: string,
  username: string,
  password: string,
  method: "POST" | "PUT" | "PATCH",
  endpoint: string,
  body: unknown,
  attempts = 4
): Promise<SiengePostResult> {
  let result = await callSienge(tenant, username, password, method, endpoint, body);
  for (let attempt = 1; attempt < attempts && !result.ok && (result.status === 429 || result.status >= 500); attempt++) {
    await sleep(attempt * 700);
    result = await callSienge(tenant, username, password, method, endpoint, body);
  }
  return result;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeBuyerId(value: string) {
  return value.trim().toUpperCase();
}

// Chave de deduplicação: identifica "a mesma operação" para bloquear um
// segundo envio idêntico ao Sienge (a menos que o usuário force a repetição).
function integrationKeyFor(action: QuotationAction, body: QuotationCreateRequest): string | undefined {
  const quotationId = Number(body.purchaseQuotationId) || 0;
  if (action === "create") {
    if (quotationId) return `create:${quotationId}`;
    const requestId = Number(body.request?.purchaseRequestId) || 0;
    const items = (body.request?.items || [])
      .map((item) => `${item.purchaseRequestId}.${item.purchaseRequestItemNumber}.${item.deliveryRequirementNumber}`)
      .sort()
      .join("|");
    return requestId ? `create-from-request:${requestId}:${items || "all"}` : `create-manual:${normalizeBuyerId(String(body.buyerId || ""))}:${body.date || todayIso()}`;
  }
  if (action === "attach-items") {
    const items = (body.request?.items || [])
      .map((item) => `${item.purchaseRequestId}.${item.purchaseRequestItemNumber}.${item.deliveryRequirementNumber}`)
      .sort()
      .join("|");
    return items ? `attach-items:${quotationId}:${items}` : undefined;
  }
  if (action === "add-supplier") {
    const itemNumber = Number(body.purchaseQuotationItemNumber || body.request?.items?.[0]?.purchaseRequestItemNumber) || 0;
    return `add-supplier:${quotationId}:${itemNumber}:${Number(body.supplierId) || 0}`;
  }
  if (action === "add-item") {
    const appropriations = (body.item?.buildingsApropriations || [])
      .map((item) => `${Number(item.buildingUnitId) || 0}.${String(item.costEstimationItemReference || "").trim()}.${Number(item.percentage) || 0}`)
      .sort()
      .join("|");
    return `add-item:${quotationId}:${Number(body.item?.buildingId) || 0}:${Number(body.item?.productId) || 0}:${Number(body.item?.quantity) || 0}:${appropriations}`;
  }
  if (action === "send-negotiation") {
    const responseId = Number(body.negotiation?.responseId) || 0;
    const mode = body.negotiation?.authorize ? "auth" : "save";
    return `send-negotiation:${quotationId}:${Number(body.supplierId) || 0}:${responseId ? `resposta-${responseId}` : "manual"}:${mode}`;
  }
  return undefined;
}

function duplicateIntegrationResponse(quotationId: number | undefined, integrationKey: string | undefined, force: boolean | undefined) {
  if (!integrationKey || force === true) return undefined;
  const existing = quotationId
    ? findSupplierQuoteIntegration(quotationId, integrationKey)
    : findSupplierQuoteIntegrationByKey(integrationKey);
  if (!existing) return undefined;
  return NextResponse.json({
    message: `Esta operação já foi integrada ao Sienge em ${existing.createdAt.slice(0, 10)} (${existing.title}). Nada foi enviado agora para evitar duplicidade.`,
    alreadyIntegrated: true,
    integration: {
      eventId: existing.id,
      title: existing.title,
      description: existing.description,
      createdAt: existing.createdAt
    }
  }, { status: 409 });
}

function existingInSiengeResponse(message: string, preflight: SiengePreflight) {
  return NextResponse.json({
    message,
    alreadyExistsInSienge: true,
    preflight
  }, { status: 409 });
}

function preflightUnavailableResponse(preflight: SiengePreflight) {
  return NextResponse.json({
    message: "Não foi possível consultar o Sienge antes da gravação. Nada foi enviado.",
    preflight
  }, { status: 502 });
}

function alreadyExistingQuotationResponse(quotationId: number | undefined, force: boolean | undefined) {
  if (!quotationId || force === true) return undefined;
  return NextResponse.json({
    message: `Esta cotação já existe no Sienge com ID ${quotationId}. A criação de uma nova cotação a partir do detalhe foi bloqueada para evitar duplicidade.`,
    alreadyIntegrated: true,
    integration: {
      eventId: undefined,
      title: "Cotação já existente no Sienge",
      description: "Use a criação apenas a partir de uma solicitação ainda não cotada ou force conscientemente a repeticao.",
      createdAt: todayIso()
    }
  }, { status: 409 });
}

function parseIdFromResult(result: SiengePostResult) {
  if (!result.ok) return undefined;
  const locationId = parseIdFromLocation(result.location);
  if (locationId) return locationId;
  if (result.body && typeof result.body === "object") {
    const record = result.body as Record<string, unknown>;
    const directId = Number(record.purchaseQuotationId || record.id);
    if (Number.isFinite(directId) && directId > 0) return directId;
  }
  return undefined;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "negotiations";
  const quotationId = Number(searchParams.get("quotationId"));

  if (!Number.isFinite(quotationId) || quotationId <= 0) {
    return NextResponse.json({ message: "Informe uma cotação válida." }, { status: 400 });
  }

  const config = siengeConfig();
  if ("error" in config) {
    return NextResponse.json({ message: config.error }, { status: 400 });
  }

  if (type === "comparison-map") {
    const result = await callSienge(config.tenant, config.username, config.password, "GET", `/v1/purchase-quotations/comparison-map/pdf?purchaseQuotationId=${quotationId}`);
    if (!result.ok) {
      return NextResponse.json({ message: "O Sienge não retornou o mapa comparativo desta cotação.", result }, { status: result.status });
    }
    const urls = ((result.body as { results?: Array<{ urlReport?: string }> })?.results || [])
      .map((item) => item.urlReport)
      .filter((url): url is string => Boolean(url));
    return NextResponse.json({ urls, result: result.body });
  }

  const result = await callSienge(config.tenant, config.username, config.password, "GET", `/v1/purchase-quotations/all/negotiations?quotationNumber=${quotationId}`);
  if (!result.ok) {
    return NextResponse.json({ message: "O Sienge não retornou as negociacoes desta cotação.", result }, { status: result.status });
  }
  return NextResponse.json({ negotiations: result.body });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as QuotationCreateRequest;
  const action = body.action || "create";
  const buyerId = normalizeBuyerId(String(body.buyerId || ""));
  const date = body.date || todayIso();
  const eventQuotationId = Number(body.purchaseQuotationId) || undefined;
  const integrationKey = integrationKeyFor(action, body);

  // Conferência (dry-run) é liberada para qualquer sessão; gravar no Sienge
  // exige a permissão sienge.write do usuário logado.
  const confirmedWrite = body.confirm === true && body.dryRun === false;
  const actor = guardPermission(request, "sienge.write");
  if (confirmedWrite && (!actor.user || actor.status)) {
    return NextResponse.json({ message: actor.message }, { status: actor.status || 403 });
  }
  const actorName = actor.user?.name;

  function recordIntegrationEvent(type: "integration_error" | "sienge_created", title: string, description?: string, metadata?: Record<string, unknown>) {
    if (!eventQuotationId) return;
    recordSupplierQuoteEvent({
      quotationId: eventQuotationId,
      type,
      title,
      description: description || "Evento de integracao registrado.",
      metadata: { action, actor: actorName, ...metadata }
    });
  }

  if (action === "create" && !buyerId) {
    return NextResponse.json({
      message: "Informe o comprador do Sienge para preparar a cotação."
    }, { status: 400 });
  }

  if (action === "create" && !isIsoDate(date)) {
    return NextResponse.json({
      message: "Informe a data da cotação no formato yyyy-MM-dd."
    }, { status: 400 });
  }

  if (action !== "create" && !body.purchaseQuotationId) {
    return NextResponse.json({
      message: "Informe o ID da cotação do Sienge."
    }, { status: 400 });
  }

  // O Sienge rejeita o payload com "createdBy" (400 "conteúdo não pôde ser lido"),
  // porque o endpoint não reconhece esse campo; só buyerId e date são aceitos.
  const quotationPayload = {
    buyerId,
    date
  };

  if (action === "create" && (body.dryRun !== false || !body.confirm)) {
    return dryRunResponse(body, {
      endpoint: "/v1/purchase-quotations",
      quotationPayload,
      itemPayloads: itemPayloads(body.request),
      note: "Ao confirmar, a rota cria a cotação e tenta vincular os itens da solicitação com o ID retornado."
    });
  }

  if (action === "attach-items") {
    const payloads = itemPayloads(body.request, body.purchaseQuotationId);
    if (!payloads.length) {
      return NextResponse.json({
        message: "Informe ao menos um item de solicitação com deliveryRequirementNumber."
      }, { status: 400 });
    }

    if (body.dryRun !== false || !body.confirm) {
      return dryRunResponse(body, { itemPayloads: payloads });
    }

    const duplicate = duplicateIntegrationResponse(eventQuotationId, integrationKey, body.force);
    if (duplicate) return duplicate;

    const config = siengeConfig();
    if ("error" in config) {
      recordIntegrationEvent("integration_error", "Erro de configuração do Sienge", config.error);
      return NextResponse.json({ message: config.error }, { status: 400 });
    }

    const preflight = await runPreflight(action, body, config);
    if (preflight.quotation && !preflight.quotation.ok) return preflightUnavailableResponse(preflight);
    if (body.force !== true && preflight.existing.itemNumbers.length) {
      return existingInSiengeResponse(`O(s) item(ns) ${preflight.existing.itemNumbers.join(", ")} já aparece(m) na consulta prévia do Sienge. Nada foi enviado agora para evitar duplicidade.`, preflight);
    }

    const results = [];
    for (const payload of payloads) {
      if (results.length) await sleep(350);
      results.push(await callSiengeWithBackoff(config.tenant, config.username, config.password, "POST", payload.endpoint, payload.body));
    }

    const failed = results.find((result) => !result.ok);
    if (failed) {
      recordIntegrationEvent("integration_error", "Erro ao vincular item no Sienge", "Um ou mais itens não foram aceitos pelo Sienge.", { preflight, results });
    } else {
      recordIntegrationEvent("sienge_created", "Itens vinculados no Sienge", "Itens da solicitação foram vinculados a cotação.", { integrationKey, preflight, results });
    }
    return NextResponse.json({
      message: failed ? "Um ou mais itens não foram aceitos pelo Sienge." : "Itens vinculados a cotação no Sienge.",
      preflight,
      results
    }, { status: failed ? failed.status : 201 });
  }

  if (action === "add-supplier") {
    const purchaseQuotationId = Number(body.purchaseQuotationId);
    const purchaseQuotationItemNumber = Number(body.purchaseQuotationItemNumber || body.request?.items?.[0]?.purchaseRequestItemNumber);
    const supplierId = Number(body.supplierId);
    if (!purchaseQuotationItemNumber || !supplierId) {
      return NextResponse.json({
        message: "Informe o item da cotação e o fornecedor do Sienge."
      }, { status: 400 });
    }

    const payload = supplierPayload(purchaseQuotationId, purchaseQuotationItemNumber, supplierId);
    if (body.dryRun !== false || !body.confirm) {
      return dryRunResponse(body, {
        endpoint: payload.endpoint,
        supplierPayload: payload.body
      });
    }

    const duplicate = duplicateIntegrationResponse(eventQuotationId, integrationKey, body.force);
    if (duplicate) return duplicate;

    const config = siengeConfig();
    if ("error" in config) {
      recordIntegrationEvent("integration_error", "Erro de configuração do Sienge", config.error);
      return NextResponse.json({ message: config.error }, { status: 400 });
    }

    const preflight = await runPreflight(action, body, config);
    if ((preflight.quotation && !preflight.quotation.ok) || (preflight.supplier && !preflight.supplier.ok)) return preflightUnavailableResponse(preflight);
    if (preflight.supplier && !preflight.supplier.exists) {
      return NextResponse.json({
        message: "Fornecedor não encontrado no Sienge na consulta prévia. Nada foi enviado.",
        preflight
      }, { status: 404 });
    }
    if (body.force !== true && preflight.existing.supplierOnItem) {
      return existingInSiengeResponse("Este fornecedor já aparece neste item na consulta prévia do Sienge. Nada foi enviado agora para evitar duplicidade.", preflight);
    }

    const result = await postSienge(config.tenant, config.username, config.password, payload.endpoint, payload.body);
    if (!result.ok) {
      recordIntegrationEvent("integration_error", "Erro ao incluir fornecedor no item", "O Sienge não aceitou o fornecedor neste item da cotação.", { preflight, result });
      return NextResponse.json({
        message: "O Sienge não aceitou o fornecedor neste item da cotação.",
        preflight,
        result
      }, { status: result.status });
    }

    recordIntegrationEvent("sienge_created", "Fornecedor vinculado no Sienge", "Fornecedor incluído em um item da cotação.", {
      integrationKey,
      preflight,
      endpoint: payload.endpoint,
      supplierId
    });
    return NextResponse.json({
      message: "Fornecedor incluído no item da cotação no Sienge.",
      preflight,
      result
    }, { status: 201 });
  }

  if (action === "add-item") {
    const purchaseQuotationId = Number(body.purchaseQuotationId);
    const item = body.item;
    const deliveries = (item?.deliveryRequirements || []).filter((delivery) => isIsoDate(delivery.requirementDate) && Number(delivery.requirementQuantity) > 0);
    const appropriations = (item?.buildingsApropriations || []).filter((appropriation) =>
      Number(appropriation.buildingUnitId) > 0
      && String(appropriation.costEstimationItemReference || "").trim()
      && Number(appropriation.percentage) > 0
    );
    const appropriationTotal = appropriations.reduce((sum, appropriation) => sum + (Number(appropriation.percentage) || 0), 0);
    if (!purchaseQuotationId || !item || !Number(item.buildingId) || !Number(item.productId) || !Number(item.quantity) || !item.unitySymbol?.trim() || !deliveries.length) {
      return NextResponse.json({
        message: "Informe obra, insumo, quantidade, unidade e ao menos uma entrega com data e quantidade."
      }, { status: 400 });
    }
    if (!appropriations.length || Math.abs(appropriationTotal - 100) >= 0.01) {
      return NextResponse.json({
        message: "Informe a apropriação de obra do insumo direto com unidade construtiva, referência do orçamento e percentual total de 100%."
      }, { status: 400 });
    }

    const payload = {
      endpoint: `/v1/purchase-quotations/${purchaseQuotationId}/items`,
      body: {
        buildingId: Number(item.buildingId),
        productId: Number(item.productId),
        detailId: Number(item.detailId) || undefined,
        trademarkId: Number(item.trademarkId) || undefined,
        quantity: Number(item.quantity),
        unitySymbol: item.unitySymbol.trim(),
        notes: item.notes?.slice(0, 4000) || undefined,
        deliveryRequirements: deliveries.map((delivery) => ({
          requirementDate: delivery.requirementDate,
          requirementQuantity: Number(delivery.requirementQuantity)
        })),
        buildingsApropriations: appropriations.map((appropriation) => ({
          buildingUnitId: Number(appropriation.buildingUnitId),
          costEstimationItemReference: String(appropriation.costEstimationItemReference || "").trim(),
          percentage: Number(appropriation.percentage)
        }))
      }
    };

    if (body.dryRun !== false || !body.confirm) {
      return dryRunResponse(body, { endpoint: payload.endpoint, itemPayload: payload.body });
    }

    const duplicate = duplicateIntegrationResponse(eventQuotationId, integrationKey, body.force);
    if (duplicate) return duplicate;

    const config = siengeConfig();
    if ("error" in config) {
      recordIntegrationEvent("integration_error", "Erro de configuração do Sienge", config.error);
      return NextResponse.json({ message: config.error }, { status: 400 });
    }

    const preflight = await runPreflight(action, body, config);
    if (preflight.quotation && !preflight.quotation.ok) return preflightUnavailableResponse(preflight);
    if (body.force !== true && preflight.existing.productId) {
      return existingInSiengeResponse("Este insumo já aparece na consulta prévia do Sienge. Nada foi enviado agora para evitar duplicidade.", preflight);
    }

    const result = await postSienge(config.tenant, config.username, config.password, payload.endpoint, payload.body);
    if (!result.ok) {
      recordIntegrationEvent("integration_error", "Erro ao criar insumo na cotação", "O Sienge não aceitou o insumo direto nesta cotação.", { preflight, result });
      return NextResponse.json({
        message: "O Sienge não aceitou o insumo direto nesta cotação.",
        preflight,
        result
      }, { status: result.status });
    }

    recordIntegrationEvent("sienge_created", "Insumo criado na cotação", "Insumo criado direto na cotação, sem solicitação de compra.", {
      integrationKey,
      preflight,
      endpoint: payload.endpoint,
      productId: payload.body.productId
    });
    return NextResponse.json({
      message: "Insumo criado na cotação do Sienge.",
      preflight,
      result
    }, { status: 201 });
  }

  if (action === "send-negotiation") {
    const purchaseQuotationId = Number(body.purchaseQuotationId);
    const supplierId = Number(body.supplierId);
    const negotiation = body.negotiation;
    const items = validNegotiationItems(negotiation);
    if (!purchaseQuotationId || !supplierId || !negotiation) {
      return NextResponse.json({
        message: "Informe a cotação, o fornecedor do Sienge e os dados da negociação."
      }, { status: 400 });
    }

    const basePath = `/v1/purchase-quotations/${purchaseQuotationId}/suppliers/${supplierId}/negotiations`;
    const plannedSteps = {
      linkSupplierToItems: Array.from(new Set(items.map((item) => item.quotationItemNumber)))
        .map((itemNumber) => supplierPayload(purchaseQuotationId, itemNumber, supplierId)),
      createNegotiation: negotiation.negotiationNumber ? undefined : { endpoint: basePath, body: {} },
      updateNegotiation: {
        endpoint: `${basePath}/{negotiationNumber}`,
        body: negotiationUpdatePayload(negotiation)
      },
      itemUpdates: items.map((item) => ({
        endpoint: `${basePath}/{negotiationNumber}/items/${item.quotationItemNumber}`,
        body: negotiationItemPayload(item)
      })),
      authorize: negotiation.authorize ? { endpoint: `${basePath}/latest/authorize` } : undefined
    };

    if (body.dryRun !== false || !body.confirm) {
      return dryRunResponse(body, {
        note: "Ao confirmar, a rota cria/atualiza a negociação do fornecedor com os valores informados e, se solicitado, autoriza a última negociação.",
        ...plannedSteps
      });
    }

    const duplicate = duplicateIntegrationResponse(eventQuotationId, integrationKey, body.force);
    if (duplicate) return duplicate;

    const config = siengeConfig();
    if ("error" in config) {
      recordIntegrationEvent("integration_error", "Erro de configuração do Sienge", config.error);
      return NextResponse.json({ message: config.error }, { status: 400 });
    }

    const preflight = await runPreflight(action, body, config);
    if ((preflight.quotation && !preflight.quotation.ok) || (preflight.supplier && !preflight.supplier.ok)) return preflightUnavailableResponse(preflight);
    if (preflight.supplier && !preflight.supplier.exists) {
      return NextResponse.json({
        message: "Fornecedor não encontrado no Sienge na consulta prévia. Nada foi enviado.",
        preflight
      }, { status: 404 });
    }

    // O Sienge só cria negociação para fornecedor já associado a um item da cotação
    // (br...negotiation.supplier.invalid.id). Garante a associação antes de tentar criar,
    // sem bloquear o fluxo se o Sienge recusar por já existir a associação.
    const linkSteps: SiengePostResult[] = [];
    const itemNumbersForSupplier = Array.from(new Set(items.map((item) => item.quotationItemNumber)));
    for (const itemNumber of itemNumbersForSupplier) {
      if (linkSteps.length) await sleep(350);
      const linkPayload = supplierPayload(purchaseQuotationId, itemNumber, supplierId);
      linkSteps.push(await callSiengeWithBackoff(config.tenant, config.username, config.password, "POST", linkPayload.endpoint, linkPayload.body));
    }

    const steps: SiengePostResult[] = [];
    let negotiationNumber = Number(negotiation.negotiationNumber) || preflight.latestNegotiationNumber || undefined;

    if (!negotiationNumber) {
      const created = await postSienge(config.tenant, config.username, config.password, basePath, {});
      steps.push(created);
      if (!created.ok) {
        recordIntegrationEvent("integration_error", "Erro ao criar negociação no Sienge", "O Sienge não aceitou a criação da negociação para o fornecedor.", { preflight, linkSteps, steps });
        return NextResponse.json({ message: "O Sienge não aceitou a criação da negociação.", preflight, linkSteps, steps }, { status: created.status });
      }
      negotiationNumber = parseTrailingIdFromLocation(created.location)
        || (await findLatestNegotiation(config.tenant, config.username, config.password, purchaseQuotationId, supplierId))?.number;
      if (!negotiationNumber) {
        recordIntegrationEvent("integration_error", "Negociação criada sem número identificado", "A negociação foi criada, mas o número não pode ser identificado para gravar os valores.", { preflight, linkSteps, steps });
        return NextResponse.json({
          message: "Negociação criada, mas o número não pode ser identificado. Atualize os dados e tente gravar os valores novamente.",
          preflight,
          linkSteps,
          steps
        }, { status: 502 });
      }
    }

    const updated = await callSienge(config.tenant, config.username, config.password, "PUT", `${basePath}/${negotiationNumber}`, negotiationUpdatePayload(negotiation));
    steps.push(updated);

    for (const item of items) {
      if (steps.length > 1) await sleep(350);
      const itemEndpoint = `${basePath}/${negotiationNumber}/items/${item.quotationItemNumber}`;
      const itemPayload = negotiationItemPayload(item);
      steps.push(await callSiengeWithBackoff(config.tenant, config.username, config.password, "PUT", itemEndpoint, itemPayload));
    }

    let authorized: SiengePostResult | undefined;
    const failedStep = steps.find((step) => !step.ok);
    if (negotiation.authorize && !failedStep) {
      authorized = await callSienge(config.tenant, config.username, config.password, "PATCH", `${basePath}/latest/authorize`);
      steps.push(authorized);
    }

    const failed = steps.find((step) => !step.ok);
    if (failed) {
      recordIntegrationEvent("integration_error", "Erro ao gravar negociação no Sienge", "Uma ou mais etapas da negociação não foram aceitas pelo Sienge.", { preflight, negotiationNumber, linkSteps, steps });
    } else {
      recordIntegrationEvent("sienge_created", negotiation.authorize ? "Negociação gravada e autorizada no Sienge" : "Negociação gravada no Sienge", `Negociação ${negotiationNumber} do fornecedor ${supplierId} atualizada com ${items.length} item(ns).`, { integrationKey, preflight, negotiationNumber, supplierId, responseId: Number(negotiation.responseId) || undefined, authorized: Boolean(negotiation.authorize) });
    }

    return NextResponse.json({
      message: failed
        ? "Uma ou mais etapas da negociação não foram aceitas pelo Sienge."
        : negotiation.authorize
          ? "Negociação gravada e autorizada no Sienge."
          : "Negociação gravada no Sienge.",
      preflight,
      linkSteps,
      negotiationNumber,
      steps
    }, { status: failed ? failed.status : 200 });
  }

  // O bloqueio de cotação já existente vale só para a gravação confirmada:
  // a conferência (dry-run) sempre pode ser preparada acima.
  const duplicateExisting = alreadyExistingQuotationResponse(eventQuotationId, body.force);
  if (duplicateExisting) return duplicateExisting;

  const createDuplicate = duplicateIntegrationResponse(undefined, integrationKey, body.force);
  if (createDuplicate) return createDuplicate;

  const config = siengeConfig();
  if ("error" in config) {
    recordIntegrationEvent("integration_error", "Erro de configuração do Sienge", config.error);
    return NextResponse.json({ message: config.error }, { status: 400 });
  }

  const result = await postSienge(config.tenant, config.username, config.password, "/v1/purchase-quotations", quotationPayload);

  if (!result.ok) {
    recordIntegrationEvent("integration_error", "Erro ao criar cotação no Sienge", "O Sienge não aceitou a criação da cotação.", {
      status: result.status,
      apiMessage: result.apiMessage,
      quotationPayload
    });
    return NextResponse.json({
      message: "O Sienge não aceitou a criação da cotação.",
      status: result.status,
      apiMessage: result.apiMessage,
      hint: "Confira se \"" + buyerId + "\" existe exatamente assim como usuário/login do comprador no Sienge (Cadastros > Usuários). A tela normaliza o código para maiúsculas, mas não valida se o comprador existe antes de tentar gravar.",
      quotationPayload
    }, { status: result.status });
  }

  const purchaseQuotationId = parseIdFromResult(result);
  const payloads = itemPayloads(body.request, purchaseQuotationId);
  const itemResults = [];
  if (purchaseQuotationId && payloads.length) {
    for (const payload of payloads) {
      if (itemResults.length) await sleep(350);
      itemResults.push(await callSiengeWithBackoff(config.tenant, config.username, config.password, "POST", payload.endpoint, payload.body));
    }
  }
  const failedItem = itemResults.find((itemResult) => !itemResult.ok);

  const createdEventQuotationId = purchaseQuotationId || eventQuotationId;
  if (createdEventQuotationId) {
    recordSupplierQuoteEvent({
      quotationId: createdEventQuotationId,
      type: "sienge_created",
      title: "Cotação criada no Sienge",
      description: "Cotação criada via /v1/purchase-quotations.",
      metadata: {
        action,
        integrationKey,
        purchaseQuotationId,
        location: result.location,
        itemResults
      }
    });
  }

  const attachIntegrationKey = purchaseQuotationId
    ? integrationKeyFor("attach-items", { ...body, purchaseQuotationId })
    : undefined;
  if (purchaseQuotationId && attachIntegrationKey && itemResults.length && !failedItem) {
    recordSupplierQuoteEvent({
      quotationId: purchaseQuotationId,
      type: "sienge_created",
      title: "Itens vinculados no Sienge",
      description: "Itens da solicitação foram vinculados junto com a criação da cotação.",
      metadata: {
        action: "attach-items",
        integrationKey: attachIntegrationKey,
        itemResults
      }
    });
  }

  return NextResponse.json({
    message: failedItem
      ? "Cotação criada no Sienge, mas um ou mais itens não foram vinculados."
      : "Cotação criada no Sienge.",
    purchaseQuotationId,
    location: result.location,
    quotationPayload,
    itemPayloads: payloads,
    itemResults
  }, { status: failedItem ? 207 : 201 });
}
