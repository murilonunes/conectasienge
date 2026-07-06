import { NextResponse } from "next/server";
import { hasSupplierQuoteResponse, saveSupplierQuoteResponse, verifyActiveSupplierQuoteToken, type SupplierQuoteResponseInput } from "@/lib/supplier-quote-portal";
import { getLocalSupplierById, searchLocalSuppliers, type SupplierDirectoryItem } from "@/features/suppliers/data";
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

function validEmailOrUndefined(value?: string) {
  const email = text(value, 160);
  return validEmail(email) ? email : undefined;
}

function validPhoneOrUndefined(value?: string) {
  const phone = text(value, 40);
  return validPhone(phone) ? phone : undefined;
}

function sameText(left?: string, right?: string) {
  return String(left || "").trim().toLocaleLowerCase("pt-BR") === String(right || "").trim().toLocaleLowerCase("pt-BR");
}

function sameDigits(left?: string, right?: string) {
  return String(left || "").replace(/\D/g, "") === String(right || "").replace(/\D/g, "");
}

function supplierFromPayload(payload: NonNullable<ReturnType<typeof verifyActiveSupplierQuoteToken>>) {
  const localSupplier = payload.supplierId
    ? getLocalSupplierById(payload.supplierId)
    : payload.document
      ? searchLocalSuppliers(payload.document, 1).suppliers[0]
      : undefined;

  return {
    localSupplier,
    supplierId: payload.supplierId || localSupplier?.id,
    supplierName: payload.supplierName || localSupplier?.name,
    document: payload.document || localSupplier?.document,
    email: validEmailOrUndefined(payload.email || localSupplier?.email),
    phone: validPhoneOrUndefined(payload.phone || localSupplier?.phone),
    locked: Boolean(payload.supplierId || payload.supplierName || payload.document)
  };
}

function lockedIdentityViolation(
  lockedSupplier: ReturnType<typeof supplierFromPayload>,
  input: { supplierName: string; document: string; email: string; phone: string }
) {
  if (!lockedSupplier.locked) return "";
  if (lockedSupplier.document && !sameDigits(lockedSupplier.document, input.document)) return "Documento nao corresponde ao fornecedor definido neste link.";
  if (lockedSupplier.supplierName && !sameText(lockedSupplier.supplierName, input.supplierName)) return "Razao social/nome nao corresponde ao fornecedor definido neste link.";
  if (lockedSupplier.email && !sameText(lockedSupplier.email, input.email)) return "E-mail nao corresponde ao fornecedor definido neste link.";
  if (lockedSupplier.phone && !sameDigits(lockedSupplier.phone, input.phone)) return "Telefone nao corresponde ao fornecedor definido neste link.";
  return "";
}

function validFreightType(value: unknown) {
  return value === "INCLUDED" || value === "PAID" || value === "NONE";
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
    const lockedSupplier = supplierFromPayload(payload);
    const tokenDocument = lockedSupplier.document?.replace(/\D/g, "") || payload.document?.replace(/\D/g, "") || "";
    if (!text(input.supplierName) || !validDocument(document)) {
      return NextResponse.json({ message: "Informe nome e CPF/CNPJ válido para enviar a proposta." }, { status: 400 });
    }

    if (!validEmail(email) || !validPhone(phone)) {
      return NextResponse.json({ message: "Informe e-mail válido e telefone com DDD para enviar a proposta." }, { status: 400 });
    }

    const commercialTerms = input.commercialTerms || {};
    const deliveryDays = Math.round(Number(commercialTerms.deliveryDays) || 0);
    if (!validFreightType(commercialTerms.freightType) || deliveryDays <= 0) {
      return NextResponse.json({ message: "Escolha uma opção de frete e informe o prazo geral de entrega." }, { status: 400 });
    }

    if (commercialTerms.freightType === "PAID" && Number(commercialTerms.freightPrice || 0) <= 0) {
      return NextResponse.json({ message: "Informe o valor do frete a pagar." }, { status: 400 });
    }

    if (commercialTerms.offersCash === false && commercialTerms.offersTerm !== true) {
      return NextResponse.json({ message: "Marque ao menos uma forma de pagamento: à vista, a prazo ou as duas." }, { status: 400 });
    }

    if (commercialTerms.offersTerm === true) {
      const installments = Array.isArray(commercialTerms.installments) ? commercialTerms.installments : [];
      const totalPercentage = installments.reduce((sum, installment) => sum + (Number(installment?.percentage) || 0), 0);
      if (!installments.length || Math.abs(totalPercentage - 100) >= 0.01) {
        return NextResponse.json({ message: "As parcelas do pagamento a prazo devem somar 100% do valor." }, { status: 400 });
      }
    }

    if (tokenDocument && tokenDocument !== document) {
      return NextResponse.json({ message: "Documento não corresponde ao link da cotação." }, { status: 403 });
    }
    const identityViolation = lockedIdentityViolation(lockedSupplier, {
      supplierName: text(input.supplierName),
      document,
      email,
      phone
    });
    if (identityViolation) {
      return NextResponse.json({ message: identityViolation }, { status: 403 });
    }

    const quotedItems = (input.items || []).filter((item) => item.attends);
    if (!quotedItems.length) {
      return NextResponse.json({ message: "Marque ao menos um item atendido para enviar a proposta." }, { status: 400 });
    }

    const quotation = await loadQuotationDetail(payload.quotationId);
    if (!quotation) {
      return NextResponse.json({ message: "Cotação não encontrada." }, { status: 404 });
    }

    const quotationItems = new Map(quotation.items.map((item) => [item.itemNumber, item]));
    const allowedItems = new Set(quotation.items.map((item) => item.itemNumber));
    const invalidQuantityItem = (input.items || []).find((item) => {
      if (!item.attends) return false;
      const quotationItem = quotationItems.get(item.itemNumber);
      const requestedQuantity = Number(quotationItem?.quantity || 0);
      const quantity = Number(item.quantity || 0);
      if (requestedQuantity <= 0 || quantity <= 0) return true;
      if (quantity > requestedQuantity) return true;
      if (item.partial === true) return quantity >= requestedQuantity;
      return quantity !== requestedQuantity;
    });
    if (invalidQuantityItem) {
      return NextResponse.json({
        message: "A quantidade informada deve ser igual à solicitada ou menor apenas quando o item estiver marcado como parcial."
      }, { status: 400 });
    }

    const safeItems = (input.items || [])
      .filter((item) => allowedItems.has(item.itemNumber))
      .slice(0, quotation.items.length)
      .map((item) => ({
        itemNumber: item.itemNumber,
        attends: item.attends === true,
        partial: item.partial === true,
        unitPrice: Math.max(0, Math.min(999999999, Number(item.unitPrice || 0))),
        quantity: Math.max(0, Math.min(999999999, Number(item.quantity || 0))),
        deadlineDays: Math.max(0, Math.min(3650, Math.round(Number(item.deadlineDays || 0)))),
        notes: text(item.notes, 500)
      }));

    if (!safeItems.some((item) => item.attends && item.unitPrice > 0 && item.quantity > 0)) {
      return NextResponse.json({ message: "Informe valor e quantidade dos itens atendidos." }, { status: 400 });
    }

    const localSupplier: SupplierDirectoryItem | undefined = lockedSupplier.localSupplier || searchLocalSuppliers(document, 1).suppliers[0];
    const finalSupplierName = lockedSupplier.supplierName || text(input.supplierName);
    const finalDocument = (lockedSupplier.document || document).replace(/\D/g, "");
    const finalEmail = lockedSupplier.email || email;
    const finalPhone = lockedSupplier.phone || phone;
    const saved = saveSupplierQuoteResponse({
      ...input,
      supplierName: finalSupplierName,
      document: finalDocument,
      email: finalEmail,
      phone: finalPhone,
      commercialTerms: {
        ...commercialTerms,
        freightType: commercialTerms.freightType,
        deliveryDays
      },
      // Sem fornecedor na base local, o bloco de cadastro é sempre gravado (mesmo
      // vazio): é ele que marca a resposta como pendente na aba Cadastros.
      registration: localSupplier ? undefined : {
        tradeName: text(input.registration?.tradeName, 160),
        city: text(input.registration?.city, 80),
        state: text(input.registration?.state, 2).toUpperCase()
      },
      items: safeItems
    }, {
      ...payload,
      supplierId: lockedSupplier.supplierId || localSupplier?.id
    });

    return NextResponse.json({
      message: "Proposta enviada com sucesso.",
      responseId: saved.id,
      createdAt: saved.createdAt,
      // Link travado não significa cadastro existente: sem fornecedor na base
      // local, a resposta precisa aparecer na aba Cadastros para criação no Sienge.
      supplierFound: Boolean(localSupplier),
      supplierId: lockedSupplier.supplierId || localSupplier?.id,
      registrationPending: !localSupplier
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível salvar a proposta.";
    return NextResponse.json({ message }, { status: message.includes("já foi utilizado") ? 409 : 500 });
  }
}
