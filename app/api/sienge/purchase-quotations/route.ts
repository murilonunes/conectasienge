import { NextRequest, NextResponse } from "next/server";
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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function parseIdFromLocation(location: string | null) {
  if (!location) return undefined;
  const match = location.match(/purchase-quotations\/(\d+)/i) || location.match(/\/(\d+)$/);
  return match ? Number(match[1]) : undefined;
}

function siengeConfig() {
  const tenant = process.env.SIENGE_TENANT;
  const username = process.env.SIENGE_USERNAME;
  const password = process.env.SIENGE_PASSWORD;
  if (!tenant || !username || !password) {
    return {
      error: "Credenciais do Sienge nao configuradas. Preencha SIENGE_TENANT, SIENGE_USERNAME e SIENGE_PASSWORD."
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

async function findLatestNegotiationNumber(tenant: string, username: string, password: string, purchaseQuotationId: number, supplierId: number) {
  const result = await callSienge(tenant, username, password, "GET", `/v1/purchase-quotations/all/negotiations?quotationNumber=${purchaseQuotationId}`);
  if (!result.ok || !result.body || typeof result.body !== "object") return undefined;
  const results = (result.body as { results?: Array<{ suppliers?: Array<{ supplierId?: number; latestNegotiation?: Array<{ negotiationId?: number }> }> }> }).results || [];
  for (const quotation of results) {
    const supplier = quotation.suppliers?.find((current) => Number(current.supplierId) === supplierId);
    const negotiationId = Number(supplier?.latestNegotiation?.[0]?.negotiationId);
    if (Number.isFinite(negotiationId) && negotiationId > 0) return negotiationId;
  }
  return undefined;
}

function dryRunResponse(body: QuotationCreateRequest, payload: Record<string, unknown>) {
  return NextResponse.json({
    mode: "dry-run",
    action: body.action || "create",
    message: "Payload pronto para conferencia. Confirme a gravacao para executar no Sienge.",
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

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeBuyerId(value: string) {
  return value.trim().toUpperCase();
}

function unreadableContentError(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value || {});
  return /content could not be read|empty or invalid/i.test(text);
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

function alreadyExistingQuotationResponse(quotationId: number | undefined, force: boolean | undefined) {
  if (!quotationId || force === true) return undefined;
  return NextResponse.json({
    message: `Esta cotacao ja existe no Sienge com ID ${quotationId}. A criacao de uma nova cotacao a partir do detalhe foi bloqueada para evitar duplicidade.`,
    alreadyIntegrated: true,
    integration: {
      eventId: undefined,
      title: "Cotacao ja existente no Sienge",
      description: "Use a criacao apenas a partir de uma solicitacao ainda nao cotada ou force conscientemente a repeticao.",
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
    return NextResponse.json({ message: "Informe uma cotacao valida." }, { status: 400 });
  }

  const config = siengeConfig();
  if ("error" in config) {
    return NextResponse.json({ message: config.error }, { status: 400 });
  }

  if (type === "comparison-map") {
    const result = await callSienge(config.tenant, config.username, config.password, "GET", `/v1/purchase-quotations/comparison-map/pdf?purchaseQuotationId=${quotationId}`);
    if (!result.ok) {
      return NextResponse.json({ message: "O Sienge nao retornou o mapa comparativo desta cotacao.", result }, { status: result.status });
    }
    const urls = ((result.body as { results?: Array<{ urlReport?: string }> })?.results || [])
      .map((item) => item.urlReport)
      .filter((url): url is string => Boolean(url));
    return NextResponse.json({ urls, result: result.body });
  }

  const result = await callSienge(config.tenant, config.username, config.password, "GET", `/v1/purchase-quotations/all/negotiations?quotationNumber=${quotationId}`);
  if (!result.ok) {
    return NextResponse.json({ message: "O Sienge nao retornou as negociacoes desta cotacao.", result }, { status: result.status });
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

  function recordIntegrationEvent(type: "integration_error" | "sienge_created", title: string, description?: string, metadata?: Record<string, unknown>) {
    if (!eventQuotationId) return;
    recordSupplierQuoteEvent({
      quotationId: eventQuotationId,
      type,
      title,
      description: description || "Evento de integracao registrado.",
      metadata: { action, ...metadata }
    });
  }

  if (action === "create" && !buyerId) {
    return NextResponse.json({
      message: "Informe o comprador do Sienge para preparar a cotacao."
    }, { status: 400 });
  }

  if (action === "create" && !isIsoDate(date)) {
    return NextResponse.json({
      message: "Informe a data da cotacao no formato yyyy-MM-dd."
    }, { status: 400 });
  }

  if (action === "create") {
    const duplicateExisting = alreadyExistingQuotationResponse(eventQuotationId, body.force);
    if (duplicateExisting) return duplicateExisting;
  }

  if (action !== "create" && !body.purchaseQuotationId) {
    return NextResponse.json({
      message: "Informe o ID da cotacao do Sienge."
    }, { status: 400 });
  }

  const quotationPayload = {
    buyerId,
    date,
    createdBy: buyerId
  };
  const quotationFallbackPayload = {
    buyerId,
    date
  };

  if (action === "create" && (body.dryRun !== false || !body.confirm)) {
    return dryRunResponse(body, {
      endpoint: "/v1/purchase-quotations",
      quotationPayload,
      fallbackPayload: quotationFallbackPayload,
      itemPayloads: itemPayloads(body.request),
      note: "Ao confirmar, a rota cria a cotacao e tenta vincular os itens da solicitacao com o ID retornado."
    });
  }

  if (action === "attach-items") {
    const payloads = itemPayloads(body.request, body.purchaseQuotationId);
    if (!payloads.length) {
      return NextResponse.json({
        message: "Informe ao menos um item de solicitacao com deliveryRequirementNumber."
      }, { status: 400 });
    }

    if (body.dryRun !== false || !body.confirm) {
      return dryRunResponse(body, { itemPayloads: payloads });
    }

    const duplicate = duplicateIntegrationResponse(eventQuotationId, integrationKey, body.force);
    if (duplicate) return duplicate;

    const config = siengeConfig();
    if ("error" in config) {
      recordIntegrationEvent("integration_error", "Erro de configuracao do Sienge", config.error);
      return NextResponse.json({ message: config.error }, { status: 400 });
    }

    const results = [];
    for (const payload of payloads) {
      results.push(await postSienge(config.tenant, config.username, config.password, payload.endpoint, payload.body));
    }

    const failed = results.find((result) => !result.ok);
    if (failed) {
      recordIntegrationEvent("integration_error", "Erro ao vincular item no Sienge", "Um ou mais itens nao foram aceitos pelo Sienge.", { results });
    } else {
      recordIntegrationEvent("sienge_created", "Itens vinculados no Sienge", "Itens da solicitacao foram vinculados a cotacao.", { integrationKey, results });
    }
    return NextResponse.json({
      message: failed ? "Um ou mais itens nao foram aceitos pelo Sienge." : "Itens vinculados a cotacao no Sienge.",
      results
    }, { status: failed ? failed.status : 201 });
  }

  if (action === "add-supplier") {
    const purchaseQuotationId = Number(body.purchaseQuotationId);
    const purchaseQuotationItemNumber = Number(body.purchaseQuotationItemNumber || body.request?.items?.[0]?.purchaseRequestItemNumber);
    const supplierId = Number(body.supplierId);
    if (!purchaseQuotationItemNumber || !supplierId) {
      return NextResponse.json({
        message: "Informe o item da cotacao e o fornecedor do Sienge."
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
      recordIntegrationEvent("integration_error", "Erro de configuracao do Sienge", config.error);
      return NextResponse.json({ message: config.error }, { status: 400 });
    }

    const result = await postSienge(config.tenant, config.username, config.password, payload.endpoint, payload.body);
    if (!result.ok) {
      recordIntegrationEvent("integration_error", "Erro ao incluir fornecedor no item", "O Sienge nao aceitou o fornecedor neste item da cotacao.", { result });
      return NextResponse.json({
        message: "O Sienge nao aceitou o fornecedor neste item da cotacao.",
        result
      }, { status: result.status });
    }

    recordIntegrationEvent("sienge_created", "Fornecedor vinculado no Sienge", "Fornecedor incluido em um item da cotacao.", {
      integrationKey,
      endpoint: payload.endpoint,
      supplierId
    });
    return NextResponse.json({
      message: "Fornecedor incluido no item da cotacao no Sienge.",
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
        message: "Informe a apropriacao de obra do insumo direto com unidade construtiva, referencia do orcamento e percentual total de 100%."
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
      recordIntegrationEvent("integration_error", "Erro de configuracao do Sienge", config.error);
      return NextResponse.json({ message: config.error }, { status: 400 });
    }

    const result = await postSienge(config.tenant, config.username, config.password, payload.endpoint, payload.body);
    if (!result.ok) {
      recordIntegrationEvent("integration_error", "Erro ao criar insumo na cotacao", "O Sienge nao aceitou o insumo direto nesta cotacao.", { result });
      return NextResponse.json({
        message: "O Sienge nao aceitou o insumo direto nesta cotacao.",
        result
      }, { status: result.status });
    }

    recordIntegrationEvent("sienge_created", "Insumo criado na cotacao", "Insumo criado direto na cotacao, sem solicitacao de compra.", {
      integrationKey,
      endpoint: payload.endpoint,
      productId: payload.body.productId
    });
    return NextResponse.json({
      message: "Insumo criado na cotacao do Sienge.",
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
        message: "Informe a cotacao, o fornecedor do Sienge e os dados da negociacao."
      }, { status: 400 });
    }

    const basePath = `/v1/purchase-quotations/${purchaseQuotationId}/suppliers/${supplierId}/negotiations`;
    const plannedSteps = {
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
        note: "Ao confirmar, a rota cria/atualiza a negociacao do fornecedor com os valores informados e, se solicitado, autoriza a ultima negociacao.",
        ...plannedSteps
      });
    }

    const duplicate = duplicateIntegrationResponse(eventQuotationId, integrationKey, body.force);
    if (duplicate) return duplicate;

    const config = siengeConfig();
    if ("error" in config) {
      recordIntegrationEvent("integration_error", "Erro de configuracao do Sienge", config.error);
      return NextResponse.json({ message: config.error }, { status: 400 });
    }

    const steps: SiengePostResult[] = [];
    let negotiationNumber = Number(negotiation.negotiationNumber) || undefined;

    if (!negotiationNumber) {
      const created = await postSienge(config.tenant, config.username, config.password, basePath, {});
      steps.push(created);
      if (!created.ok) {
        recordIntegrationEvent("integration_error", "Erro ao criar negociacao no Sienge", "O Sienge nao aceitou a criacao da negociacao para o fornecedor.", { steps });
        return NextResponse.json({ message: "O Sienge nao aceitou a criacao da negociacao.", steps }, { status: created.status });
      }
      negotiationNumber = parseIdFromLocation(created.location)
        || await findLatestNegotiationNumber(config.tenant, config.username, config.password, purchaseQuotationId, supplierId);
      if (!negotiationNumber) {
        recordIntegrationEvent("integration_error", "Negociacao criada sem numero identificado", "A negociacao foi criada, mas o numero nao pode ser identificado para gravar os valores.", { steps });
        return NextResponse.json({
          message: "Negociacao criada, mas o numero nao pode ser identificado. Atualize os dados e tente gravar os valores novamente.",
          steps
        }, { status: 502 });
      }
    }

    const updated = await callSienge(config.tenant, config.username, config.password, "PUT", `${basePath}/${negotiationNumber}`, negotiationUpdatePayload(negotiation));
    steps.push(updated);

    for (const item of items) {
      steps.push(await callSienge(
        config.tenant,
        config.username,
        config.password,
        "PUT",
        `${basePath}/${negotiationNumber}/items/${item.quotationItemNumber}`,
        negotiationItemPayload(item)
      ));
    }

    let authorized: SiengePostResult | undefined;
    const failedStep = steps.find((step) => !step.ok);
    if (negotiation.authorize && !failedStep) {
      authorized = await callSienge(config.tenant, config.username, config.password, "PATCH", `${basePath}/latest/authorize`);
      steps.push(authorized);
    }

    const failed = steps.find((step) => !step.ok);
    if (failed) {
      recordIntegrationEvent("integration_error", "Erro ao gravar negociacao no Sienge", "Uma ou mais etapas da negociacao nao foram aceitas pelo Sienge.", { negotiationNumber, steps });
    } else {
      recordIntegrationEvent("sienge_created", negotiation.authorize ? "Negociacao gravada e autorizada no Sienge" : "Negociacao gravada no Sienge", `Negociacao ${negotiationNumber} do fornecedor ${supplierId} atualizada com ${items.length} item(ns).`, { integrationKey, negotiationNumber, supplierId, responseId: Number(negotiation.responseId) || undefined, authorized: Boolean(negotiation.authorize) });
    }

    return NextResponse.json({
      message: failed
        ? "Uma ou mais etapas da negociacao nao foram aceitas pelo Sienge."
        : negotiation.authorize
          ? "Negociacao gravada e autorizada no Sienge."
          : "Negociacao gravada no Sienge.",
      negotiationNumber,
      steps
    }, { status: failed ? failed.status : 200 });
  }

  const createDuplicate = duplicateIntegrationResponse(undefined, integrationKey, body.force);
  if (createDuplicate) return createDuplicate;

  const config = siengeConfig();
  if ("error" in config) {
    recordIntegrationEvent("integration_error", "Erro de configuracao do Sienge", config.error);
    return NextResponse.json({ message: config.error }, { status: 400 });
  }

  const attempts = [];
  let result = await postSienge(config.tenant, config.username, config.password, "/v1/purchase-quotations", quotationPayload);
  attempts.push({ name: "documented", payload: quotationPayload, result });
  if (!result.ok && result.status === 400 && unreadableContentError(result.apiMessage)) {
    result = await postSienge(config.tenant, config.username, config.password, "/v1/purchase-quotations", quotationFallbackPayload);
    attempts.push({ name: "withoutCreatedBy", payload: quotationFallbackPayload, result });
  }

  if (!result.ok) {
    recordIntegrationEvent("integration_error", "Erro ao criar cotacao no Sienge", "O Sienge nao aceitou a criacao da cotacao.", {
      status: result.status,
      apiMessage: result.apiMessage,
      attempts
    });
    return NextResponse.json({
      message: "O Sienge nao aceitou a criacao da cotacao.",
      status: result.status,
      apiMessage: result.apiMessage,
      hint: "Confira se o comprador existe como usuario do Sienge. A tela normaliza o codigo para maiusculas porque os compradores sincronizados aparecem assim.",
      attempts
    }, { status: result.status });
  }

  const purchaseQuotationId = parseIdFromResult(result);
  const payloads = itemPayloads(body.request, purchaseQuotationId);
  const itemResults = [];
  if (purchaseQuotationId && payloads.length) {
    for (const payload of payloads) {
      itemResults.push(await postSienge(config.tenant, config.username, config.password, payload.endpoint, payload.body));
    }
  }
  const failedItem = itemResults.find((itemResult) => !itemResult.ok);

  const createdEventQuotationId = purchaseQuotationId || eventQuotationId;
  if (createdEventQuotationId) {
    recordSupplierQuoteEvent({
      quotationId: createdEventQuotationId,
      type: "sienge_created",
      title: "Cotacao criada no Sienge",
      description: "Cotacao criada via /v1/purchase-quotations.",
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
      description: "Itens da solicitacao foram vinculados junto com a criacao da cotacao.",
      metadata: {
        action: "attach-items",
        integrationKey: attachIntegrationKey,
        itemResults
      }
    });
  }

  return NextResponse.json({
    message: failedItem
      ? "Cotacao criada no Sienge, mas um ou mais itens nao foram vinculados."
      : "Cotacao criada no Sienge.",
    purchaseQuotationId,
    location: result.location,
    quotationPayload: attempts[attempts.length - 1].payload,
    itemPayloads: payloads,
    itemResults
  }, { status: failedItem ? 207 : 201 });
}
