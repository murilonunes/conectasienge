import "server-only";
import type { PurchaseRequestHeader } from "@/features/purchases/request-headers";
import type { PurchaseQuotation, PurchaseRequestItem } from "@/features/purchases/types";
import { isPurchaseDateVisible } from "@/lib/settings";

export function filterPurchaseRequestItemsByCutoff(
  items: PurchaseRequestItem[],
  headers: Map<number, PurchaseRequestHeader>,
  cutoffDate: string
) {
  if (!cutoffDate) return items;
  const visibleRequests = new Map<number, boolean>();
  return items.filter((item) => {
    if (!visibleRequests.has(item.purchaseRequestId)) {
      visibleRequests.set(item.purchaseRequestId, isPurchaseDateVisible(headers.get(item.purchaseRequestId)?.requestDate, cutoffDate));
    }
    return visibleRequests.get(item.purchaseRequestId);
  });
}

export function filterPurchaseQuotationsByCutoff(quotations: PurchaseQuotation[], cutoffDate: string) {
  if (!cutoffDate) return quotations;
  return quotations.filter((quotation) => isPurchaseDateVisible(quotation.purchaseQuotationDate || quotation.registeredDate, cutoffDate));
}
