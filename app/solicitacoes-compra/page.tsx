import { PurchaseRequestsPortal, type PurchaseRequestInput } from "@/components/purchases/purchase-requests-portal";
import { PageHeading } from "@/components/ui/page-heading";
import { loadPurchases } from "@/features/purchases/data";
import { readPurchaseRequestHeaders } from "@/features/purchases/request-headers";
import type { PurchaseRequestItem } from "@/features/purchases/types";
import { loadSupplierQuoteRequestOrigins } from "@/lib/supplier-quote-portal";

export const dynamic = "force-dynamic";

function statusFromItems(items: PurchaseRequestItem[]) {
  if (items.some((item) => item.disapproved)) return "Cancelada";
  if (items.length > 0 && items.every((item) => item.authorized)) return "Aprovada";
  return "Em aprovação";
}

function mapPurchaseRequests(
  items: PurchaseRequestItem[],
  requestHeaders: ReturnType<typeof readPurchaseRequestHeaders>
): PurchaseRequestInput[] {
  const groups = new Map<number, PurchaseRequestItem[]>();

  items.forEach((item) => {
    const current = groups.get(item.purchaseRequestId) || [];
    current.push(item);
    groups.set(item.purchaseRequestId, current);
  });

  return Array.from(groups.entries())
    .sort(([left], [right]) => right - left)
    .map(([purchaseRequestId, requestItems]) => ({
      id: `sienge-${purchaseRequestId}`,
      code: `SC-${purchaseRequestId}`,
      title: `Solicitação ${purchaseRequestId}`,
      requester: "Sienge",
      costCenter: "Dados integrados",
      priority: "Normal" as const,
      neededAt: "",
      status: statusFromItems(requestItems) as PurchaseRequestInput["status"],
      notes: requestHeaders.get(purchaseRequestId)?.notes?.trim() || "",
      createdAt: requestItems[0]?.__siengeIntegratedAt?.slice(0, 10) || "",
      source: "sienge" as const,
      items: requestItems.map((item) => ({
        id: `sienge-${purchaseRequestId}-${item.itemNumber}`,
        name: item.productDescription || `Produto ${item.productId || item.itemNumber}`,
        category: item.detailDescription || "",
        unit: item.unitySymbol || "un",
        quantity: item.quantity || 0,
        details: item.detailDescription || "",
        notes: item.notes?.trim() || ""
      }))
    }));
}

function countQuotationsByRequest(
  quotationIds: number[],
  origins: ReturnType<typeof loadSupplierQuoteRequestOrigins>
) {
  const activeQuotationIds = new Set(quotationIds);
  const counts: Record<number, number> = {};

  origins.forEach((requestIds, quotationId) => {
    if (!activeQuotationIds.has(quotationId)) return;
    requestIds.forEach((requestId) => {
      counts[requestId] = (counts[requestId] || 0) + 1;
    });
  });

  return counts;
}

export default async function PurchaseRequestsPage() {
  const purchases = await loadPurchases();
  const requestHeaders = readPurchaseRequestHeaders();
  const initialRequests = mapPurchaseRequests(purchases.requestItems, requestHeaders);
  const quotationCounts = countQuotationsByRequest(
    purchases.quotations.map((quotation) => quotation.purchaseQuotationId),
    loadSupplierQuoteRequestOrigins()
  );

  return (
    <>
      <PageHeading
        eyebrow="Solicitação de compra"
        title="Solicitações de compra"
        subtitle="Cadastre solicitações, acompanhe o status e exporte a lista de insumos para cotação."
      />

      <PurchaseRequestsPortal initialRequests={initialRequests} quotationCounts={quotationCounts} />
    </>
  );
}
