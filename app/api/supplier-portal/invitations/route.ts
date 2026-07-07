import { NextResponse } from "next/server";
import { guardPermission } from "@/lib/app-users";
import { loadQuotationDetail } from "@/features/quotations/data";
import { getLocalSupplierById, searchLocalSuppliers } from "@/features/suppliers/data";
import { cappedExpiresInDays, quotationClosedForResponses, quotationDeadlineEnd } from "@/lib/quotation-deadline";
import { createSupplierQuoteToken, loadSupplierQuoteInvitations, revokeSupplierQuoteInvitation, saveSupplierQuoteInvitation, verifySupplierQuoteToken } from "@/lib/supplier-quote-portal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const quotationId = Number(searchParams.get("quotationId"));

  if (!Number.isFinite(quotationId) || quotationId <= 0) {
    return NextResponse.json({ message: "Informe uma cotação válida." }, { status: 400 });
  }

  return NextResponse.json({ invitations: loadSupplierQuoteInvitations(quotationId) });
}

export async function POST(request: Request) {
  try {
    const guard = guardPermission(request, "quotations.manage");
    if (!guard.user || guard.status) {
      return NextResponse.json({ message: guard.message }, { status: guard.status || 403 });
    }

    const input = await request.json().catch(() => ({})) as {
      quotationId?: number;
      supplierId?: number;
      supplierName?: string;
      document?: string;
      email?: string;
      phone?: string;
      expiresInDays?: number;
    };
    const quotationId = Number(input.quotationId);
    if (!Number.isFinite(quotationId) || quotationId <= 0) {
      return NextResponse.json({ message: "Informe uma cotação válida para gerar o link." }, { status: 400 });
    }

    // O prazo da cotação governa os convites: cotação encerrada não gera link
    // novo, e a validade do link nunca passa do fim do prazo.
    const quotation = await loadQuotationDetail(quotationId);
    if (quotationClosedForResponses(quotation?.deadline)) {
      const deadlineEnd = quotationDeadlineEnd(quotation?.deadline);
      return NextResponse.json({
        message: `O prazo desta cotação encerrou em ${deadlineEnd?.toLocaleDateString("pt-BR")}. Ajuste o prazo no Sienge e atualize o espelho local para voltar a gerar links.`
      }, { status: 409 });
    }

    const expiresInDays = cappedExpiresInDays(Number(input.expiresInDays), quotation?.deadline);
    const supplierId = Number(input.supplierId) || undefined;
    const inputDocument = input.document?.replace(/\D/g, "") || undefined;
    const localSupplier = supplierId
      ? getLocalSupplierById(supplierId)
      : inputDocument
        ? searchLocalSuppliers(inputDocument, 1).suppliers[0]
        : undefined;
    const supplierName = input.supplierName?.trim() || localSupplier?.name;
    const document = inputDocument || localSupplier?.document;
    const email = input.email?.trim() || localSupplier?.email;
    const phone = input.phone?.trim() || localSupplier?.phone;

    const token = createSupplierQuoteToken({
      quotationId,
      supplierId,
      supplierName,
      document,
      email,
      phone,
      expiresInDays
    });
    const origin = new URL(request.url).origin;
    const payload = verifySupplierQuoteToken(token);
    if (!payload) {
      return NextResponse.json({ message: "Não foi possível validar o token gerado." }, { status: 500 });
    }
    const url = `${origin}/portal-cotacao/${token}`;
    const invitation = saveSupplierQuoteInvitation({
      token,
      url,
      quotationId,
      supplierId,
      supplierName,
      document,
      expiresAt: new Date(payload.exp * 1000).toISOString()
    });

    return NextResponse.json({
      token,
      url,
      expiresInDays,
      invitation
    });
  } catch (error) {
    return NextResponse.json({
      message: error instanceof Error ? error.message : "Não foi possível gerar o link."
    }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const guard = guardPermission(request, "quotations.manage");
    if (!guard.user || guard.status) {
      return NextResponse.json({ message: guard.message }, { status: guard.status || 403 });
    }

    const input = await request.json().catch(() => ({})) as { quotationId?: number; invitationId?: number };
    const quotationId = Number(input.quotationId);
    const invitationId = Number(input.invitationId);

    if (!Number.isFinite(quotationId) || quotationId <= 0 || !Number.isFinite(invitationId) || invitationId <= 0) {
      return NextResponse.json({ message: "Informe a cotação e o link a revogar." }, { status: 400 });
    }

    const invitations = revokeSupplierQuoteInvitation(quotationId, invitationId);
    return NextResponse.json({ ok: true, invitations });
  } catch (error) {
    return NextResponse.json({
      message: error instanceof Error ? error.message : "Não foi possível revogar o link."
    }, { status: 500 });
  }
}
