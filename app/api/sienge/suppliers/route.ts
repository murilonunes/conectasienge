import { NextResponse } from "next/server";
import { credoresApi } from "@/lib/api/financeiro";
import { SiengeApiError } from "@/lib/api/sienge";
import { searchLocalSuppliers } from "@/features/suppliers/data";
import { guardPermission } from "@/lib/app-users";
import {
  findSupplierQuoteIntegrationByKey,
  linkSupplierQuoteSupplier,
  recordSupplierQuoteEvent,
  saveSupplierRegistrationReview
} from "@/lib/supplier-quote-portal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requiredCreateFields = ["name"] as const;
type CreditorRecord = Record<string, unknown>;

function supplierPayload(input: Record<string, unknown>) {
  const type = String(input.type || "JURIDICA").trim();
  return {
    name: String(input.name || "").trim(),
    tradeName: String(input.tradeName || "").trim() || undefined,
    type,
    cnpj: String(input.cnpj || "").replace(/\D/g, "") || undefined,
    cpf: String(input.cpf || "").replace(/\D/g, "") || undefined,
    email: String(input.email || "").trim() || undefined,
    phone: String(input.phone || "").trim() || undefined,
    active: input.active !== false
  };
}

function cleanDocument(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function positiveId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function creditorDocument(record: CreditorRecord) {
  return cleanDocument(record.cnpj || record.cpf || record.document || record.documentNumber || record.taxId);
}

function creditorSummary(record: CreditorRecord) {
  return {
    id: positiveId(record.id) ?? positiveId(record.creditorId),
    name: record.name ?? record.corporateName ?? record.companyName ?? record.creditorName,
    tradeName: record.tradeName ?? record.fantasyName,
    cnpj: record.cnpj,
    cpf: record.cpf,
    document: record.document ?? record.documentNumber ?? record.taxId,
    city: record.city,
    state: record.state ?? record.uf,
    active: record.active
  };
}

function creditorIdFrom(value: unknown): number | undefined {
  const direct = positiveId(value);
  if (direct) return direct;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as CreditorRecord;
  return positiveId(record.id)
    ?? positiveId(record.creditorId)
    ?? creditorIdFrom(record.data)
    ?? creditorIdFrom(record.result);
}

function linkQuotationSupplier(input: {
  quotationId?: number;
  supplierId: number;
  document: string;
  supplierName: string;
  source: "existing" | "created";
}) {
  if (!input.quotationId) return undefined;
  const link = linkSupplierQuoteSupplier({
    quotationId: input.quotationId,
    supplierId: input.supplierId,
    document: input.document
  });
  const reviewResult = {
    supplierId: input.supplierId,
    supplierName: input.supplierName,
    source: input.source,
    link
  };
  const review = saveSupplierRegistrationReview({
    document: input.document,
    status: link.responsesUpdated > 0 ? "created" : "prepared",
    result: reviewResult
  });
  return { link, review };
}

function proposalWasLinked(localLink: ReturnType<typeof linkQuotationSupplier>) {
  return Boolean(localLink && localLink.link.responsesUpdated > 0);
}

async function findExistingCreditor(payload: ReturnType<typeof supplierPayload>) {
  const document = payload.cnpj || payload.cpf || "";
  const filters = payload.cnpj
    ? { cnpj: payload.cnpj, limit: 10 }
    : { cpf: payload.cpf, limit: 10 };
  const page = await credoresApi.list<CreditorRecord>(filters, true, true);
  const results = Array.isArray(page.results) ? page.results : [];
  const exact = results.find((record) => creditorDocument(record) === document);
  return {
    endpoint: "/v1/creditors",
    filters,
    checkedAt: new Date().toISOString(),
    exists: Boolean(exact),
    creditor: exact ? creditorSummary(exact) : undefined,
    resultCount: results.length
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams.get("q") || "";
  const limit = Number(url.searchParams.get("limit") || 20);
  return NextResponse.json(searchLocalSuppliers(search, Number.isFinite(limit) ? limit : 20));
}

export async function POST(request: Request) {
  let quotationId: number | undefined;
  let eventDocument = "";
  let eventName = "";
  try {
    const input = await request.json().catch(() => ({})) as Record<string, unknown>;
    const confirm = input.confirm === true;
    if (confirm) {
      const guard = guardPermission(request, "sienge.write");
      if (!guard.user || guard.status) {
        return NextResponse.json({ message: guard.message }, { status: guard.status || 403 });
      }
    }
    quotationId = Number(input.quotationId) || undefined;
    const payload = supplierPayload(input);
    eventDocument = payload.cnpj || payload.cpf || "";
    eventName = payload.name;
    const missing = requiredCreateFields.filter((field) => !payload[field]);

    if (missing.length) {
      return NextResponse.json({ message: `Campos obrigatórios ausentes: ${missing.join(", ")}` }, { status: 400 });
    }

    if (!payload.cnpj && !payload.cpf) {
      return NextResponse.json({ message: "Informe CNPJ ou CPF para criar o fornecedor no Sienge." }, { status: 400 });
    }

    let preflight: Awaited<ReturnType<typeof findExistingCreditor>> | undefined;
    try {
      preflight = await findExistingCreditor(payload);
    } catch (error) {
      const message = "Não foi possível consultar credores no Sienge antes da criação.";
      if (confirm) {
        return NextResponse.json({
          message: `${message} Nada foi enviado.`,
          preflightError: error instanceof SiengeApiError ? error.details : error instanceof Error ? error.message : message
        }, { status: error instanceof SiengeApiError ? error.details.status || 502 : 502 });
      }
    }

    if (!confirm) {
      return NextResponse.json({
        mode: "dry-run",
        endpoint: "/v1/creditors",
        message: "Payload pronto para criação do fornecedor. Confirme para gravar no Sienge.",
        preflight,
        payload
      });
    }

    if (preflight?.exists) {
      const existingSupplierId = creditorIdFrom(preflight.creditor);
      if (!existingSupplierId) {
        return NextResponse.json({
          message: "O fornecedor existe no Sienge, mas a consulta não retornou um ID válido para vincular a proposta. Nada foi enviado.",
          alreadyExistsInSienge: true,
          preflight
        }, { status: 502 });
      }
      const localLink = linkQuotationSupplier({
        quotationId,
        supplierId: existingSupplierId,
        document: eventDocument,
        supplierName: eventName,
        source: "existing"
      });
      const linked = proposalWasLinked(localLink);
      const linkIntegrationKey = quotationId
        ? `link-supplier-registration:${quotationId}:${eventDocument}:${existingSupplierId}`
        : undefined;
      if (quotationId && linked && linkIntegrationKey && !findSupplierQuoteIntegrationByKey(linkIntegrationKey)) {
        recordSupplierQuoteEvent({
          quotationId,
          type: "sienge_created",
          title: "Fornecedor existente vinculado à proposta",
          description: "Credor localizado pelo documento e associado à resposta local sem criar cadastro duplicado.",
          supplierName: payload.name,
          document: eventDocument,
          metadata: {
            action: "link-supplier-registration",
            integrationKey: linkIntegrationKey,
            endpoint: "/v1/creditors",
            supplierId: existingSupplierId,
            preflight,
            localLink
          }
        });
      }
      return NextResponse.json({
        message: quotationId && linked
          ? "Fornecedor já existente no Sienge e vinculado à proposta."
          : quotationId
            ? "Fornecedor localizado no Sienge, mas nenhuma proposta pendente correspondente foi encontrada para vincular."
          : "Fornecedor já existente no Sienge. Nenhum cadastro duplicado foi criado.",
        alreadyExistsInSienge: true,
        linked,
        supplierId: existingSupplierId,
        supplier: preflight.creditor,
        preflight,
        ...localLink
      }, { status: quotationId && !linked ? 409 : 200 });
    }

    const integrationKey = `create-supplier:${eventDocument}`;
    const existing = findSupplierQuoteIntegrationByKey(integrationKey);
    if (existing) {
      return NextResponse.json({
        message: `Este fornecedor já foi criado no Sienge em ${existing.createdAt.slice(0, 10)}. Consulte novamente pelo documento para vincular o cadastro existente; uma segunda criação não será permitida.`,
        alreadyIntegrated: true,
        integration: { eventId: existing.id, title: existing.title, createdAt: existing.createdAt }
      }, { status: 409 });
    }

    const created = await credoresApi.create<unknown>(payload);
    let createdSupplierId = creditorIdFrom(created);
    let confirmedCreditor: Awaited<ReturnType<typeof findExistingCreditor>> | undefined;
    if (!createdSupplierId) {
      confirmedCreditor = await findExistingCreditor(payload);
      createdSupplierId = creditorIdFrom(confirmedCreditor.creditor);
    }
    const localLink = createdSupplierId
      ? linkQuotationSupplier({
          quotationId,
          supplierId: createdSupplierId,
          document: eventDocument,
          supplierName: eventName,
          source: "created"
        })
      : undefined;
    const linked = proposalWasLinked(localLink);
    if (quotationId) {
      recordSupplierQuoteEvent({
        quotationId,
        type: "sienge_created",
        title: "Fornecedor criado no Sienge",
        description: "Cadastro enviado para /v1/creditors.",
        supplierName: payload.name,
        document: payload.cnpj || payload.cpf,
        metadata: {
          action: "create-supplier",
          integrationKey,
          endpoint: "/v1/creditors",
          supplierId: createdSupplierId,
          preflight,
          confirmedCreditor,
          created,
          localLink
        }
      });
    }
    return NextResponse.json({
      message: createdSupplierId
        ? quotationId && linked
          ? "Fornecedor criado no Sienge e vinculado à proposta."
          : quotationId
            ? "Fornecedor criado no Sienge, mas nenhuma proposta pendente correspondente foi encontrada para vincular."
          : "Fornecedor criado no Sienge. Atualize Fornecedores em Configurações para aparecer na busca local."
        : "Fornecedor criado no Sienge, mas o ID ainda não apareceu na consulta. Atualize Fornecedores e tente apenas vincular o cadastro existente.",
      linked,
      supplierId: createdSupplierId,
      supplier: confirmedCreditor?.creditor,
      preflight,
      confirmedCreditor,
      payload,
      created,
      ...localLink
    }, { status: createdSupplierId && (!quotationId || linked) ? 201 : 202 });
  } catch (error) {
    if (quotationId) {
      recordSupplierQuoteEvent({
        quotationId,
        type: "integration_error",
        title: "Erro ao criar fornecedor no Sienge",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        supplierName: eventName,
        document: eventDocument,
        metadata: error instanceof SiengeApiError ? error.details : undefined
      });
    }
    if (error instanceof SiengeApiError) {
      return NextResponse.json(error.details, { status: error.details.status || 502 });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : "Erro inesperado." }, { status: 500 });
  }
}
