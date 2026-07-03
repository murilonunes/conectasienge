import { NextResponse } from "next/server";
import { searchLocalSuppliers } from "@/features/suppliers/data";
import { verifyActiveSupplierQuoteToken } from "@/lib/supplier-quote-portal";
import { clientIp, rateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (rateLimited(`supplier-lookup:${clientIp(request)}`, 30, 10 * 60 * 1000)
    || rateLimited("supplier-lookup:global", 300, 10 * 60 * 1000)) {
    return NextResponse.json({ message: "Muitas consultas em sequência. Aguarde alguns minutos." }, { status: 429 });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const payload = verifyActiveSupplierQuoteToken(token);
  if (!payload) {
    return NextResponse.json({ message: "Link inválido, expirado ou revogado." }, { status: 401 });
  }

  const requestedSearch = url.searchParams.get("q") || "";
  const tokenDocument = payload.document?.replace(/\D/g, "") || "";
  const requestedDocument = requestedSearch.replace(/\D/g, "");
  if (!tokenDocument && requestedDocument.length !== 11 && requestedDocument.length !== 14) {
    return NextResponse.json({ suppliers: [], total: 0 });
  }

  const search = tokenDocument || requestedDocument;
  const limit = Math.min(5, Math.max(1, Number(url.searchParams.get("limit") || 1) || 1));
  const result = searchLocalSuppliers(search, limit);

  const suppliers = result.suppliers
    .filter((supplier) => !tokenDocument || supplier.document?.replace(/\D/g, "") === tokenDocument)
    .map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      document: supplier.document,
      active: supplier.active
    }));

  return NextResponse.json({
    suppliers,
    total: suppliers.length,
    warning: result.warning
  });
}
