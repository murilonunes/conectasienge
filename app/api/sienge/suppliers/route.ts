import { NextResponse } from "next/server";
import { credoresApi } from "@/lib/api/financeiro";
import { SiengeApiError } from "@/lib/api/sienge";
import { searchLocalSuppliers } from "@/features/suppliers/data";
import { recordSupplierQuoteEvent } from "@/lib/supplier-quote-portal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requiredCreateFields = ["name"] as const;

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

    if (!confirm) {
      return NextResponse.json({
        mode: "dry-run",
        endpoint: "/v1/creditors",
        message: "Payload pronto para criação do fornecedor. Confirme para gravar no Sienge.",
        payload
      });
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
        metadata: { endpoint: "/v1/creditors", created }
      });
    }
    return NextResponse.json({
      message: "Fornecedor criado no Sienge. Atualize Fornecedores em Configurações para aparecer na busca local.",
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
