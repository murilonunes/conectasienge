import "server-only";
import { loadPurchases } from "@/features/purchases/data";
import { filterPurchaseQuotationsByCutoff, filterPurchaseRequestItemsByCutoff } from "@/features/purchases/purchase-cutoff";
import { readPurchaseRequestHeaders } from "@/features/purchases/request-headers";
import type {
  PurchaseQuotation,
  PurchaseQuotationItem,
  PurchaseQuotationSupplier,
  PurchaseRequestItem
} from "@/features/purchases/types";
import { loadSupplierQuoteRequestOrigins } from "@/lib/supplier-quote-portal";
import { getAppSettings } from "@/lib/settings";

export type QuotationStatus =
  | "Registrada"
  | "Em negociação"
  | "Pronta para decisão"
  | "Negociação fechada"
  | "Sem fornecedores";

export type QuotationSupplierSummary = {
  supplierId: string;
  supplierName: string;
  negotiationCount: number;
  totalValue: number;
  discount: number;
  freight: number;
  selected: boolean;
  lastResponse?: string;
};

export type QuotationItemSummary = {
  itemNumber: number;
  productId?: number;
  name: string;
  detail: string;
  quantity: number;
  unit: string;
  notes: string;
};

export type QuotationSummary = {
  id: number;
  code: string;
  buyerId: string;
  date?: string;
  deadline?: string;
  status: QuotationStatus;
  notes: string;
  itemCount: number;
  supplierCount: number;
  responseCount: number;
  selectedSupplier?: string;
  totalValue: number;
  integratedAt?: string;
  purchaseRequestIds: number[];
  items: QuotationItemSummary[];
  suppliers: QuotationSupplierSummary[];
  raw: PurchaseQuotation;
};

export type PurchaseRequestForQuotation = {
  purchaseRequestId: number;
  code: string;
  title: string;
  status: "Pendente" | "Autorizada" | "Reprovada";
  itemCount: number;
  items: Array<{
    itemNumber: number;
    productId?: number;
    name: string;
    detail: string;
    quantity: number;
    unit: string;
    notes: string;
  }>;
};

export type QuotationPortalData = {
  quotations: QuotationSummary[];
  request?: PurchaseRequestForQuotation;
  totalRequests: number;
  warning?: string;
  error?: string;
};

function latestNegotiation(supplier: PurchaseQuotationSupplier) {
  return supplier.negotiations?.[supplier.negotiations.length - 1];
}

function negotiationValue(supplier: PurchaseQuotationSupplier) {
  const negotiation = latestNegotiation(supplier);
  return negotiation?.totalValue || 0;
}

function supplierSummary(supplier: PurchaseQuotationSupplier): QuotationSupplierSummary {
  const negotiation = latestNegotiation(supplier);
  const selected = (supplier.negotiations || []).some((item) =>
    (item.negotiationItems || []).some((negotiationItem) => negotiationItem.selectedOption)
  );

  return {
    supplierId: supplier.supplierId ? String(supplier.supplierId) : "Não informado",
    supplierName: supplier.supplierId ? `Fornecedor #${supplier.supplierId}` : "Fornecedor não informado",
    negotiationCount: supplier.negotiations?.length || 0,
    totalValue: negotiation?.totalValue || 0,
    discount: negotiation?.discount || 0,
    freight: negotiation?.freight || 0,
    selected,
    lastResponse: negotiation?.responseDate || negotiation?.registeredDate
  };
}

function itemSummary(item: PurchaseQuotationItem, index: number): QuotationItemSummary {
  return {
    itemNumber: item.purchaseQuotationItemId || index + 1,
    productId: item.productId,
    name: item.productDescription || `Insumo ${item.productId || index + 1}`,
    detail: item.detailDescription || "",
    quantity: item.quantity || 0,
    unit: item.unitySymbol || item.unitySimbol || "un",
    notes: item.notes || ""
  };
}

function normalizedItemText(value?: string) {
  return (value || "").trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
}

function requestItemMatchScore(item: QuotationItemSummary, requestItem: PurchaseRequestItem) {
  const sameProduct = Boolean(item.productId && requestItem.productId && item.productId === requestItem.productId);
  const sameName = normalizedItemText(item.name) === normalizedItemText(requestItem.productDescription);
  if (!sameProduct && !sameName) return -1;

  let score = sameProduct ? 100 : 50;
  if (normalizedItemText(item.detail) === normalizedItemText(requestItem.detailDescription)) score += 20;
  if (item.quantity === (requestItem.quantity || 0)) score += 5;
  if (normalizedItemText(item.unit) === normalizedItemText(requestItem.unitySymbol)) score += 3;
  return score;
}

function mergeRequestItemNotes(items: QuotationItemSummary[], requestItems: PurchaseRequestItem[]) {
  const available = requestItems.map((item, index) => ({ item, index }));
  const used = new Set<number>();

  return items.map((item) => {
    const match = available
      .filter((candidate) => !used.has(candidate.index))
      .map((candidate) => ({ ...candidate, score: requestItemMatchScore(item, candidate.item) }))
      .filter((candidate) => candidate.score >= 0)
      .sort((left, right) => right.score - left.score)[0];

    if (!match) return item;
    used.add(match.index);
    return {
      ...item,
      notes: item.notes.trim() || match.item.notes?.trim() || ""
    };
  });
}

function quotationStatus(quotation: PurchaseQuotation, suppliers: QuotationSupplierSummary[]): QuotationStatus {
  if (!suppliers.length) return "Sem fornecedores";
  if (suppliers.some((supplier) => supplier.selected)) return "Negociação fechada";
  if (suppliers.some((supplier) => supplier.totalValue > 0)) return "Pronta para decisão";
  if (suppliers.some((supplier) => supplier.negotiationCount > 0)) return "Em negociação";
  return "Registrada";
}

export function quotationSummary(
  quotation: PurchaseQuotation,
  purchaseRequestIds: number[] = [],
  requestItems: PurchaseRequestItem[] = []
): QuotationSummary {
  const items = mergeRequestItemNotes((quotation.purchaseQuotationItems || []).map(itemSummary), requestItems);
  const suppliers = (quotation.purchaseQuotationSuppliers || []).map(supplierSummary);
  const selectedSupplier = suppliers.find((supplier) => supplier.selected);
  const status = quotationStatus(quotation, suppliers);

  return {
    id: quotation.purchaseQuotationId,
    code: String(quotation.purchaseQuotationId),
    buyerId: quotation.buyerId || "Não informado",
    date: quotation.purchaseQuotationDate || quotation.registeredDate,
    deadline: quotation.responseDeadline,
    status,
    notes: quotation.notes || "",
    itemCount: items.length,
    supplierCount: suppliers.length,
    responseCount: suppliers.filter((supplier) => supplier.negotiationCount > 0).length,
    selectedSupplier: selectedSupplier?.supplierName,
    totalValue: suppliers.reduce((sum, supplier) => sum + negotiationValue({
      supplierId: Number(supplier.supplierId),
      negotiations: [{
        totalValue: supplier.totalValue,
        discount: supplier.discount,
        freight: supplier.freight
      }]
    }), 0),
    integratedAt: quotation.__siengeIntegratedAt,
    purchaseRequestIds,
    items,
    suppliers,
    raw: quotation
  };
}

function requestStatus(items: PurchaseRequestItem[]) {
  if (items.some((item) => item.disapproved)) return "Reprovada";
  if (items.length && items.every((item) => item.authorized)) return "Autorizada";
  return "Pendente";
}

function groupRequestItems(items: PurchaseRequestItem[]) {
  const groups = new Map<number, PurchaseRequestItem[]>();

  items.forEach((item) => {
    const current = groups.get(item.purchaseRequestId) || [];
    current.push(item);
    groups.set(item.purchaseRequestId, current);
  });

  return groups;
}

function requestForQuotation(items: PurchaseRequestItem[]): PurchaseRequestForQuotation | undefined {
  const first = items[0];
  if (!first) return undefined;

  return {
    purchaseRequestId: first.purchaseRequestId,
    code: `SC-${first.purchaseRequestId}`,
    title: `Solicitação ${first.purchaseRequestId}`,
    status: requestStatus(items),
    itemCount: items.length,
    items: items.map((item) => ({
      itemNumber: item.itemNumber,
      productId: item.productId,
      name: item.productDescription || `Produto ${item.productId || item.itemNumber}`,
      detail: item.detailDescription || "",
      quantity: item.quantity || 0,
      unit: item.unitySymbol || "un",
      notes: item.notes || ""
    }))
  };
}

export async function loadQuotationPortalData(selectedRequestId?: number): Promise<QuotationPortalData> {
  const purchases = await loadPurchases();
  if (purchases.error) {
    return {
      quotations: [],
      totalRequests: 0,
      error: purchases.error.explanation || purchases.error.title
    };
  }

  const cutoffDate = getAppSettings().purchaseCutoffDate;
  const headers = readPurchaseRequestHeaders();
  const visibleRequestItems = filterPurchaseRequestItemsByCutoff(purchases.requestItems, headers, cutoffDate);
  const visibleQuotations = filterPurchaseQuotationsByCutoff(purchases.quotations, cutoffDate);
  const requestGroups = groupRequestItems(visibleRequestItems);
  const requestOrigins = loadSupplierQuoteRequestOrigins();
  const requestItems = selectedRequestId ? requestGroups.get(selectedRequestId) || [] : [];
  const quotations = visibleQuotations.map((quotation) => {
    const purchaseRequestIds = (requestOrigins.get(quotation.purchaseQuotationId) || []).filter((requestId) => requestGroups.has(requestId));
    const sourceItems = purchaseRequestIds.flatMap((requestId) => requestGroups.get(requestId) || []);
    return quotationSummary(quotation, purchaseRequestIds, sourceItems);
  }).sort((left, right) => right.id - left.id);

  return {
    quotations,
    request: selectedRequestId ? requestForQuotation(requestItems) : undefined,
    totalRequests: requestGroups.size,
    warning: purchases.warning
  };
}

export async function loadQuotationDetail(id: number) {
  const data = await loadQuotationPortalData();
  return data.quotations.find((quotation) => quotation.id === id);
}

// Logins de comprador já usados em cotações reais do Sienge, para sugerir no
// campo "Comprador Sienge" e evitar digitar um nome que a API vai rejeitar.
export async function loadKnownBuyerIds(): Promise<string[]> {
  const purchases = await loadPurchases();
  if (purchases.error) return [];
  const ids = new Set(
    purchases.quotations
      .map((quotation) => quotation.buyerId?.trim())
      .filter((buyerId): buyerId is string => Boolean(buyerId))
  );
  return Array.from(ids).sort();
}
