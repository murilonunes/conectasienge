import "server-only";
import { existsSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { comprasApi } from "@/lib/api/financeiro";
import { SiengeApiError, type SiengeErrorDetails, type SiengePage } from "@/lib/api/sienge";
import type { ChartItem } from "@/features/financeiro/sienge-data";
import type { SiengeIntegrationRange } from "@/lib/settings";
import type {
  PurchaseFlowItem,
  PurchaseInvoice,
  PurchaseOrder,
  PurchaseQuotation,
  PurchaseRequestItem,
  PurchaseSourceStat
} from "./types";

const LIMIT = 200;
const dataDir = path.join(process.cwd(), ".sienge-data");
const purchasesDatabasePath = path.join(dataDir, "purchases.sqlite");

const ENDPOINTS = {
  orders: "/v1/purchase-orders",
  invoices: "/v1/purchase-invoices",
  requests: "/v1/purchase-requests/all/items",
  quotations: "/bulk-data/v1/purchase-quotations"
} as const;

const SOURCE_LABELS = {
  orders: "Pedidos",
  invoices: "Notas fiscais",
  requests: "Solicitacoes",
  quotations: "Cotacoes"
} as const;

type SourceKey = keyof typeof ENDPOINTS;
type LocalRows<T> = {
  totalCount: number;
  results: T[];
};
type SqlRow = {
  raw_json: string;
  source_day?: string;
  saved_at?: string;
};

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

function openDatabase() {
  const database = new DatabaseSync(purchasesDatabasePath);
  database.exec("PRAGMA busy_timeout = 8000;");
  return database;
}

function tableExists(database: DatabaseSync, table: string) {
  return Boolean(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function ensureIndexes(database: DatabaseSync) {
  try {
    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_sienge_records_endpoint ON sienge_records(endpoint);
      CREATE INDEX IF NOT EXISTS idx_sienge_records_saved_at ON sienge_records(saved_at);
    `);
  } catch {
    // Reading still works without indexes; it can only be slower on large local bases.
  }
}

function localDataError(title: string, explanation: string): SiengeErrorDetails {
  return {
    method: "GET",
    endpoint: "purchases.sqlite",
    title,
    explanation,
    suggestion: "Atualize Compras em Configurações para preencher os dados.",
    occurredAt: new Date().toISOString()
  };
}

function annotate<T>(row: SqlRow): T | undefined {
  try {
    return {
      ...(JSON.parse(row.raw_json) as T & object),
      __siengeIntegrationDay: row.source_day,
      __siengeIntegratedAt: row.saved_at
    } as T;
  } catch {
    return undefined;
  }
}

function emptySourceStat(key: SourceKey, status: PurchaseSourceStat["status"]): PurchaseSourceStat {
  return {
    key,
    label: SOURCE_LABELS[key],
    endpoint: ENDPOINTS[key],
    apiCount: 0,
    loadedCount: 0,
    status
  };
}

function readEndpoint<T>(database: DatabaseSync, key: SourceKey): LocalRows<T> {
  const rows = database.prepare(`
    SELECT raw_json, source_day, saved_at
    FROM sienge_records
    WHERE endpoint = ?
    ORDER BY saved_at DESC
  `).all(ENDPOINTS[key]) as SqlRow[];

  return {
    totalCount: rows.length,
    results: rows.map(annotate<T>).filter((item): item is T => Boolean(item))
  };
}

function sourceStat<T>(
  source: PromiseSettledResult<LocalRows<T>> | LocalRows<T>,
  key: SourceKey
): PurchaseSourceStat {
  if ("status" in source && source.status === "rejected") {
    return emptySourceStat(key, "error");
  }
  const value = "status" in source ? source.value : source;
  const loadedCount = value.results.length;
  return {
    key,
    label: SOURCE_LABELS[key],
    endpoint: ENDPOINTS[key],
    apiCount: value.totalCount,
    loadedCount,
    status: value.totalCount === 0 ? "empty" : loadedCount === value.totalCount ? "ok" : "partial"
  };
}

function readLocalPurchases(): PurchaseResult {
  const emptyStats = [
    emptySourceStat("orders", "error"),
    emptySourceStat("invoices", "error"),
    emptySourceStat("requests", "error"),
    emptySourceStat("quotations", "error")
  ];

  if (!existsSync(purchasesDatabasePath)) {
    return {
      orders: [],
      invoices: [],
      requestItems: [],
      quotations: [],
      sourceStats: emptyStats,
      error: localDataError("Compras sem dados carregados", "Os dados de compras ainda não foram atualizados.")
    };
  }

  const database = openDatabase();
  try {
    if (!tableExists(database, "sienge_records")) {
      return {
        orders: [],
        invoices: [],
        requestItems: [],
        quotations: [],
        sourceStats: emptyStats,
        error: localDataError("Compras sem registros", "A base de compras ainda não possui dados para exibir.")
      };
    }

    ensureIndexes(database);

    const orders = readEndpoint<PurchaseOrder>(database, "orders");
    const invoices = readEndpoint<PurchaseInvoice>(database, "invoices");
    const requestItems = readEndpoint<PurchaseRequestItem>(database, "requests");
    const quotations = readEndpoint<PurchaseQuotation>(database, "quotations");
    const total = orders.results.length + invoices.results.length + requestItems.results.length + quotations.results.length;

    return {
      orders: orders.results,
      invoices: invoices.results,
      requestItems: requestItems.results,
      quotations: quotations.results,
      sourceStats: [
        sourceStat(orders, "orders"),
        sourceStat(invoices, "invoices"),
        sourceStat(requestItems, "requests"),
        sourceStat(quotations, "quotations")
      ],
      ...(total === 0 ? {
        error: localDataError("Compras sem dados", "Nenhum pedido, nota, solicitação ou cotação foi encontrado.")
      } : {})
    };
  } finally {
    database.close();
  }
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
    title: "Não foi possível atualizar compras",
    explanation: error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
    suggestion: "Verifique a permissão da área de compras no Sienge.",
    occurredAt: new Date().toISOString()
  };
}

async function loadOrders(forceRefresh = false, forceReplaceFinalized = false) {
  const page = await loadAllPages<PurchaseOrder>((offset) =>
    comprasApi.purchaseOrders<PurchaseOrder>({ limit: LIMIT, offset }, forceRefresh, forceReplaceFinalized)
  );
  return { totalCount: page.totalCount, results: page.results };
}

async function loadInvoices(forceRefresh = false, forceReplaceFinalized = false) {
  const page = await loadAllPages<PurchaseInvoice>((offset) =>
    comprasApi.purchaseInvoices<PurchaseInvoice>({ limit: LIMIT, offset }, forceRefresh, forceReplaceFinalized)
  );
  return { totalCount: page.totalCount, results: page.results };
}

async function loadRequestItems(forceRefresh = false, forceReplaceFinalized = false) {
  const page = await loadAllPages<PurchaseRequestItem>((offset) =>
    comprasApi.purchaseRequestItems<PurchaseRequestItem>({ limit: LIMIT, offset }, forceRefresh, forceReplaceFinalized)
  );
  return { totalCount: page.totalCount, results: page.results };
}

async function loadQuotations(forceRefresh = false, forceReplaceFinalized = false, range?: SiengeIntegrationRange) {
  const response = await comprasApi.purchaseQuotations<{ data?: PurchaseQuotation[] }>({
    startDate: range?.startDate || "2000-01-01",
    endDate: range?.endDate || todayIso()
  }, forceRefresh, forceReplaceFinalized);
  const results = response.data || [];
  return { totalCount: results.length, results };
}

async function refreshFromSienge(forceReplaceFinalized = false, range?: SiengeIntegrationRange): Promise<PurchaseResult> {
  const sources = await Promise.allSettled([
    loadOrders(true, forceReplaceFinalized),
    loadInvoices(true, forceReplaceFinalized),
    loadRequestItems(true, forceReplaceFinalized),
    loadQuotations(true, forceReplaceFinalized, range)
  ]);

  const failures = sources
    .map((source, index) => {
      if (source.status !== "rejected") return undefined;
      const key = (Object.keys(ENDPOINTS) as SourceKey[])[index];
      return purchaseError(source.reason, ENDPOINTS[key], SOURCE_LABELS[key].toLowerCase());
    })
    .filter((item): item is SiengeErrorDetails => Boolean(item));

  const orders = sources[0].status === "fulfilled" ? sources[0].value.results as PurchaseOrder[] : [];
  const invoices = sources[1].status === "fulfilled" ? sources[1].value.results as PurchaseInvoice[] : [];
  const requestItems = sources[2].status === "fulfilled" ? sources[2].value.results as PurchaseRequestItem[] : [];
  const quotations = sources[3].status === "fulfilled" ? sources[3].value.results as PurchaseQuotation[] : [];
  const sourceStats = [
    sourceStat(sources[0], "orders"),
    sourceStat(sources[1], "invoices"),
    sourceStat(sources[2], "requests"),
    sourceStat(sources[3], "quotations")
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
    warning: failures.length ? "Algumas informações não foram atualizadas. A visão considera apenas o que foi carregado." : undefined
  };
}

export async function loadPurchases(forceRefresh = false, forceReplaceFinalized = false, range?: SiengeIntegrationRange): Promise<PurchaseResult> {
  if (!forceRefresh) return readLocalPurchases();
  return refreshFromSienge(forceReplaceFinalized, range);
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
    subtitle: `Fornecedor ${order.supplierId || "não informado"} - Obra ${order.buildingId || "não informada"}`,
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
    subtitle: `Fornecedor ${invoice.supplierId || "não informado"} - Empresa ${invoice.companyId || "não informada"}`,
    date: invoice.issueDate || invoice.movementDate,
    amount: 0,
    status: invoice.consistency === "S" ? "Consistente" : invoice.consistency === "I" ? "Em inclusao" : invoice.consistency || "Registrada",
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
    subtitle: `${itemCount} item(ns) - ${supplierCount} fornecedor(es)`,
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
    periodSummary("last12", "Últimos 12 meses", "Movimento geral", flow.filter((item) => inRange(parseDate(item.date), last12Start, today))),
    periodSummary("last6", "Últimos 6 meses", "Recorte recente", flow.filter((item) => inRange(parseDate(item.date), last6Start, today))),
    periodSummary("previousMonth", "Mês anterior", "Mês fechado", flow.filter((item) => inRange(parseDate(item.date), previous.start, previous.end))),
    periodSummary("future", "Futuro", "Prazos futuros", flow.filter((item) => {
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
  const validOrders = result.orders.filter((order) => order.status !== "CANCELED");
  const purchasedAmount = validOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

  const monthlyMap = new Map<string, ChartItem & { order: number }>();
  validOrders.forEach((order) => {
    if (!order.date) return;
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
    purchasedCount: validOrders.length,
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
