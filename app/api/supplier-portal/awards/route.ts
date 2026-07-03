import { NextResponse } from "next/server";
import { loadSupplierQuoteAwards, saveSupplierQuoteAwards, type SupplierQuoteAwardInput, type SupplierQuoteAwardScope } from "@/lib/supplier-quote-portal";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const quotationId = Number(searchParams.get("quotationId"));

  if (!Number.isFinite(quotationId) || quotationId <= 0) {
    return NextResponse.json({ message: "Informe uma cotação válida." }, { status: 400 });
  }

  return NextResponse.json({ awards: loadSupplierQuoteAwards(quotationId) });
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as {
      quotationId?: number;
      scope?: SupplierQuoteAwardScope;
      awards?: SupplierQuoteAwardInput[];
    };
    const quotationId = Number(input.quotationId);

    if (!Number.isFinite(quotationId) || quotationId <= 0) {
      return NextResponse.json({ message: "Informe uma cotação válida." }, { status: 400 });
    }
    if (input.scope !== "quotation" && input.scope !== "item") {
      return NextResponse.json({ message: "Informe se a aprovação é por cotação ou por item." }, { status: 400 });
    }
    if (!input.awards?.length) {
      return NextResponse.json({ message: "Selecione ao menos um fornecedor vencedor." }, { status: 400 });
    }

    const awards = saveSupplierQuoteAwards(quotationId, input.scope, input.awards);
    return NextResponse.json({ ok: true, awards });
  } catch (error) {
    return NextResponse.json({
      message: error instanceof Error ? error.message : "Não foi possível salvar a aprovação."
    }, { status: 500 });
  }
}
