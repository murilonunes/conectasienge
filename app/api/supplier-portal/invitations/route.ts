import { NextResponse } from "next/server";
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
    const input = await request.json().catch(() => ({})) as {
      quotationId?: number;
      supplierId?: number;
      supplierName?: string;
      document?: string;
      expiresInDays?: number;
    };
    const quotationId = Number(input.quotationId);
    if (!Number.isFinite(quotationId) || quotationId <= 0) {
      return NextResponse.json({ message: "Informe uma cotação válida para gerar o link." }, { status: 400 });
    }

    const expiresInDays = Number.isFinite(Number(input.expiresInDays)) && Number(input.expiresInDays) > 0
      ? Number(input.expiresInDays)
      : 7;

    const token = createSupplierQuoteToken({
      quotationId,
      supplierId: Number(input.supplierId) || undefined,
      document: input.document,
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
      supplierId: Number(input.supplierId) || undefined,
      supplierName: input.supplierName,
      document: input.document,
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
