import "server-only";
import { NextResponse } from "next/server";
import type { SupplierQuoteProposalAttachment } from "@/lib/supplier-quote-portal";

// Converte o anexo guardado como data URL em uma resposta de download binária,
// com o content-type validado na gravação e o nome original preservado.
export function attachmentFileResponse(attachment: SupplierQuoteProposalAttachment) {
  const base64 = String(attachment.dataUrl || "").split(";base64,")[1] || "";
  const file = Buffer.from(base64, "base64");
  if (!file.length) {
    return NextResponse.json({ message: "Não foi possível ler o arquivo anexado." }, { status: 500 });
  }

  const asciiName = attachment.fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_") || "proposta";
  return new NextResponse(file, {
    status: 200,
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(file.length),
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
      "Cache-Control": "private, no-store"
    }
  });
}
