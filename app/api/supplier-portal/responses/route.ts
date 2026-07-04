import { NextResponse } from "next/server";
import { hasSupplierQuoteResponse, saveSupplierQuoteResponse, verifyActiveSupplierQuoteToken, type SupplierQuoteResponseInput } from "@/lib/supplier-quote-portal";
import { searchLocalSuppliers } from "@/features/suppliers/data";
import { loadQuotationDetail } from "@/features/quotations/data";
import { clientIp, rateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const maxBodyBytes = 128 * 1024;

function text(value: unknown, max = 160) {
  return String(value || "").trim().slice(0, max);
}

function validDocument(value: string) {
  return value.length === 11 || value.length === 14;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export async function POST(request: Request) {
  try {
    if (rateLimited(`supplier-responses:${clientIp(request)}`, 20, 10 * 60 * 1000)
      || rateLimited("supplier-responses:global", 200, 10 * 60 * 1000)) {
      return NextResponse.json({ message: "Muitos envios em sequência. Aguarde alguns minutos." }, { status: 429 });
    }

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > maxBodyBytes) {
      return NextResponse.json({ message: "Payload muito grande." }, { status: 413 });
    }

    const input = await request.json().catch(() => ({})) as SupplierQuoteResponseInput;
    const payload = verifyActiveSupplierQuoteToken(input.token || "");
    if (!payload) {
      return NextResponse.json({ message: "Link inválido, expirado ou revogado." }, { status: 401 });
    }

    if (hasSupplierQuoteResponse(input.token || "")) {
      return NextResponse.json({ message: "Este link já foi utilizado para enviar uma proposta. Solicite um novo link ao comprador para enviar uma revisão." }, { status: 409 });
    }

    const document = String(input.document || "").replace(/\D/g, "");
    const email = text(input.email, 160);
    const phone = text(input.phone, 40);
    const tokenDocument = payload.document?.replace(/\D/g, "") || "";
    if (!text(input.supplierName) || !validDocument(document)) {
      return NextResponse.json({ message: "Informe nome e CPF/CNPJ válido para enviar a proposta." }, { status: 400 });
    }

    if (!validEmail(email) || !validPhone(phone)) {
      return NextResponse.json({ message: "Informe e-mail válido e telefone com DDD para enviar a proposta." }, { status: 400 });
    }

    if (tokenDocument && tokenDocument !== document) {
      return NextResponse.json({ message: "Documento não corresponde ao link da cotação." }, { status: 403 });
    }

    const quotedItems = (input.items || []).filter((item) => item.attends);
    if (!quotedItems.length) {
      return NextResponse.json({ message: "Marque ao menos um item atendido para enviar a proposta." }, { status: 400 });
    }

    const quotation = await loadQuotationDetail(payload.quotationId);
    if (!quotation) {
      return NextResponse.json({ message: "Cotação não encontrada." }, { status: 404 });
    }

    const allowedItems = new Set(quotation.items.map((item) => item.itemNumber));
    const safeItems = (input.items || [])
      .filter((item) => allowedItems.has(item.itemNumber))
      .slice(0, quotation.items.length)
      .map((item) => ({
        itemNumber: item.itemNumber,
        attends: item.attends === true,
        unitPrice: Math.max(0, Math.min(999999999, Number(item.unitPrice || 0))),
        quantity: Math.max(0, Math.min(999999999, Number(item.quantity || 0))),
        deadlineDays: Math.max(0, Math.min(3650, Math.round(Number(item.deadlineDays || 0)))),
        notes: text(item.notes, 500)
      }));

    if (!safeItems.some((item) => item.attends && item.unitPrice > 0 && item.quantity > 0)) {
      return NextResponse.json({ message: "Informe valor e quantidade dos itens atendidos." }, { status: 400 });
    }

    const localSupplier = searchLocalSuppliers(document, 1).suppliers[0];
    const saved = saveSupplierQuoteResponse({
      ...input,
      supplierName: text(input.supplierName),
      document,
      email,
      phone,
      registration: localSupplier ? undefined : input.registration
        ? {
            tradeName: text(input.registration.tradeName, 160),
            city: text(input.registration.city, 80),
            state: text(input.registration.state, 2).toUpperCase()
          }
        : undefined,
      items: safeItems
    }, {
      ...payload,
      supplierId: payload.supplierId || localSupplier?.id
    });

    return NextResponse.json({
      message: "Proposta enviada com sucesso.",
      responseId: saved.id,
      createdAt: saved.createdAt,
      supplierFound: Boolean(localSupplier),
      supplierId: payload.supplierId || localSupplier?.id,
      registrationPending: !localSupplier
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível salvar a proposta.";
    return NextResponse.json({ message }, { status: message.includes("já foi utilizado") ? 409 : 500 });
  }
}
