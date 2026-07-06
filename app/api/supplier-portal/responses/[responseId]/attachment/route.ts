import { NextResponse } from "next/server";
import { loadSupplierQuoteAttachmentByResponse } from "@/lib/supplier-quote-portal";
import { attachmentFileResponse } from "@/lib/supplier-quote-attachment-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Rota protegida por sessão (o middleware só libera "/api/supplier-portal/responses" exato).
export async function GET(request: Request, { params }: { params: { responseId: string } }) {
  const responseId = Number(params.responseId);
  const quotationId = Number(new URL(request.url).searchParams.get("quotationId"));

  if (!Number.isFinite(responseId) || responseId <= 0 || !Number.isFinite(quotationId) || quotationId <= 0) {
    return NextResponse.json({ message: "Informe a cotação e a resposta do anexo." }, { status: 400 });
  }

  const attachment = loadSupplierQuoteAttachmentByResponse(quotationId, responseId);
  if (!attachment) {
    return NextResponse.json({ message: "Esta resposta não possui proposta anexada." }, { status: 404 });
  }

  return attachmentFileResponse(attachment);
}
