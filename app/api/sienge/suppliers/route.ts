import { NextResponse } from "next/server";
import { credoresApi } from "@/lib/api/financeiro";
import { SiengeApiError } from "@/lib/api/sienge";
import { searchLocalSuppliers } from "@/features/suppliers/data";
import { findSupplierQuoteIntegrationByKey, recordSupplierQuoteEvent } from "@/lib/supplier-quote-portal";

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

function creditorDocument(record: CreditorRecord) {
  return cleanDocument(record.cnpj || record.cpf || record.document || record.documentNumber || record.taxId);
}

function creditorSummary(record: CreditorRecord) {
  return {
    id: record.id ?? record.creditorId,
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
      const message = "Nao foi possivel consultar credores no Sienge antes da criacao.";
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

    if (preflight?.exists && input.force !== true) {
      return NextResponse.json({
        message: "Fornecedor ja localizado no Sienge pelo mesmo documento. Nada foi enviado agora para evitar cadastro duplicado.",
        alreadyExistsInSienge: true,
        preflight
      }, { status: 409 });
    }

    const integrationKey = `create-supplier:${eventDocument}`;
    if (input.force !== true) {
      const existing = findSupplierQuoteIntegrationByKey(integrationKey);
      if (existing) {
        return NextResponse.json({
          message: `Este fornecedor já foi criado no Sienge em ${existing.createdAt.slice(0, 10)}. Nada foi enviado agora para evitar cadastro duplicado.`,
          alreadyIntegrated: true,
          integration: { eventId: existing.id, title: existing.title, createdAt: existing.createdAt }
        }, { status: 409 });
      }
    }

    const created = await credoresApi.create(payload);
    if (quotationId) {
      recordSupplierQuoteEvent({
        quotationId,
        type: "sienge_created",
        title: "Fornecedor criado no Sienge",
        description: "Cadastro enviado para /v1/creditors.",
        supplierName: payload.name,
        document: payload.cnpj || payload.cpf,
        metadata: { action: "create-supplier", integrationKey, endpoint: "/v1/creditors", preflight, created }
      });
    }
    return NextResponse.json({
      message: "Fornecedor criado no Sienge. Atualize Fornecedores em Configurações para aparecer na busca local.",
      preflight,
      payload,
      created
    }, { status: 201 });
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
