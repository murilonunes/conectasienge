import "server-only";
import type { ChartItem } from "@/features/financeiro/sienge-data";
import { quotationSummary, type QuotationStatus } from "@/features/quotations/data";
import { searchLocalSuppliers } from "@/features/suppliers/data";
import type { PurchaseResult } from "./data";
import { readPurchaseRequestHeaders, requestHeaderIsOpen, requestStatusLabels } from "./request-headers";
import type { PurchaseOrder, PurchaseRequestItem } from "./types";

export type SupplyRequestRow = {
  purchaseRequestId: number;
  code: string;
  itemCount: number;
  pendingAuthorization: number;
  sample: string;
  requestDate?: string;
  requesterUser?: string;
  statusLabel?: string;
  relatedQuotationId?: number;
  relatedQuotationStatus?: QuotationStatus;
};

export type SupplyQuotationRow = {
  id: number;
  code: string;
  status: QuotationStatus;
  date?: string;
  deadline?: string;
  itemCount: number;
  supplierCount: number;
  responseCount: number;
  totalValue: number;
};

export type SupplyOrderRow = {
  id: number;
  code: string;
  date?: string;
  supplierName: string;
  buyer?: string;
  amount: number;
  statusLabel: string;
};

export type SupplyFunnelStage = {
  key: string;
  label: string;
  count: number;
  amount?: number;
  note: string;
  href?: string;
  warn?: boolean;
};

export type SupplyPeriodFilter = {
  includeCurrentMonth: boolean;
  extraMonths: number | "all";
};

export type SupplyPeriod = SupplyPeriodFilter & {
  startMonth?: string;
  endMonth: string;
  label: string;
};

export type SupplyOverview = {
  requestStatusSynced: boolean;
  undatedRequests: number;
  period: SupplyPeriod;
  stats: {
    openRequests: { count: number; items: number; pendingAuthorization: number; withoutStatus: number };
    activeQuotations: { count: number; waitingSuppliers: number; waitingResponse: number; readyForDecision: number };
    ordersInProgress: { count: number; amount: number; awaitingAuthorization: number };
    lateOrders: { count: number; amount: number };
    periodPurchases: { count: number; amount: number };
  };
  funnel: SupplyFunnelStage[];
  actions: {
    requestsToQuote: SupplyRequestRow[];
    quotationsWaitingSuppliers: SupplyQuotationRow[];
    quotationsReadyForDecision: SupplyQuotationRow[];
    ordersAwaitingAuthorization: SupplyOrderRow[];
    lateOrders: SupplyOrderRow[];
  };
  topSuppliersPeriod: ChartItem[];
  invoicesPeriodCount: number;
};

type SupplyPeriodSearchParams = Record<string, string | string[] | undefined>;

const allowedExtraMonths = new Set([1, 2, 3, 6, 12]);

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function dateMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function supplyPeriodFilterFromParams(searchParams: SupplyPeriodSearchParams = {}): SupplyPeriodFilter {
  const filterSubmitted = firstParam(searchParams.filtro) === "periodo";
  const rawHistory = firstParam(searchParams.historico) || "1";
  const parsedHistory = Number(rawHistory);
  return {
    includeCurrentMonth: filterSubmitted ? firstParam(searchParams.mesAtual) === "1" : true,
    extraMonths: rawHistory === "tudo"
      ? "all"
      : allowedExtraMonths.has(parsedHistory)
        ? parsedHistory
        : 1
  };
}

export function supplyPeriodDetails(filter: SupplyPeriodFilter, today = new Date()): SupplyPeriod {
  const currentMonth = dateMonthKey(today);
  const previousMonth = dateMonthKey(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  const endMonth = filter.includeCurrentMonth ? currentMonth : previousMonth;
  const startMonth = filter.extraMonths === "all"
    ? undefined
    : dateMonthKey(new Date(today.getFullYear(), today.getMonth() - filter.extraMonths, 1));
  const historyLabel = filter.extraMonths === "all"
    ? "todo o histórico"
    : `${filter.extraMonths} ${filter.extraMonths === 1 ? "mês anterior" : "meses anteriores"}`;
  const label = filter.includeCurrentMonth
    ? `Mês atual + ${historyLabel}`
    : filter.extraMonths === "all"
      ? "Todo o histórico até o mês passado"
      : `${historyLabel}, sem o mês atual`;

  return { ...filter, startMonth, endMonth, label };
}

function dateMatchesPeriod(value: string | undefined, period: SupplyPeriod) {
  const key = monthKey(value);
  if (!key) return period.extraMonths === "all";
  return (!period.startMonth || key >= period.startMonth) && key <= period.endMonth;
}

export function filterPurchasesBySupplyPeriod(result: PurchaseResult, filter: SupplyPeriodFilter) {
  const period = supplyPeriodDetails(filter);
  const requestHeaders = readPurchaseRequestHeaders();
  const undatedRequestIds = new Set<number>();
  const purchases: PurchaseResult = {
    ...result,
    orders: result.orders.filter((order) => dateMatchesPeriod(order.date, period)),
    invoices: result.invoices.filter((invoice) => dateMatchesPeriod(invoice.movementDate || invoice.issueDate, period)),
    quotations: result.quotations.filter((quotation) => dateMatchesPeriod(quotation.purchaseQuotationDate || quotation.registeredDate, period)),
    requestItems: result.requestItems.filter((item) => {
      const requestDate = requestHeaders.get(item.purchaseRequestId)?.requestDate;
      if (!requestDate && period.extraMonths !== "all") undatedRequestIds.add(item.purchaseRequestId);
      return dateMatchesPeriod(requestDate, period);
    })
  };
  return { purchases, undatedRequests: undatedRequestIds.size };
}

function monthKey(value?: string) {
  return value ? value.slice(0, 7) : "";
}

function orderStatusLabel(order: PurchaseOrder) {
  if (order.status === "CANCELED") return "Cancelado";
  if (order.deliveryLate) return "Entrega atrasada";
  if (!order.authorized) return "Aguardando autorização";
  if (order.status === "PARTIALLY_DELIVERED") return "Entrega parcial";
  if (order.status === "FULLY_DELIVERED") return "Entregue";
  return "Aguardando entrega";
}

function groupRequests(items: PurchaseRequestItem[]) {
  const groups = new Map<number, PurchaseRequestItem[]>();
  items.forEach((item) => {
    const current = groups.get(item.purchaseRequestId) || [];
    current.push(item);
    groups.set(item.purchaseRequestId, current);
  });
  return groups;
}

// Liga solicitação a cotação por sobreposição de insumos (productId): o espelho
// do Sienge não traz o vínculo direto, então uma cotação que contém a maior
// parte dos insumos da solicitação é tratada como a cotação provável dela.
function findRelatedQuotation(requestItems: PurchaseRequestItem[], quotations: SupplyQuotationRow[], quotationProducts: Map<number, Set<number>>) {
  const requestProducts = new Set(requestItems.map((item) => item.productId).filter((id): id is number => Boolean(id)));
  if (!requestProducts.size) return undefined;

  let best: { quotation: SupplyQuotationRow; matches: number } | undefined;
  quotations.forEach((quotation) => {
    const products = quotationProducts.get(quotation.id);
    if (!products) return;
    let matches = 0;
    requestProducts.forEach((productId) => {
      if (products.has(productId)) matches += 1;
    });
    if (matches * 2 >= requestProducts.size && (!best || matches > best.matches || (matches === best.matches && quotation.id > best.quotation.id))) {
      best = { quotation, matches };
    }
  });
  return best?.quotation;
}

export function buildSupplyOverview(result: PurchaseResult, periodFilter: SupplyPeriodFilter, undatedRequests = 0): SupplyOverview {
  const period = supplyPeriodDetails(periodFilter);
  const supplierNames = new Map<number, string>();
  try {
    searchLocalSuppliers("", 100000).suppliers.forEach((supplier) => supplierNames.set(supplier.id, supplier.name));
  } catch {
    // Sem diretório local de fornecedores, os pedidos mostram apenas o número.
  }
  const supplierName = (id?: number) => (id ? supplierNames.get(id) || `Fornecedor #${id}` : "Fornecedor não informado");

  // Cotações com status derivado do espelho (mesma regra da tela /cotacoes).
  const quotationRows: SupplyQuotationRow[] = result.quotations.map((quotation) => {
    const summary = quotationSummary(quotation);
    return {
      id: summary.id,
      code: summary.code,
      status: summary.status,
      date: summary.date,
      deadline: summary.deadline,
      itemCount: summary.itemCount,
      supplierCount: summary.supplierCount,
      responseCount: summary.responseCount,
      totalValue: summary.totalValue
    };
  });
  const quotationProducts = new Map<number, Set<number>>(result.quotations.map((quotation) => [
    quotation.purchaseQuotationId,
    new Set((quotation.purchaseQuotationItems || []).map((item) => item.productId).filter((id): id is number => Boolean(id)))
  ]));
  const activeQuotations = quotationRows.filter((row) => row.status !== "Negociação fechada");
  const waitingSuppliers = activeQuotations.filter((row) => row.status === "Sem fornecedores");
  const waitingResponse = activeQuotations.filter((row) => row.status === "Registrada" || row.status === "Em negociação");
  const readyForDecision = activeQuotations.filter((row) => row.status === "Pronta para decisão");

  // Solicitações agrupadas. A situação individual (atendida/pendente) vem da
  // sincronização de cabeçalhos: atendidas, canceladas e reprovadas ficam fora
  // do funil. Sem cabeçalho sincronizado, a solicitação é tratada como aberta.
  const requestHeaders = readPurchaseRequestHeaders();
  const requestGroups = groupRequests(result.requestItems);
  const openRequests: SupplyRequestRow[] = [];
  let openItemCount = 0;
  let pendingAuthorizationItems = 0;
  let withoutStatus = 0;
  requestGroups.forEach((items, purchaseRequestId) => {
    if (items.some((item) => item.disapproved)) return;
    const header = requestHeaders.get(purchaseRequestId);
    if (header && !requestHeaderIsOpen(header)) return;
    if (!header) withoutStatus += 1;
    const pending = items.filter((item) => !item.authorized).length;
    openItemCount += items.length;
    pendingAuthorizationItems += pending;
    const related = findRelatedQuotation(items, quotationRows, quotationProducts);
    openRequests.push({
      purchaseRequestId,
      code: `SC-${purchaseRequestId}`,
      itemCount: items.length,
      pendingAuthorization: pending,
      sample: items
        .map((item) => item.productDescription || `Insumo ${item.productId || item.itemNumber}`)
        .slice(0, 2)
        .join(", "),
      requestDate: header?.requestDate,
      requesterUser: header?.requesterUser,
      statusLabel: header ? requestStatusLabels[header.status] || header.status : undefined,
      relatedQuotationId: related?.id,
      relatedQuotationStatus: related?.status
    });
  });
  openRequests.sort((left, right) =>
    (right.requestDate || "").localeCompare(left.requestDate || "") || right.purchaseRequestId - left.purchaseRequestId
  );

  // Solicitações que ainda precisam de cotação: sem cotação provável ou com
  // cotação provável ainda sem fornecedores respondendo.
  const requestsToQuote = openRequests.filter((row) =>
    !row.relatedQuotationId || row.relatedQuotationStatus === "Sem fornecedores"
  );

  // Pedidos: cancelados ficam fora; atrasados e sem autorização são destaque.
  const validOrders = result.orders.filter((order) => order.status !== "CANCELED" && !order.disapproved);
  const inProgressOrders = validOrders.filter((order) => order.status !== "FULLY_DELIVERED");
  const awaitingAuthorization = inProgressOrders.filter((order) => !order.authorized);
  const lateOrders = inProgressOrders.filter((order) => order.deliveryLate);

  const orderRow = (order: PurchaseOrder): SupplyOrderRow => ({
    id: order.id,
    code: order.formattedPurchaseOrderId || String(order.id),
    date: order.date,
    supplierName: supplierName(order.supplierId),
    buyer: order.buyerId,
    amount: order.totalAmount || 0,
    statusLabel: orderStatusLabel(order)
  });

  const periodAmount = validOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

  const supplierPeriodMap = new Map<string, ChartItem>();
  validOrders.forEach((order) => {
    const label = supplierName(order.supplierId);
    const current = supplierPeriodMap.get(label) || { label, value: 0, count: 0 };
    current.value += order.totalAmount || 0;
    current.count = (current.count || 0) + 1;
    supplierPeriodMap.set(label, current);
  });
  const topSuppliersPeriod = Array.from(supplierPeriodMap.values())
    .sort((left, right) => right.value - left.value)
    .slice(0, 8);

  const invoicesPeriodCount = result.invoices.length;

  const inProgressAmount = inProgressOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  const lateAmount = lateOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

  const funnel: SupplyFunnelStage[] = [
    {
      key: "requests",
      label: "Solicitações",
      count: openRequests.length,
      note: pendingAuthorizationItems
        ? `${pendingAuthorizationItems} insumo(s) aguardando autorização`
        : "Todas autorizadas",
      href: "/solicitacoes-compra"
    },
    {
      key: "quotations",
      label: "Cotações em andamento",
      count: activeQuotations.length,
      note: readyForDecision.length
        ? `${readyForDecision.length} pronta(s) para decisão`
        : waitingSuppliers.length
          ? `${waitingSuppliers.length} sem fornecedores`
          : "Aguardando respostas",
      href: "/cotacoes",
      warn: waitingSuppliers.length > 0
    },
    {
      key: "orders",
      label: "Pedidos em execução",
      count: inProgressOrders.length,
      amount: inProgressAmount,
      note: lateOrders.length
        ? `${lateOrders.length} com entrega atrasada`
        : awaitingAuthorization.length
          ? `${awaitingAuthorization.length} aguardando autorização`
          : "Sem pendência de entrega",
      warn: lateOrders.length > 0
    },
    {
      key: "invoices",
      label: "Notas no período",
      count: invoicesPeriodCount,
      note: "Notas fiscais de compra recebidas no período"
    }
  ];

  return {
    requestStatusSynced: undatedRequests === 0 && withoutStatus === 0,
    undatedRequests,
    period,
    stats: {
      openRequests: { count: openRequests.length, items: openItemCount, pendingAuthorization: pendingAuthorizationItems, withoutStatus },
      activeQuotations: {
        count: activeQuotations.length,
        waitingSuppliers: waitingSuppliers.length,
        waitingResponse: waitingResponse.length,
        readyForDecision: readyForDecision.length
      },
      ordersInProgress: {
        count: inProgressOrders.length,
        amount: inProgressAmount,
        awaitingAuthorization: awaitingAuthorization.length
      },
      lateOrders: { count: lateOrders.length, amount: lateAmount },
      periodPurchases: { count: validOrders.length, amount: periodAmount }
    },
    funnel,
    actions: {
      requestsToQuote: requestsToQuote.slice(0, 8),
      quotationsWaitingSuppliers: [...waitingSuppliers, ...waitingResponse].slice(0, 8),
      quotationsReadyForDecision: readyForDecision.slice(0, 8),
      ordersAwaitingAuthorization: awaitingAuthorization.map(orderRow).slice(0, 8),
      lateOrders: lateOrders.map(orderRow).slice(0, 8)
    },
    topSuppliersPeriod,
    invoicesPeriodCount
  };
}
