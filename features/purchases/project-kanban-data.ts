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
  quotationIds: number[];
  date?: string;
  requester?: string;
  notes?: string;
};
export type PurchaseProjectKanbanQuotation = {
  id: number;
  code: string;
  status: string;
  requestIds: number[];
  supplierCount: number;
  responseCount: number;
  date?: string;
};
export type PurchaseProjectKanbanData = {
  requests: PurchaseProjectKanbanRequest[];
  quotations: PurchaseProjectKanbanQuotation[];
  totalItems: number;
  warning?: string;
  error?: string;
};

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

function quotationStatus(supplierCount: number, responseCount: number, selected: boolean, hasQuotedValue: boolean) {
  if (supplierCount === 0) return "Sem fornecedores";
  if (selected) return "Negociação fechada";
  if (hasQuotedValue) return "Pronta para decisão";
  if (responseCount > 0) return "Em negociação";
  return "Registrada";
}

export async function loadPurchaseProjectKanbanData(): Promise<PurchaseProjectKanbanData> {
  const purchases = await loadPurchases();
  const headers = readPurchaseRequestHeaders();
  const origins = loadSupplierQuoteRequestOrigins();
  const activeQuotationIds = new Set(purchases.quotations.map((quotation) => quotation.purchaseQuotationId));
  const quotationIdsByRequest = new Map<number, number[]>();
  origins.forEach((requestIds, quotationId) => {
    if (!activeQuotationIds.has(quotationId)) return;
    requestIds.forEach((requestId) => quotationIdsByRequest.set(requestId, [...(quotationIdsByRequest.get(requestId) || []), quotationId]));
  });
  const groups = groupRequestItems(purchases.requestItems);
  const requests = Array.from(groups, ([requestId, items]) => {
    const header = headers.get(requestId);
    return {
      id: requestId,
      code: `SC-${requestId}`,
      status: header?.status ? requestStatusLabels[header.status] || header.status : statusFromItems(items),
      itemCount: items.length,
      quotationCount: quotationIdsByRequest.get(requestId)?.length || 0,
      quotationIds: quotationIdsByRequest.get(requestId)?.sort((left, right) => right - left) || [],
      date: header?.requestDate || items[0]?.__siengeIntegratedAt?.slice(0, 10),
      requester: header?.requesterUser,
      notes: header?.notes?.trim() || undefined
    } satisfies PurchaseProjectKanbanRequest;
  }).sort((left, right) => right.id - left.id);
  const quotations = purchases.quotations.map((quotation) => {
    const suppliers = quotation.purchaseQuotationSuppliers || [];
    const responseCount = suppliers.filter((supplier) => (supplier.negotiations || []).length > 0).length;
    const selected = suppliers.some((supplier) => (supplier.negotiations || []).some((negotiation) =>
      (negotiation.negotiationItems || []).some((item) => item.selectedOption)
    ));
    const hasQuotedValue = suppliers.some((supplier) => (supplier.negotiations || []).some((negotiation) =>
      Number(negotiation.totalValue) > 0 || (negotiation.negotiationItems || []).some((item) => Number(item.unitPrice) > 0 || Number(item.totalValue) > 0)
    ));
    return {
      id: quotation.purchaseQuotationId,
      code: `COT-${quotation.purchaseQuotationId}`,
      status: quotationStatus(suppliers.length, responseCount, selected, hasQuotedValue),
      requestIds: [...(origins.get(quotation.purchaseQuotationId) || [])],
      supplierCount: suppliers.length,
      responseCount,
      date: quotation.purchaseQuotationDate || quotation.registeredDate
    } satisfies PurchaseProjectKanbanQuotation;
  }).sort((left, right) => right.id - left.id);
  return { requests, quotations, totalItems: purchases.requestItems.length, warning: purchases.warning, error: purchases.error?.explanation || purchases.error?.title };
}
