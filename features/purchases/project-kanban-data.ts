import "server-only";
import type { PurchaseRequestItem } from "@/features/purchases/types";
import { loadPurchases } from "@/features/purchases/data";
import { filterPurchaseQuotationsByCutoff, filterPurchaseRequestItemsByCutoff } from "@/features/purchases/purchase-cutoff";
import { readPurchaseRequestHeaders, requestStatusLabels } from "@/features/purchases/request-headers";
import { searchLocalSuppliers } from "@/features/suppliers/data";
import { loadSupplierQuoteRequestOrigins, loadSupplierQuoteResponses } from "@/lib/supplier-quote-portal";
import { getAppSettings } from "@/lib/settings";

export type PurchaseProjectKanbanItem = {
  number: number;
  productId?: number;
  description: string;
  detail?: string;
  quantity: number;
  unit?: string;
  notes?: string;
  deliveryDays?: number;
};

export type PurchaseProjectKanbanSupplier = {
  id?: number;
  name: string;
  responded: boolean;
  quotedItems: number;
  totalValue: number;
  selected: boolean;
  date?: string;
};

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
  items: PurchaseProjectKanbanItem[];
};
export type PurchaseProjectKanbanQuotation = {
  id: number;
  code: string;
  status: string;
  requestIds: number[];
  supplierCount: number;
  responseCount: number;
  date?: string;
  notes?: string;
  items: PurchaseProjectKanbanItem[];
  suppliers: PurchaseProjectKanbanSupplier[];
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

export async function loadPurchaseProjectKanbanData(projectRequestIds: number[] = []): Promise<PurchaseProjectKanbanData> {
  const purchases = await loadPurchases();
  const headers = readPurchaseRequestHeaders();
  const cutoffDate = getAppSettings().purchaseCutoffDate;
  const visibleRequestItems = filterPurchaseRequestItemsByCutoff(purchases.requestItems, headers, cutoffDate);
  const visibleQuotations = filterPurchaseQuotationsByCutoff(purchases.quotations, cutoffDate);
  const groups = groupRequestItems(visibleRequestItems);
  const visibleRequestIds = new Set(groups.keys());
  const origins = loadSupplierQuoteRequestOrigins();
  const projectRequestIdSet = new Set(projectRequestIds);
  const supplierNames = new Map<number, string>();
  try {
    searchLocalSuppliers("", 100000).suppliers.forEach((supplier) => supplierNames.set(supplier.id, supplier.name));
  } catch {
    // O diretório local pode ainda não ter sido sincronizado.
  }
  const activeQuotationIds = new Set(visibleQuotations.map((quotation) => quotation.purchaseQuotationId));
  const quotationIdsByRequest = new Map<number, number[]>();
  origins.forEach((requestIds, quotationId) => {
    if (!activeQuotationIds.has(quotationId)) return;
    requestIds.filter((requestId) => visibleRequestIds.has(requestId)).forEach((requestId) => quotationIdsByRequest.set(requestId, [...(quotationIdsByRequest.get(requestId) || []), quotationId]));
  });
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
      notes: header?.notes?.trim() || undefined,
      items: items.map((item) => ({
        number: item.itemNumber,
        productId: item.productId,
        description: item.productDescription?.trim() || `Item ${item.itemNumber}`,
        detail: item.detailDescription?.trim() || undefined,
        quantity: Number(item.quantity) || 0,
        unit: item.unitySymbol?.trim() || undefined,
        notes: item.notes?.trim() || undefined,
        deliveryDays: item.estimatedDeliveryTime
      }))
    } satisfies PurchaseProjectKanbanRequest;
  }).sort((left, right) => right.id - left.id);
  const quotations = visibleQuotations.map((quotation) => {
    const suppliers = quotation.purchaseQuotationSuppliers || [];
    const requestIds = [...(origins.get(quotation.purchaseQuotationId) || [])].filter((requestId) => visibleRequestIds.has(requestId));
    const portalResponses = requestIds.some((requestId) => projectRequestIdSet.has(requestId))
      ? loadSupplierQuoteResponses(quotation.purchaseQuotationId).filter((response) => !response.supersededByResponseId)
      : [];
    const responseRows = new Map<string, PurchaseProjectKanbanSupplier>();
    portalResponses.forEach((response) => {
      const key = response.supplierId ? `id:${response.supplierId}` : `name:${response.supplierName.trim().toLocaleLowerCase("pt-BR")}`;
      if (responseRows.has(key)) return;
      responseRows.set(key, {
        id: response.supplierId,
        name: response.supplierName,
        responded: true,
        quotedItems: response.attendedCount,
        totalValue: response.totalValue,
        selected: false,
        date: response.createdAt
      });
    });
    suppliers.forEach((supplier) => {
      const negotiations = [...(supplier.negotiations || [])].sort((left, right) => String(right.responseDate || right.registeredDate || "").localeCompare(String(left.responseDate || left.registeredDate || "")));
      const latest = negotiations[0];
      const supplierId = supplier.supplierId;
      const localName = supplierId ? supplierNames.get(supplierId) || "" : "";
      const idKey = supplierId ? `id:${supplierId}` : `sienge:${responseRows.size}`;
      const nameKey = localName ? `name:${localName.trim().toLocaleLowerCase("pt-BR")}` : "";
      const existingKey = responseRows.has(idKey) ? idKey : nameKey && responseRows.has(nameKey) ? nameKey : idKey;
      const existing = responseRows.get(existingKey);
      const negotiationItems = latest?.negotiationItems || [];
      const totalValue = Number(latest?.totalValue) || negotiationItems.reduce((sum, item) => sum + (Number(item.totalValue) || ((Number(item.unitPrice) || 0) * (Number(item.negotiatedQuantity || item.quotedQuantity) || 0))), 0);
      if (existingKey !== idKey) responseRows.delete(existingKey);
      responseRows.set(idKey, {
        id: supplierId,
        name: existing?.name || localName,
        responded: existing?.responded || Boolean(latest),
        quotedItems: Math.max(existing?.quotedItems || 0, negotiationItems.filter((item) => Number(item.unitPrice) > 0 || Number(item.totalValue) > 0).length),
        totalValue: existing?.totalValue || totalValue,
        selected: negotiations.some((negotiation) => (negotiation.negotiationItems || []).some((item) => item.selectedOption)),
        date: existing?.date || latest?.responseDate || latest?.registeredDate
      });
    });
    const supplierRows = Array.from(responseRows.values()).sort((left, right) => Number(right.selected) - Number(left.selected) || Number(right.responded) - Number(left.responded) || left.name.localeCompare(right.name));
    const responseCount = supplierRows.filter((supplier) => supplier.responded).length;
    const selected = suppliers.some((supplier) => (supplier.negotiations || []).some((negotiation) =>
      (negotiation.negotiationItems || []).some((item) => item.selectedOption)
    ));
    const hasQuotedValue = portalResponses.some((response) => response.totalValue > 0) || suppliers.some((supplier) => (supplier.negotiations || []).some((negotiation) =>
      Number(negotiation.totalValue) > 0 || (negotiation.negotiationItems || []).some((item) => Number(item.unitPrice) > 0 || Number(item.totalValue) > 0)
    ));
    return {
      id: quotation.purchaseQuotationId,
      code: `COT-${quotation.purchaseQuotationId}`,
      status: quotationStatus(Math.max(suppliers.length, supplierRows.length), responseCount, selected, hasQuotedValue),
      requestIds,
      supplierCount: Math.max(suppliers.length, supplierRows.length),
      responseCount,
      date: quotation.purchaseQuotationDate || quotation.registeredDate,
      notes: quotation.notes?.trim() || undefined,
      items: (quotation.purchaseQuotationItems || []).map((item, index) => ({
        number: item.purchaseQuotationItemId || index + 1,
        productId: item.productId,
        description: item.productDescription?.trim() || `Item ${index + 1}`,
        detail: item.detailDescription?.trim() || undefined,
        quantity: Number(item.quantity) || 0,
        unit: item.unitySymbol?.trim() || item.unitySimbol?.trim() || undefined,
        notes: item.notes?.trim() || undefined
      })),
      suppliers: supplierRows
    } satisfies PurchaseProjectKanbanQuotation;
  }).sort((left, right) => right.id - left.id);
  return { requests, quotations, totalItems: visibleRequestItems.length, warning: purchases.warning, error: purchases.error?.explanation || purchases.error?.title };
}
