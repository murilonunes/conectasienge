import { NextResponse } from "next/server";
import { loadSupplierQuoteEvents } from "@/lib/supplier-quote-portal";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const quotationId = Number(searchParams.get("quotationId"));

  if (!Number.isFinite(quotationId) || quotationId <= 0) {
    return NextResponse.json({ message: "Informe uma cotação válida." }, { status: 400 });
  }

  return NextResponse.json({ events: loadSupplierQuoteEvents(quotationId) });
}
