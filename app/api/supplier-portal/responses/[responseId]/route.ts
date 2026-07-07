import { NextResponse } from "next/server";
import { guardPermission } from "@/lib/app-users";
import { deleteSupplierQuoteResponse, loadSupplierQuoteResponses } from "@/lib/supplier-quote-portal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Rota protegida por sessão (o middleware só libera "/api/supplier-portal/responses" exato).
export async function DELETE(request: Request, { params }: { params: { responseId: string } }) {
  try {
    const guard = guardPermission(request, "quotations.manage");
    if (!guard.user || guard.status) {
      return NextResponse.json({ message: guard.message }, { status: guard.status || 403 });
    }

    const responseId = Number(params.responseId);
    const quotationId = Number(new URL(request.url).searchParams.get("quotationId"));

    if (!Number.isFinite(responseId) || responseId <= 0 || !Number.isFinite(quotationId) || quotationId <= 0) {
      return NextResponse.json({ message: "Informe a cotação e a resposta a excluir." }, { status: 400 });
    }

    deleteSupplierQuoteResponse(quotationId, responseId);
    return NextResponse.json({ ok: true, responses: loadSupplierQuoteResponses(quotationId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível excluir a resposta.";
    return NextResponse.json({ message }, { status: message.includes("não encontrada") ? 404 : 500 });
  }
}
