import { NextRequest, NextResponse } from "next/server";
import { analyzePurchases, loadPurchases } from "@/features/purchases/data";
import type { PurchaseFlowItem } from "@/features/purchases/types";

export const dynamic = "force-dynamic";

function asPositiveInteger(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function slimPurchaseRecord(item: PurchaseFlowItem): PurchaseFlowItem {
  return {
    ...item,
    raw: {
      __siengeIntegrationDay: item.raw.__siengeIntegrationDay,
      __siengeIntegratedAt: item.raw.__siengeIntegratedAt
    } as PurchaseFlowItem["raw"]
  };
}

function matchesSearch(item: PurchaseFlowItem, search: string) {
  if (!search) return true;
  const text = [
    item.kindLabel,
    item.code,
    item.title,
    item.subtitle,
    item.status,
    item.buyer,
    item.supplier,
    item.building
  ].filter(Boolean).join(" ").toLowerCase();
  return text.includes(search);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = asPositiveInteger(params.get("page"), 1, 100000);
  const pageSize = asPositiveInteger(params.get("pageSize"), 100, 500);
  const search = String(params.get("search") || "").trim().toLowerCase();
  const kind = String(params.get("kind") || "");
  const status = String(params.get("status") || "");

  const result = await loadPurchases();
  if (result.error) {
    return NextResponse.json({ message: result.error.explanation || result.error.title }, { status: 404 });
  }

  const summary = analyzePurchases(result);
  const statuses = Array.from(new Set(summary.flow.map((item) => item.status))).sort();
  const filtered = summary.flow.filter((item) =>
    matchesSearch(item, search)
    && (!kind || item.kind === kind)
    && (!status || item.status === status)
  );
  const filteredCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize).map(slimPurchaseRecord);

  return NextResponse.json({
    items,
    totalRecords: summary.flow.length,
    filteredCount,
    totalAmount: filtered.reduce((sum, item) => sum + item.amount, 0),
    statuses,
    page: currentPage,
    pageSize,
    totalPages
  });
}
