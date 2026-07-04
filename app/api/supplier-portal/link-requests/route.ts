import { NextResponse } from "next/server";
import { loadSupplierQuoteResponseByToken, recordSupplierQuoteEvent } from "@/lib/supplier-quote-portal";
import { clientIp, rateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (rateLimited(`supplier-link-request:${clientIp(request)}`, 8, 10 * 60 * 1000)) {
    return NextResponse.json({ message: "Muitas solicitações em sequência. Aguarde alguns minutos." }, { status: 429 });
  }

  const input = await request.json().catch(() => ({})) as { token?: string };
  const response = loadSupplierQuoteResponseByToken(input.token || "");
  if (!response) {
    return NextResponse.json({ message: "Não foi possível localizar a proposta enviada por este link." }, { status: 404 });
  }

  recordSupplierQuoteEvent({
    quotationId: response.quotationId,
    type: "link_requested",
    title: "Fornecedor solicitou novo link",
    description: "O fornecedor abriu a proposta já enviada e solicitou um novo link para revisão.",
    supplierName: response.supplierName,
    document: response.document,
    metadata: { responseId: response.id, requestedFrom: "supplier-portal" }
  });

  return NextResponse.json({ ok: true, message: "Solicitação enviada para a equipe de compras." });
}
