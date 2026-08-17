import "server-only";
import type { PurchaseRequestItem } from "@/features/purchases/types";
import { loadPurchases } from "@/features/purchases/data";
import { readPurchaseRequestHeaders, requestStatusLabels } from "@/features/purchases/request-headers";
import { loadSupplierQuoteRequestOrigins } from "@/lib/supplier-quote-portal";

export type PurchaseProjectKanbanRequest = {
  id: number;
  code: string;
  status: string;
  itemCount: number;
  quotationCount: number;
  date?: string;
  requester?: string;
  notes?: string;
};
export type PurchaseProjectKanbanData = { requests: PurchaseProjectKanbanRequest[]; totalItems: number; warning?: string; error?: string };

function groupRequestItems(items: PurchaseRequestItem[]) {
  const groups = new Map<number, PurchaseRequestItem[]>();
  items.forEach((item) => groups.set(item.purchaseRequestId, [...(groups.get(item.purchaseRequestId) || []), item]));
  return groups;
}

function statusFromItems(items: PurchaseRequestItem[]) {
  if (items.some((item) => item.disapproved)) return "Reprovada";
  if (items.length > 0 && items.every((item) => item.authorized)) return "Autorizada";
  return "Pendente de autorização";
}

export async function loadPurchaseProjectKanbanData(): Promise<PurchaseProjectKanbanData> {
  const purchases = await loadPurchases();
  const headers = readPurchaseRequestHeaders();
  const origins = loadSupplierQuoteRequestOrigins();
  const activeQuotationIds = new Set(purchases.quotations.map((quotation) => quotation.purchaseQuotationId));
  const quotationCounts = new Map<number, number>();
  origins.forEach((requestIds, quotationId) => {
    if (!activeQuotationIds.has(quotationId)) return;
    requestIds.forEach((requestId) => quotationCounts.set(requestId, (quotationCounts.get(requestId) || 0) + 1));
  });
  const groups = groupRequestItems(purchases.requestItems);
  const requests = Array.from(groups, ([requestId, items]) => {
    const header = headers.get(requestId);
    return {
      id: requestId,
      code: `SC-${requestId}`,
      status: header?.status ? requestStatusLabels[header.status] || header.status : statusFromItems(items),
      itemCount: items.length,
      quotationCount: quotationCounts.get(requestId) || 0,
      date: header?.requestDate || items[0]?.__siengeIntegratedAt?.slice(0, 10),
      requester: header?.requesterUser,
      notes: header?.notes?.trim() || undefined
    } satisfies PurchaseProjectKanbanRequest;
  }).sort((left, right) => right.id - left.id);
  return { requests, totalItems: purchases.requestItems.length, warning: purchases.warning, error: purchases.error?.explanation || purchases.error?.title };
}
