import "server-only";
import { comprasApi } from "@/lib/api/financeiro";
import { SiengeApiError, type SiengeErrorDetails, type SiengePage } from "@/lib/api/sienge";
import type { ChartItem } from "@/features/financeiro/sienge-data";
import type {
  PurchaseFlowItem,
  PurchaseInvoice,
  PurchaseOrder,
  PurchaseQuotation,
  PurchaseRequestItem,
  PurchaseSourceStat
} from "./types";

const LIMIT = 200;

export type PurchaseResult = {
  orders: PurchaseOrder[];
  invoices: PurchaseInvoice[];
  requestItems: PurchaseRequestItem[];
  quotations: PurchaseQuotation[];
  sourceStats: PurchaseSourceStat[];
  warning?: string;
  error?: SiengeErrorDetails;
};

export type PurchasePeriodSummary = {
  key: "last12" | "last6" | "previousMonth" | "future";
  label: string;
  note: string;
  amount: number;
  count: number;
  pendingCount: number;
  doneCount: number;
};

export type PurchaseStageSummary = {
  label: string;
  total: number;
  pending: number;
  done: number;
};

export type PurchaseSummary = {
  pendingCount: number;
  pendingAmount: number;
  purchasedAmount: number;
  purchasedCount: number;
  requestCount: number;
  orderCount: number;
  invoiceCount: number;
  quotationCount: number;
  lateOrders: number;
  byStatus: ChartItem[];
  byBuyer: ChartItem[];
  monthlyPurchased: ChartItem[];
  periods: PurchasePeriodSummary[];
  stages: PurchaseStageSummary[];
  flow: PurchaseFlowItem[];
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

function previousMonthRange(today = new Date()) {
  return {
    start: new Date(today.getFullYear(), today.getMonth() - 1, 1),
    end: new Date(today.getFullYear(), today.getMonth(), 0)
  };
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

async function loadAllPages<T>(loadPage: (offset: number) => Promise<SiengePage<T>>) {
  const firstPage = await loadPage(0);
  const totalCount = firstPage.resultSetMetadata?.count ?? firstPage.results.length;
  const results = [...(firstPage.results || [])];
  const pageCount = Math.max(0, Math.ceil(totalCount / LIMIT) - 1);

  for (let page = 1; page <= pageCount; page += 1) {
    const response = await loadPage(page * LIMIT);
    results.push(...(response.results || []));
  }

  return { totalCount, results };
}

function purchaseError(error: unknown, endpoint: string, label: string): SiengeErrorDetails {
  if (error instanceof SiengeApiError) {
    const isPermissionError = error.details.status === 403;
    return {
      ...error.details,
      endpoint,
      explanation: isPermissionError
        ? `O Sienge bloqueou o acesso a ${label}.`
        : error.details.explanation,
      suggestion: isPermissionError
        ? "Libere a área de compras para esta credencial no Sienge."
        : error.details.suggestion
    };
  }

  return {
    method: "GET",
    endpoint,
    title: "Não foi possível consultar compras",
    explanation: error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
    suggestion: "Verifique a permissão da área de compras no Sienge.",
    occurredAt: new Date().toISOString()
  };
}

async function loadOrders(forceRefresh = false) {
  const page = await loadAllPages<PurchaseOrder>((offset) =>
    comprasApi.purchaseOrders<PurchaseOrder>({ limit: LIMIT, offset }, forceRefresh)
  );
  return { totalCount: page.totalCount, results: page.results };
}

async function loadInvoices(forceRefresh = false) {
  const page = await loadAllPages<PurchaseInvoice>((offset) =>
    comprasApi.purchaseInvoices<PurchaseInvoice>({ limit: LIMIT, offset }, forceRefresh)
  );
  return { totalCount: page.totalCount, results: page.results };
}

async function loadRequestItems(forceRefresh = false) {
  const page = await loadAllPages<PurchaseRequestItem>((offset) =>
    comprasApi.purchaseRequestItems<PurchaseRequestItem>({ limit: LIMIT, offset }, forceRefresh)
  );
  return { totalCount: page.totalCount, results: page.results };
}

async function loadQuotations(forceRefresh = false) {
  const response = await comprasApi.purchaseQuotations<{ data?: PurchaseQuotation[] }>({
    startDate: "2000-01-01",
    endDate: todayIso()
  }, forceRefresh);
  const results = response.data || [];
  return { totalCount: results.length, results };
}

function sourceStat<T>(
  source: PromiseSettledResult<{ totalCount: number; results: T[] }>,
  key: PurchaseSourceStat["key"],
  label: string,
  endpoint: string
): PurchaseSourceStat {
  if (source.status === "rejected") {
    return { key, label, endpoint, apiCount: 0, loadedCount: 0, status: "error" };
  }
  const loadedCount = source.value.results.length;
  return {
    key,
    label,
    endpoint,
    apiCount: source.value.totalCount,
    loadedCount,
    status: source.value.totalCount === 0 ? "empty" : loadedCount === source.value.totalCount ? "ok" : "partial"
  };
}

export async function loadPurchases(forceRefresh = false): Promise<PurchaseResult> {
  const sources = await Promise.allSettled([
    loadOrders(forceRefresh),
    loadInvoices(forceRefresh),
    loadRequestItems(forceRefresh),
    loadQuotations(forceRefresh)
  ]);

  const endpoints = [
    "/v1/purchase-orders",
    "/v1/purchase-invoices",
    "/v1/purchase-requests/all/items",
    "/bulk-data/v1/purchase-quotations"
  ];
  const labels = ["pedidos de compra", "notas fiscais de compra", "itens de solicitação", "cotações de compra"];
  const failures = sources
    .map((source, index) => source.status === "rejected" ? purchaseError(source.reason, endpoints[index], labels[index]) : undefined)
    .filter((item): item is SiengeErrorDetails => Boolean(item));

  const orders = sources[0].status === "fulfilled" ? sources[0].value.results as PurchaseOrder[] : [];
  const invoices = sources[1].status === "fulfilled" ? sources[1].value.results as PurchaseInvoice[] : [];
  const requestItems = sources[2].status === "fulfilled" ? sources[2].value.results as PurchaseRequestItem[] : [];
  const quotations = sources[3].status === "fulfilled" ? sources[3].value.results as PurchaseQuotation[] : [];
  const sourceStats = [
    sourceStat(sources[0], "orders", "Pedidos", endpoints[0]),
    sourceStat(sources[1], "invoices", "Notas fiscais", endpoints[1]),
    sourceStat(sources[2], "requests", "Solicitações", endpoints[2]),
    sourceStat(sources[3], "quotations", "Cotações", endpoints[3])
  ];

  if (!orders.length && !invoices.length && !requestItems.length && !quotations.length && failures.length) {
    return { orders, invoices, requestItems, quotations, sourceStats, error: failures[0] };
  }

  return {
    orders,
    invoices,
    requestItems,
    quotations,
    sourceStats,
    warning: failures.length ? "Algumas informações não carregaram. A visão abaixo considera apenas o que foi retornado." : undefined
  };
}

function orderStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    PENDING: "Pendente",
    PARTIALLY_DELIVERED: "Parcialmente entregue",
    FULLY_DELIVERED: "Totalmente entregue",
    CANCELED: "Cancelado"
  };
  return status ? labels[status] || status : "Situação não informada";
}

function requestStatus(item: PurchaseRequestItem) {
  if (item.disapproved) return "Reprovada";
  if (item.authorized) return "Autorizada";
  return "Pendente de autorização";
}

function quotationAmount(quotation: PurchaseQuotation) {
  return (quotation.purchaseQuotationSuppliers || []).reduce((sum, supplier) => {
    const selected = (supplier.negotiations || []).find((negotiation) =>
      (negotiation.negotiationItems || []).some((item) => item.selectedOption)
    );
    const latest = selected || supplier.negotiations?.[supplier.negotiations.length - 1];
    return sum + (latest?.totalValue || 0);
  }, 0);
}

function dateOrder(value?: string) {
  const parsed = parseDate(value);
  return parsed ? parsed.getTime() : 0;
}

function groupFlow(items: PurchaseFlowItem[], label: (item: PurchaseFlowItem) => string, value: (item: PurchaseFlowItem) => number = (item) => item.amount) {
  const groups = new Map<string, ChartItem>();
  items.forEach((item) => {
    const key = label(item);
    const current = groups.get(key) || { label: key, value: 0, count: 0 };
    current.value += value(item);
    current.count += 1;
    groups.set(key, current);
  });
  return Array.from(groups.values()).sort((left, right) => right.value - left.value);
}

function orderToFlow(order: PurchaseOrder): PurchaseFlowItem {
  const pending = order.status === "PENDING" || order.status === "PARTIALLY_DELIVERED" || !order.authorized || Boolean(order.deliveryLate);
  return {
    id: `order-${order.id}`,
    kind: "order",
    kindLabel: "Pedido",
    code: order.formattedPurchaseOrderId || String(order.id),
    title: order.notes || order.internalNotes || `Pedido de compra #${order.formattedPurchaseOrderId || order.id}`,
    subtitle: `Fornecedor ${order.supplierId || "não informado"} · Obra ${order.buildingId || "não informada"}`,
    date: order.date,
    amount: order.totalAmount || 0,
    status: orderStatusLabel(order.status),
    pending,
    late: order.deliveryLate,
    buyer: order.buyerId,
    supplier: order.supplierId ? `Fornecedor #${order.supplierId}` : undefined,
    building: order.buildingId ? `Obra #${order.buildingId}` : undefined,
    raw: order
  };
}

function invoiceToFlow(invoice: PurchaseInvoice): PurchaseFlowItem {
  return {
    id: `invoice-${invoice.sequentialNumber}`,
    kind: "invoice",
    kindLabel: "Nota fiscal",
    code: String(invoice.sequentialNumber),
    title: [invoice.documentId, invoice.number, invoice.series].filter(Boolean).join(" ") || `Nota fiscal #${invoice.sequentialNumber}`,
    subtitle: `Fornecedor ${invoice.supplierId || "não informado"} · Empresa ${invoice.companyId || "não informada"}`,
    date: invoice.issueDate || invoice.movementDate,
    amount: 0,
    status: invoice.consistency === "S" ? "Consistente" : invoice.consistency === "I" ? "Em inclusão" : invoice.consistency || "Registrada",
    pending: invoice.consistency !== "S",
    supplier: invoice.supplierId ? `Fornecedor #${invoice.supplierId}` : undefined,
    raw: invoice
  };
}

function requestToFlow(item: PurchaseRequestItem): PurchaseFlowItem {
  const status = requestStatus(item);
  return {
    id: `request-${item.purchaseRequestId}-${item.itemNumber}`,
    kind: "request",
    kindLabel: "Solicitação",
    code: `${item.purchaseRequestId}.${item.itemNumber}`,
    title: item.productDescription || `Item ${item.productId || item.itemNumber}`,
    subtitle: item.detailDescription || item.notes || "Sem detalhe informado",
    quantity: item.quantity,
    amount: 0,
    status,
    pending: status === "Pendente de autorização",
    raw: item
  };
}

function quotationToFlow(quotation: PurchaseQuotation): PurchaseFlowItem {
  const amount = quotationAmount(quotation);
  const itemCount = quotation.purchaseQuotationItems?.length || 0;
  const supplierCount = quotation.purchaseQuotationSuppliers?.length || 0;
  const selected = (quotation.purchaseQuotationSuppliers || []).some((supplier) =>
    (supplier.negotiations || []).some((negotiation) => (negotiation.negotiationItems || []).some((item) => item.selectedOption))
  );
  return {
    id: `quotation-${quotation.purchaseQuotationId}`,
    kind: "quotation",
    kindLabel: "Cotação",
    code: String(quotation.purchaseQuotationId),
    title: quotation.notes || `Cotação #${quotation.purchaseQuotationId}`,
    subtitle: `${itemCount} item(ns) · ${supplierCount} fornecedor(es)`,
    date: quotation.purchaseQuotationDate || quotation.registeredDate,
    futureDate: quotation.responseDeadline,
    amount,
    status: selected ? "Opção selecionada" : "Em cotação",
    pending: !selected,
    buyer: quotation.buyerId,
    raw: quotation
  };
}

function inRange(date: Date | undefined, start: Date, end: Date) {
  return Boolean(date && date >= start && date <= end);
}

function periodSummary(
  key: PurchasePeriodSummary["key"],
  label: string,
  note: string,
  items: PurchaseFlowItem[]
): PurchasePeriodSummary {
  return {
    key,
    label,
    note,
    amount: items.reduce((sum, item) => sum + item.amount, 0),
    count: items.length,
    pendingCount: items.filter((item) => item.pending).length,
    doneCount: items.filter((item) => !item.pending).length
  };
}

function buildPeriods(flow: PurchaseFlowItem[]): PurchasePeriodSummary[] {
  const today = startOfDay(new Date());
  const last12Start = addMonths(today, -12);
  const last6Start = addMonths(today, -6);
  const previous = previousMonthRange(today);

  return [
    periodSummary("last12", "Últimos 12 meses", "Movimento geral do período", flow.filter((item) => inRange(parseDate(item.date), last12Start, today))),
    periodSummary("last6", "Últimos 6 meses", "Recorte mais recente", flow.filter((item) => inRange(parseDate(item.date), last6Start, today))),
    periodSummary("previousMonth", "Mês anterior", "Movimento fechado do mês passado", flow.filter((item) => inRange(parseDate(item.date), previous.start, previous.end))),
    periodSummary("future", "Futuro", "Prazos e registros à frente", flow.filter((item) => {
      const mainDate = parseDate(item.date);
      const futureDate = parseDate(item.futureDate);
      return Boolean((mainDate && mainDate > today) || (futureDate && futureDate > today));
    }))
  ];
}

function stageSummary(label: string, items: PurchaseFlowItem[]): PurchaseStageSummary {
  return {
    label,
    total: items.length,
    pending: items.filter((item) => item.pending).length,
    done: items.filter((item) => !item.pending).length
  };
}

function buildStages(flow: PurchaseFlowItem[]): PurchaseStageSummary[] {
  return [
    stageSummary("Solicitações", flow.filter((item) => item.kind === "request")),
    stageSummary("Cotações", flow.filter((item) => item.kind === "quotation")),
    stageSummary("Pedidos", flow.filter((item) => item.kind === "order")),
    stageSummary("Notas fiscais", flow.filter((item) => item.kind === "invoice"))
  ];
}

export function analyzePurchases(result: PurchaseResult): PurchaseSummary {
  const flow = [
    ...result.requestItems.map(requestToFlow),
    ...result.quotations.map(quotationToFlow),
    ...result.orders.map(orderToFlow),
    ...result.invoices.map(invoiceToFlow)
  ].sort((left, right) => dateOrder(right.date) - dateOrder(left.date));

  const pendingItems = flow.filter((item) => item.pending);
  const purchasedAmount = result.orders
    .filter((order) => order.status !== "CANCELED")
    .reduce((sum, order) => sum + (order.totalAmount || 0), 0);

  const monthlyMap = new Map<string, ChartItem & { order: number }>();
  result.orders.forEach((order) => {
    if (!order.date || order.status === "CANCELED") return;
    const date = parseDate(order.date);
    if (!date) return;
    const label = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(date);
    const current = monthlyMap.get(label) || { label, value: 0, count: 0, order: date.getFullYear() * 12 + date.getMonth() };
    current.value += order.totalAmount || 0;
    current.count += 1;
    monthlyMap.set(label, current);
  });

  return {
    pendingCount: pendingItems.length,
    pendingAmount: pendingItems.reduce((sum, item) => sum + item.amount, 0),
    purchasedAmount,
    purchasedCount: result.orders.filter((order) => order.status !== "CANCELED").length,
    requestCount: result.requestItems.length,
    orderCount: result.orders.length,
    invoiceCount: result.invoices.length,
    quotationCount: result.quotations.length,
    lateOrders: result.orders.filter((order) => order.deliveryLate).length,
    byStatus: groupFlow(flow, (item) => `${item.kindLabel}: ${item.status}`, () => 1).slice(0, 10),
    byBuyer: groupFlow(flow.filter((item) => item.buyer), (item) => item.buyer || "Comprador não informado").slice(0, 8),
    monthlyPurchased: Array.from(monthlyMap.values()).sort((left, right) => left.order - right.order),
    periods: buildPeriods(flow),
    stages: buildStages(flow),
    flow
  };
}
