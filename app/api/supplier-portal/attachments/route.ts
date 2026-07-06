import { NextResponse } from "next/server";
import { hasSupplierQuoteResponse, loadSupplierQuoteAttachmentByToken, verifySupplierQuoteToken } from "@/lib/supplier-quote-portal";
import { attachmentFileResponse } from "@/lib/supplier-quote-attachment-response";
import { clientIp, rateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Download público do anexo pelo próprio fornecedor: exige o token do link que
// enviou a proposta (prova de posse), mesmo depois de expirado ou revogado.
export async function GET(request: Request) {
  if (rateLimited(`supplier-attachment:${clientIp(request)}`, 30, 10 * 60 * 1000)
    || rateLimited("supplier-attachment:global", 300, 10 * 60 * 1000)) {
    return NextResponse.json({ message: "Muitos downloads em sequência. Aguarde alguns minutos." }, { status: 429 });
  }

  const token = new URL(request.url).searchParams.get("token") || "";
  if (!verifySupplierQuoteToken(token) && !hasSupplierQuoteResponse(token)) {
    return NextResponse.json({ message: "Link inválido para baixar o anexo." }, { status: 401 });
  }

  const attachment = loadSupplierQuoteAttachmentByToken(token);
  if (!attachment) {
    return NextResponse.json({ message: "Este link não possui proposta anexada." }, { status: 404 });
  }

  return attachmentFileResponse(attachment);
}
