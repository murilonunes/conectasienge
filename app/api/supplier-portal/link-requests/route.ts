import { NextResponse } from "next/server";
import { loadQuotationDetail } from "@/features/quotations/data";
import { cappedExpiresInDays, quotationClosedForResponses, quotationDeadlineEnd } from "@/lib/quotation-deadline";
import {
  createSupplierQuoteToken,
  isSupplierQuoteTokenRevoked,
  loadSupplierQuoteResponseByToken,
  recordSupplierQuoteEvent,
  saveSupplierQuoteInvitation,
  verifySupplierQuoteToken
} from "@/lib/supplier-quote-portal";
import { clientIp, rateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (rateLimited(`supplier-link-request:${clientIp(request)}`, 8, 10 * 60 * 1000)
    || rateLimited("supplier-link-request:global", 80, 10 * 60 * 1000)) {
    return NextResponse.json({ message: "Muitas solicitações em sequência. Aguarde alguns minutos." }, { status: 429 });
  }

  try {
    const input = await request.json().catch(() => ({})) as { token?: string };
    // Só quem possui um link já respondido (token existente na base) pode pedir
    // um novo — o hash de 256 bits do token funciona como prova de posse.
    const response = loadSupplierQuoteResponseByToken(input.token || "");
    if (!response) {
      return NextResponse.json({ message: "Não foi possível localizar a proposta enviada por este link." }, { status: 404 });
    }

    if (isSupplierQuoteTokenRevoked(input.token || "")) {
      return NextResponse.json({
        message: "Este link foi revogado pela equipe de compras. Entre em contato com o comprador para receber um novo."
      }, { status: 403 });
    }

    // Cotação com prazo encerrado não aceita revisão automática.
    const quotation = await loadQuotationDetail(response.quotationId);
    if (quotationClosedForResponses(quotation?.deadline)) {
      const deadlineEnd = quotationDeadlineEnd(quotation?.deadline);
      return NextResponse.json({
        message: `O prazo desta cotação encerrou em ${deadlineEnd?.toLocaleDateString("pt-BR")}. Entre em contato com o comprador para verificar uma prorrogação.`
      }, { status: 403 });
    }

    // Gera o novo link na hora, amarrado ao mesmo fornecedor e documento,
    // em vez de deixar a solicitação pendente para a equipe de compras.
    const token = createSupplierQuoteToken({
      quotationId: response.quotationId,
      supplierId: response.supplierId,
      supplierName: response.supplierName,
      document: response.document,
      email: response.email,
      phone: response.phone,
      expiresInDays: cappedExpiresInDays(7, quotation?.deadline)
    });
    const payload = verifySupplierQuoteToken(token);
    if (!payload) {
      return NextResponse.json({ message: "Não foi possível gerar o novo link. Tente novamente." }, { status: 500 });
    }

    const url = `${new URL(request.url).origin}/portal-cotacao/${token}`;
    const expiresAt = new Date(payload.exp * 1000).toISOString();
    const invitation = saveSupplierQuoteInvitation({
      token,
      url,
      quotationId: response.quotationId,
      supplierId: response.supplierId,
      supplierName: response.supplierName,
      document: response.document,
      expiresAt
    });

    recordSupplierQuoteEvent({
      quotationId: response.quotationId,
      type: "link_requested",
      title: "Fornecedor solicitou novo link",
      description: "Um novo link foi gerado automaticamente e entregue ao fornecedor no portal.",
      supplierName: response.supplierName,
      document: response.document,
      metadata: { responseId: response.id, invitationId: invitation.id, requestedFrom: "supplier-portal", automatic: true }
    });

    return NextResponse.json({
      ok: true,
      url,
      expiresAt,
      message: "Novo link gerado. Use-o para enviar a proposta revisada."
    });
  } catch (error) {
    return NextResponse.json({
      message: error instanceof Error ? error.message : "Não foi possível gerar o novo link."
    }, { status: 500 });
  }
}
