import "server-only";
import { existsSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import type { CashFlowChartItem } from "@/components/charts/cash-flow-chart";
import type { ChartItem, PayablesResult } from "@/features/financeiro/sienge-data";
import { assetKindLabel, assetValue, stockLabel } from "@/features/inventory/utils";
import type { InventoryAsset, InventoryAssetKind } from "@/features/inventory/types";
import type { SalesContract } from "@/features/sales/types";
import type { PurchaseOrder } from "@/features/purchases/types";

type Row = Record<string, unknown>;
type JsonRow = { raw_json: string };
type DatedChartItem = ChartItem & { dateKey: string };
export type DashboardPeriodDirection = "future" | "past";
export type DashboardOverdueMode = "period" | "all";
type DashboardPeriodRange = ReturnType<typeof period> & { direction: DashboardPeriodDirection; overdueMode: DashboardOverdueMode };

export const DASHBOARD_PERIOD_OPTIONS = [
  { days: 1, label: "Hoje" },
  { days: 7, label: "7 dias" },
  { days: 15, label: "15 dias" },
  { days: 30, label: "30 dias" },
  { days: 60, label: "60 dias" },
  { days: 90, label: "90 dias" },
  { days: 180, label: "6 meses" },
  { days: 365, label: "12 meses" },
  { days: 730, label: "24 meses" }
] as const;

const dataDir = path.join(process.cwd(), ".sienge-data");
const dbFiles = {
  payables: path.join(dataDir, "finance-payables.sqlite"),
  receivables: path.join(dataDir, "finance-receivables.sqlite"),
  sales: path.join(dataDir, "commercial-sales.sqlite"),
  inventory: path.join(dataDir, "inventory-assets.sqlite"),
  purchases: path.join(dataDir, "purchases.sqlite")
};

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function period(days: number) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return {
    days,
    pastStart: iso(addDays(today, -(days - 1))),
    today: iso(today),
    futureEnd: iso(addDays(today, days - 1))
  };
}

function periodBounds(range: DashboardPeriodRange) {
  const direction = range.direction;
  return direction === "past"
    ? { start: range.pastStart, end: range.today }
    : { start: range.today, end: range.futureEnd };
}

function dayLabel(value?: string) {
  if (!value) return "Sem data";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
}

function monthLabel(value?: string) {
  if (!value) return "Sem mês";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(date).replace(".", "");
}

function weekLabel(start: string, end: string) {
  return `${dayLabel(start)} a ${dayLabel(end)}`;
}

function dashboardPeriodLabel(days: number) {
  if (days === 1) return "hoje";
  if (days < 30) return `${days} dias`;
  if (days === 30) return "30 dias";
  const months = Math.round(days / 30);
  return `${months} mês${months > 1 ? "es" : ""}`;
}

function cashFlowGranularityLabel(days: number) {
  if (days >= 180) return "agrupado por mês";
  if (days >= 60) return "agrupado por semana";
  return "por dia";
}

export function normalizeDashboardDays(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const days = Number(rawValue);
  return DASHBOARD_PERIOD_OPTIONS.some((option) => option.days === days) ? days : 7;
}

export function normalizeDashboardDirection(value: unknown): DashboardPeriodDirection {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "past" ? "past" : "future";
}

export function normalizeDashboardOverdueMode(value: unknown): DashboardOverdueMode {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "all" ? "all" : "period";
}

function openDatabase(databasePath: string) {
  if (!existsSync(databasePath)) return undefined;
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA busy_timeout = 4000;");
  return database;
}

function tableExists(database: DatabaseSync, table: string) {
  return Boolean(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function safeJson<T>(text: string): T | undefined {
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

function localError(endpoint: string, title: string) {
  return {
    method: "GET",
    endpoint,
    title,
    explanation: "O dashboard não encontrou dados suficientes para esta visão.",
    suggestion: "Atualize esta área em Configurações.",
    occurredAt: new Date().toISOString()
  };
}

function rowsToChart(rows: Row[]): DatedChartItem[] {
  return rows.map((row) => ({
    dateKey: String(row.labelDate || "").slice(0, 10),
    label: dayLabel(String(row.labelDate || "")),
    value: Number(row.value || 0),
    count: Number(row.count || 0)
  }));
}

function chartGroupKey(range: DashboardPeriodRange, dateKey: string) {
  if (range.days >= 180) return { key: dateKey.slice(0, 7), label: monthLabel(dateKey) };
  if (range.days >= 60) {
    const bounds = periodBounds(range);
    const start = new Date(`${bounds.start}T12:00:00`);
    const current = new Date(`${dateKey}T12:00:00`);
    const offset = Math.max(0, Math.floor((current.getTime() - start.getTime()) / 86400000));
    const weekStart = addDays(start, Math.floor(offset / 7) * 7);
    const weekEnd = addDays(weekStart, 6);
    return { key: iso(weekStart), label: weekLabel(iso(weekStart), iso(weekEnd)) };
  }
  return { key: dateKey, label: dayLabel(dateKey) };
}

function groupedChartItems(range: DashboardPeriodRange, items: Array<{ date?: string; value?: number }>) {
  const groups = new Map<string, ChartItem>();
  items.forEach((item) => {
    const dateKey = item.date?.slice(0, 10);
    if (!dateKey) return;
    const group = chartGroupKey(range, dateKey);
    const current = groups.get(group.key) || { label: group.label, value: 0, count: 0 };
    current.value += item.value || 0;
    current.count += 1;
    groups.set(group.key, current);
  });
  return Array.from(groups.entries())
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .map(([, item]) => item);
}

function emptyPayables(error?: ReturnType<typeof localError>): PayablesResult {
  return { entries: [], totalCount: 0, error };
}

function loadPayablesSummary(range: DashboardPeriodRange) {
  const bounds = periodBounds(range);
  const overdueBounds = range.overdueMode === "all"
    ? { start: "0001-01-01", end: range.today }
    : bounds;
  const database = openDatabase(dbFiles.payables);
  if (!database) {
    return {
      payables: emptyPayables(localError("/bulk-data/v1/outcome", "Contas a pagar sem dados carregados")),
      payableSummary: emptyPayableSummary()
    };
  }
  try {
    if (!tableExists(database, "bulk_outcome_installments")) {
      return {
        payables: emptyPayables(localError("/bulk-data/v1/outcome", "Parcelas a pagar ainda não disponíveis")),
        payableSummary: emptyPayableSummary()
      };
    }
    const hasPaymentsTable = tableExists(database, "bulk_outcome_payments");
    const openPaymentsJoin = hasPaymentsTable
      ? `LEFT JOIN bulk_outcome_payments p
          ON p.tenant = i.tenant
          AND p.billId = i.billId
          AND p.installmentId = i.installmentId`
      : "";
    const openPaymentsFilter = hasPaymentsTable ? "AND p.billId IS NULL" : "";
    const amountExpression = "COALESCE(correctedBalanceAmount, balanceAmount, originalAmount, 0)";
    const expectedAmountExpression = "COALESCE(i.originalAmount, i.correctedBalanceAmount, i.balanceAmount, 0)";
    const openAmountExpression = "COALESCE(i.correctedBalanceAmount, i.balanceAmount, i.originalAmount, 0)";
    const periodExpected = database.prepare(`
      SELECT COUNT(*) AS count, SUM(${expectedAmountExpression}) AS total
      FROM bulk_outcome_installments i
      WHERE i.dueDate BETWEEN ? AND ?
        AND ${expectedAmountExpression} > 0
    `).get(bounds.start, bounds.end) as Row;
    const periodTotals = database.prepare(`
      SELECT COUNT(*) AS count, SUM(${openAmountExpression}) AS total
      FROM bulk_outcome_installments i
      ${openPaymentsJoin}
      WHERE i.dueDate BETWEEN ? AND ?
        AND ${openAmountExpression} > 0
        ${openPaymentsFilter}
    `).get(bounds.start, bounds.end) as Row;
    const totals = database.prepare(`
      SELECT
        COUNT(*) AS count,
        SUM(${openAmountExpression}) AS total,
        SUM(CASE WHEN i.consistencyStatus IS NULL OR i.consistencyStatus <> 'S' THEN 1 ELSE 0 END) AS incomplete
      FROM bulk_outcome_installments i
      ${openPaymentsJoin}
      WHERE i.dueDate BETWEEN ? AND ?
        AND i.dueDate >= ?
        AND ${openAmountExpression} > 0
        ${openPaymentsFilter}
    `).get(bounds.start, bounds.end, range.today) as Row;
    const overdue = database.prepare(`
      SELECT COUNT(*) AS count, SUM(${openAmountExpression}) AS total
      FROM bulk_outcome_installments i
      ${openPaymentsJoin}
      WHERE i.dueDate BETWEEN ? AND ?
        AND i.dueDate < ?
        AND ${openAmountExpression} > 0
        ${openPaymentsFilter}
    `).get(overdueBounds.start, overdueBounds.end, range.today) as Row;
    const paid = hasPaymentsTable
      ? database.prepare(`
        SELECT COUNT(*) AS count, SUM(COALESCE(netAmount, correctedNetAmount, grossAmount, 0)) AS total
        FROM bulk_outcome_payments
        WHERE paymentDate BETWEEN ? AND ?
          AND COALESCE(netAmount, correctedNetAmount, grossAmount, 0) > 0
      `).get(bounds.start, bounds.end) as Row
      : { count: 0, total: 0 };
    const paidMonthly = hasPaymentsTable
      ? rowsToChart(database.prepare(`
        SELECT paymentDate AS labelDate, SUM(COALESCE(netAmount, correctedNetAmount, grossAmount, 0)) AS value, COUNT(*) AS count
        FROM bulk_outcome_payments
        WHERE paymentDate BETWEEN ? AND ?
          AND COALESCE(netAmount, correctedNetAmount, grossAmount, 0) > 0
        GROUP BY paymentDate
        ORDER BY paymentDate ASC
      `).all(bounds.start, bounds.end) as Row[])
      : [];
    const periodPaid = hasPaymentsTable
      ? database.prepare(`
        SELECT COUNT(*) AS count, SUM(COALESCE(p.netAmount, p.correctedNetAmount, p.grossAmount, 0)) AS total
        FROM bulk_outcome_payments p
        INNER JOIN bulk_outcome_installments i
          ON i.tenant = p.tenant
          AND i.billId = p.billId
          AND i.installmentId = p.installmentId
        WHERE i.dueDate BETWEEN ? AND ?
          AND COALESCE(p.netAmount, p.correctedNetAmount, p.grossAmount, 0) > 0
      `).get(bounds.start, bounds.end) as Row
      : { count: 0, total: 0 };
    const monthly = rowsToChart(database.prepare(`
      SELECT i.dueDate AS labelDate, SUM(${openAmountExpression}) AS value, COUNT(*) AS count
      FROM bulk_outcome_installments i
      ${openPaymentsJoin}
      WHERE i.dueDate BETWEEN ? AND ?
        AND ${openAmountExpression} > 0
        ${openPaymentsFilter}
      GROUP BY i.dueDate
      ORDER BY i.dueDate ASC
    `).all(bounds.start, bounds.end) as Row[]);
    const creditors = (database.prepare(`
      SELECT COALESCE(i.creditorName, 'Fornecedor não informado') AS label, SUM(${openAmountExpression}) AS value, COUNT(*) AS count
      FROM bulk_outcome_installments i
      ${openPaymentsJoin}
      WHERE i.dueDate BETWEEN ? AND ?
        AND i.dueDate >= ?
        AND ${openAmountExpression} > 0
        ${openPaymentsFilter}
      GROUP BY COALESCE(i.creditorName, 'Fornecedor não informado')
      ORDER BY value DESC
      LIMIT 8
    `).all(bounds.start, bounds.end, range.today) as Row[]).map((row) => ({ label: String(row.label), value: Number(row.value || 0), count: Number(row.count || 0) }));
    const projects = (database.prepare(`
      SELECT COALESCE(i.projectName, i.companyName, 'Obra/empresa não informada') AS label, SUM(${openAmountExpression}) AS value, COUNT(*) AS count
      FROM bulk_outcome_installments i
      ${openPaymentsJoin}
      WHERE i.dueDate BETWEEN ? AND ?
        AND i.dueDate >= ?
        AND ${openAmountExpression} > 0
        ${openPaymentsFilter}
      GROUP BY COALESCE(i.projectName, i.companyName, 'Obra/empresa não informada')
      ORDER BY value DESC
      LIMIT 8
    `).all(bounds.start, bounds.end, range.today) as Row[]).map((row) => ({ label: String(row.label), value: Number(row.value || 0), count: Number(row.count || 0) }));

    const totalCount = Number(totals.count || 0);
    return {
      payables: { entries: [], totalCount },
      payableSummary: {
        totalAmount: Number(totals.total || 0),
        expectedAmount: Number(periodExpected.total || 0),
        expectedCount: Number(periodExpected.count || 0),
        periodAmount: Number(periodTotals.total || 0),
        periodCount: Number(periodTotals.count || 0),
        averageAmount: totalCount ? Number(totals.total || 0) / totalCount : 0,
        coverage: 100,
        completeCount: Math.max(0, totalCount - Number(totals.incomplete || 0)),
        incompleteCount: Number(totals.incomplete || 0),
        overdueAmount: Number(overdue.total || 0),
        overdueCount: Number(overdue.count || 0),
        paidAmount: Number(paid.total || 0),
        paidCount: Number(paid.count || 0),
        periodPaidAmount: Number(periodPaid.total || 0),
        periodPaidCount: Number(periodPaid.count || 0),
        monthly,
        paidMonthly,
        creditors,
        origins: projects,
        valueRanges: []
      }
    };
  } finally {
    database.close();
  }
}

function emptyPayableSummary() {
  return {
    totalAmount: 0,
    expectedAmount: 0,
    expectedCount: 0,
    periodAmount: 0,
    periodCount: 0,
    averageAmount: 0,
    coverage: 0,
    completeCount: 0,
    incompleteCount: 0,
    overdueAmount: 0,
    overdueCount: 0,
    paidAmount: 0,
    paidCount: 0,
    periodPaidAmount: 0,
    periodPaidCount: 0,
    monthly: [] as DatedChartItem[],
    paidMonthly: [] as DatedChartItem[],
    creditors: [] as ChartItem[],
    origins: [] as ChartItem[],
    valueRanges: [] as ChartItem[]
  };
}

function loadReceivablesSummary(range: DashboardPeriodRange) {
  const bounds = periodBounds(range);
  const overdueBounds = range.overdueMode === "all"
    ? { start: "0001-01-01", end: range.today }
    : bounds;
  const database = openDatabase(dbFiles.receivables);
  const empty = {
    receivables: { entries: [], forecastEntries: [], totalCount: 0, loadedFrom: "/bulk-data/v1/income", range: { startDate: bounds.start, endDate: bounds.end, correctionDate: range.today } },
      receivableSummary: {
        totalOpen: 0,
        expectedAmount: 0,
        expectedCount: 0,
        periodOpenAmount: 0,
        periodOpenCount: 0,
        overdueAmount: 0,
      currentMonthAmount: 0,
      next30DaysAmount: 0,
      forecastCount: 0,
      overdueCount: 0,
      receivedAmount: 0,
      receivedCount: 0,
      periodReceivedAmount: 0,
      periodReceivedCount: 0,
      monthly: [] as DatedChartItem[],
      receivedMonthly: [] as DatedChartItem[],
      clients: [] as ChartItem[],
      origins: [] as ChartItem[]
    }
  };
  if (!database) return { ...empty, receivables: { ...empty.receivables, error: localError("/bulk-data/v1/income", "Contas a receber sem dados carregados") } };
  try {
    if (!tableExists(database, "bulk_income_installments")) {
      return { ...empty, receivables: { ...empty.receivables, error: localError("/bulk-data/v1/income", "Recebíveis ainda não disponíveis") } };
    }
    const amountExpression = "COALESCE(correctedBalanceAmount, balanceAmount, originalAmount, 0)";
    const expectedAmountExpression = "COALESCE(originalAmount, correctedBalanceAmount, balanceAmount, 0)";
    const periodExpected = database.prepare(`
      SELECT COUNT(*) AS count, SUM(${expectedAmountExpression}) AS total
      FROM bulk_income_installments
      WHERE dueDate BETWEEN ? AND ?
        AND ${expectedAmountExpression} > 0
    `).get(bounds.start, bounds.end) as Row;
    const periodTotals = database.prepare(`
      SELECT COUNT(*) AS count, SUM(${amountExpression}) AS total
      FROM bulk_income_installments
      WHERE dueDate BETWEEN ? AND ?
        AND ${amountExpression} > 0
    `).get(bounds.start, bounds.end) as Row;
    const totals = database.prepare(`
      SELECT COUNT(*) AS count, SUM(${amountExpression}) AS total
      FROM bulk_income_installments
      WHERE dueDate BETWEEN ? AND ?
        AND dueDate >= ?
        AND ${amountExpression} > 0
    `).get(bounds.start, bounds.end, range.today) as Row;
    const overdue = database.prepare(`
      SELECT COUNT(*) AS count, SUM(${amountExpression}) AS total
      FROM bulk_income_installments
      WHERE dueDate BETWEEN ? AND ?
        AND dueDate < ?
        AND ${amountExpression} > 0
    `).get(overdueBounds.start, overdueBounds.end, range.today) as Row;
    const received = tableExists(database, "bulk_income_receipts")
      ? database.prepare(`
        SELECT COUNT(*) AS count, SUM(COALESCE(netAmount, grossAmount, 0)) AS total
        FROM bulk_income_receipts
        WHERE paymentDate BETWEEN ? AND ?
          AND COALESCE(netAmount, grossAmount, 0) > 0
      `).get(bounds.start, bounds.end) as Row
      : { count: 0, total: 0 };
    const receivedMonthly = tableExists(database, "bulk_income_receipts")
      ? rowsToChart(database.prepare(`
        SELECT paymentDate AS labelDate, SUM(COALESCE(netAmount, grossAmount, 0)) AS value, COUNT(*) AS count
        FROM bulk_income_receipts
        WHERE paymentDate BETWEEN ? AND ?
          AND COALESCE(netAmount, grossAmount, 0) > 0
        GROUP BY paymentDate
        ORDER BY paymentDate ASC
      `).all(bounds.start, bounds.end) as Row[])
      : [];
    const periodReceived = tableExists(database, "bulk_income_receipts")
      ? database.prepare(`
        SELECT COUNT(*) AS count, SUM(COALESCE(r.netAmount, r.grossAmount, 0)) AS total
        FROM bulk_income_receipts r
        INNER JOIN bulk_income_installments i
          ON i.tenant = r.tenant
          AND i.billId = r.billId
          AND i.installmentId = r.installmentId
        WHERE i.dueDate BETWEEN ? AND ?
          AND COALESCE(r.netAmount, r.grossAmount, 0) > 0
      `).get(bounds.start, bounds.end) as Row
      : { count: 0, total: 0 };
    const monthly = rowsToChart(database.prepare(`
      SELECT dueDate AS labelDate, SUM(${amountExpression}) AS value, COUNT(*) AS count
      FROM bulk_income_installments
      WHERE dueDate BETWEEN ? AND ?
        AND ${amountExpression} > 0
      GROUP BY dueDate
      ORDER BY dueDate ASC
    `).all(bounds.start, bounds.end) as Row[]);
    const clients = (database.prepare(`
      SELECT COALESCE(clientName, 'Cliente não informado') AS label, SUM(${amountExpression}) AS value, COUNT(*) AS count
      FROM bulk_income_installments
      WHERE dueDate BETWEEN ? AND ?
        AND ${amountExpression} > 0
      GROUP BY COALESCE(clientName, 'Cliente não informado')
      ORDER BY value DESC
      LIMIT 8
    `).all(bounds.start, bounds.end) as Row[]).map((row) => ({ label: String(row.label), value: Number(row.value || 0), count: Number(row.count || 0) }));
    return {
      receivables: { ...empty.receivables, totalCount: Number(totals.count || 0) },
      receivableSummary: {
        ...empty.receivableSummary,
        totalOpen: Number(totals.total || 0),
        expectedAmount: Number(periodExpected.total || 0),
        expectedCount: Number(periodExpected.count || 0),
        periodOpenAmount: Number(periodTotals.total || 0),
        periodOpenCount: Number(periodTotals.count || 0),
        overdueAmount: Number(overdue.total || 0),
        next30DaysAmount: Number(totals.total || 0),
        forecastCount: Number(totals.count || 0),
        overdueCount: Number(overdue.count || 0),
        receivedAmount: Number(received.total || 0),
        receivedCount: Number(received.count || 0),
        periodReceivedAmount: Number(periodReceived.total || 0),
        periodReceivedCount: Number(periodReceived.count || 0),
        monthly,
        receivedMonthly,
        clients
      }
    };
  } finally {
    database.close();
  }
}

function genericRecords<T>(databasePath: string, endpoint: string) {
  const database = openDatabase(databasePath);
  if (!database) return { items: [] as T[], error: true };
  try {
    if (!tableExists(database, "sienge_records")) return { items: [] as T[], error: true };
    const rows = database.prepare("SELECT raw_json FROM sienge_records WHERE endpoint = ?").all(endpoint) as JsonRow[];
    return { items: rows.map((row) => safeJson<T>(row.raw_json)).filter((item): item is T => Boolean(item)), error: false };
  } finally {
    database.close();
  }
}

function inRange(value: string | undefined, start: string, end: string) {
  return Boolean(value && value.slice(0, 10) >= start && value.slice(0, 10) <= end);
}

function loadSalesSummary(range: DashboardPeriodRange) {
  const bounds = periodBounds(range);
  const { items, error } = genericRecords<SalesContract>(dbFiles.sales, "/v1/sales-contracts");
  const filtered = items.filter((contract) => inRange(contract.issueDate || contract.contractDate, bounds.start, bounds.end));
  const enterpriseMap = new Map<string, ChartItem>();
  const salesByPeriod = groupedChartItems(range, filtered.map((contract) => ({
    date: contract.issueDate || contract.contractDate,
    value: contract.totalSellingValue || contract.value || 0
  })));
  filtered.forEach((contract) => {
    const value = contract.totalSellingValue || contract.value || 0;

    const enterprise = contract.enterpriseName || "Empreendimento não informado";
    const current = enterpriseMap.get(enterprise) || { label: enterprise, value: 0, count: 0 };
    current.value += value;
    current.count += 1;
    enterpriseMap.set(enterprise, current);
  });
  const totalValue = filtered.reduce((sum, contract) => sum + (contract.totalSellingValue || contract.value || 0), 0);
  return {
    sales: { contracts: filtered, totalCount: filtered.length, ...(error ? { error: localError("/v1/sales-contracts", "Vendas sem dados carregados") } : {}) },
    salesSummary: {
      totalValue,
      outstandingBalance: 0,
      amountPaid: 0,
      averageValue: filtered.length ? totalValue / filtered.length : 0,
      activeCount: filtered.filter((contract) => !/cancelad|distrat/i.test(contract.situation || "")).length,
      cancelledCount: filtered.filter((contract) => /cancelad|distrat/i.test(contract.situation || "")).length,
      byEnterprise: Array.from(enterpriseMap.values()).sort((a, b) => b.value - a.value).slice(0, 8),
      bySituation: [],
      monthlySales: salesByPeriod
    }
  };
}

function inventoryKind(endpoint: string): InventoryAssetKind {
  if (endpoint === "/v1/patrimony/movable") return "movable";
  if (endpoint === "/v1/patrimony/fixed") return "fixed";
  return "unit";
}

function loadInventorySummary() {
  const database = openDatabase(dbFiles.inventory);
  const groups = new Map<string, ChartItem>();
  const stockGroups = new Map<string, ChartItem>();
  let error = false;
  if (!database) error = true;
  try {
    if (!database || !tableExists(database, "sienge_records")) error = true;
    const rows = database && tableExists(database, "sienge_records")
      ? database.prepare("SELECT endpoint, raw_json FROM sienge_records WHERE endpoint IN ('/v1/units', '/v1/patrimony/movable', '/v1/patrimony/fixed')").all() as Array<JsonRow & { endpoint: string }>
      : [];
    rows.forEach((row) => {
      const raw = safeJson<InventoryAsset>(row.raw_json);
      if (!raw) return;
      const asset = { ...raw, kind: inventoryKind(row.endpoint), id: String(raw.id || raw.patrimonyId || raw.unitId || row.endpoint) } as InventoryAsset;
      const label = assetKindLabel(asset.kind);
      const current = groups.get(label) || { label, value: 0, count: 0 };
      current.value += assetValue(asset).value;
      current.count += 1;
      groups.set(label, current);

      if (asset.kind === "unit") {
        const stock = stockLabel(asset.commercialStock);
        const stockCurrent = stockGroups.get(stock) || { label: stock, value: 0, count: 0 };
        stockCurrent.value += 1;
        stockCurrent.count += 1;
        stockGroups.set(stock, stockCurrent);
      }
    });
  } finally {
    database?.close();
  }
  const byKind = Array.from(groups.values()).sort((a, b) => b.count - a.count);
  const byStock = Array.from(stockGroups.values()).sort((a, b) => b.count - a.count).slice(0, 8);
  return {
    inventory: { assets: [], totalCount: byKind.reduce((sum, item) => sum + item.count, 0), rawTotalCount: byKind.reduce((sum, item) => sum + item.count, 0), sourceStats: [], ...(error ? { error: localError("/v1/units", "Estoque sem dados carregados") } : {}) },
    inventorySummary: {
      totalValue: byKind.reduce((sum, item) => sum + item.value, 0),
      ownCount: 0,
      thirdPartyCount: 0,
      unitCount: byKind.find((item) => item.label === "Unidade imobiliaria")?.count || 0,
      movableCount: byKind.find((item) => item.label === "Bem movel")?.count || 0,
      fixedCount: byKind.find((item) => item.label === "Bem imovel")?.count || 0,
      activeCount: 0,
      writtenOffCount: 0,
      byKind,
      byStock
    }
  };
}

function loadPurchasesSummary(range: DashboardPeriodRange) {
  const bounds = periodBounds(range);
  const { items, error } = genericRecords<PurchaseOrder>(dbFiles.purchases, "/v1/purchase-orders");
  const filtered = items.filter((order) => inRange(order.date, bounds.start, bounds.end));
  const validOrders = filtered.filter((order) => order.status !== "CANCELED");
  const isPendingOrder = (order: PurchaseOrder) => order.status === "PENDING" || order.status === "PARTIALLY_DELIVERED" || !order.authorized || Boolean(order.deliveryLate);
  const pending = validOrders.filter(isPendingOrder);
  const done = validOrders.filter((order) => !isPendingOrder(order));
  const late = pending.filter((order) => Boolean(order.deliveryLate));
  const pendingAmount = pending.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  const doneAmount = done.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  const lateAmount = late.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  const purchasedAmount = validOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  const purchasedByPeriod = groupedChartItems(range, validOrders.map((order) => ({ date: order.date, value: order.totalAmount || 0 })));
  return {
    purchases: { orders: filtered, invoices: [], requestItems: [], quotations: [], sourceStats: [], ...(error ? { error: localError("/v1/purchase-orders", "Compras sem dados carregados") } : {}) },
    purchaseSummary: {
      pendingCount: pending.length,
      pendingAmount,
      purchasedAmount,
      purchasedCount: done.length,
      requestCount: 0,
      orderCount: filtered.length,
      invoiceCount: 0,
      quotationCount: 0,
      lateOrders: late.length,
      byStatus: [],
      byBuyer: [],
      monthlyPurchased: purchasedByPeriod,
      periods: [
        { key: "last12", label: "Total comprado", note: dashboardPeriodLabel(range.days), amount: purchasedAmount, count: validOrders.length, pendingCount: pending.length, doneCount: done.length },
        { key: "last6", label: "Pendentes", note: "Aguardam conclusao", amount: pendingAmount, count: pending.length, pendingCount: pending.length, doneCount: 0 },
        { key: "previousMonth", label: "Concluidos", note: "Finalizados no recorte", amount: doneAmount, count: done.length, pendingCount: 0, doneCount: done.length },
        { key: "future", label: "Atrasados", note: "Pendentes em atraso", amount: lateAmount, count: late.length, pendingCount: late.length, doneCount: 0 }
      ],
      stages: [],
      flow: Array.from({ length: validOrders.length }, (_, index) => ({ id: String(index) }))
    }
  };
}

function dateKeysBetween(start: string, end: string) {
  const dates: string[] = [];
  const current = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  while (current <= last) {
    dates.push(iso(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function addToGroup(groups: Map<string, CashFlowChartItem>, label: string, income: number, outcome: number) {
  const current = groups.get(label) || { label, income: 0, outcome: 0 };
  current.income += income;
  current.outcome += outcome;
  groups.set(label, current);
}

function mergeCashFlow(range: DashboardPeriodRange, income: DatedChartItem[], outcome: DatedChartItem[]): CashFlowChartItem[] {
  const bounds = periodBounds(range);
  const incomeMap = new Map(income.map((item) => [item.dateKey, item.value]));
  const outcomeMap = new Map(outcome.map((item) => [item.dateKey, item.value]));
  const dates = dateKeysBetween(bounds.start, bounds.end);

  if (range.days >= 180) {
    const groups = new Map<string, CashFlowChartItem>();
    dates.forEach((dateKey) => {
      addToGroup(groups, monthLabel(dateKey), incomeMap.get(dateKey) || 0, outcomeMap.get(dateKey) || 0);
    });
    return Array.from(groups.values());
  }

  if (range.days >= 60) {
    const groups: CashFlowChartItem[] = [];
    for (let index = 0; index < dates.length; index += 7) {
      const week = dates.slice(index, index + 7);
      const label = weekLabel(week[0], week[week.length - 1]);
      groups.push({
        label,
        income: week.reduce((sum, dateKey) => sum + (incomeMap.get(dateKey) || 0), 0),
        outcome: week.reduce((sum, dateKey) => sum + (outcomeMap.get(dateKey) || 0), 0)
      });
    }
    return groups;
  }

  return dates.map((dateKey) => ({
    label: dayLabel(dateKey),
    income: incomeMap.get(dateKey) || 0,
    outcome: outcomeMap.get(dateKey) || 0
  }));
}

export async function loadDashboardOverview(days?: number, direction: DashboardPeriodDirection = "future", overdueMode: DashboardOverdueMode = "period") {
  const dashboardDays = normalizeDashboardDays(days);
  const dashboardDirection = normalizeDashboardDirection(direction);
  const dashboardOverdueMode = normalizeDashboardOverdueMode(overdueMode);
  const currentPeriod = { ...period(dashboardDays), direction: dashboardDirection, overdueMode: dashboardOverdueMode };
  const currentBounds = periodBounds(currentPeriod);
  const payables = loadPayablesSummary(currentPeriod);
  const receivables = loadReceivablesSummary(currentPeriod);
  const sales = loadSalesSummary(currentPeriod);
  const inventory = loadInventorySummary();
  const purchases = loadPurchasesSummary(currentPeriod);

  const unavailable = [
    payables.payables.error ? "contas a pagar" : undefined,
    (receivables.receivables as { error?: unknown }).error ? "contas a receber" : undefined,
    sales.sales.error ? "vendas" : undefined,
    inventory.inventory.error ? "estoque" : undefined,
    purchases.purchases.error ? "compras" : undefined
  ].filter(Boolean) as string[];
  const predictedBalance = dashboardDirection === "past"
    ? receivables.receivableSummary.periodOpenAmount - payables.payableSummary.periodAmount
    : receivables.receivableSummary.totalOpen - payables.payableSummary.totalAmount;
  const realizedBalance = receivables.receivableSummary.receivedAmount - payables.payableSummary.paidAmount;
  const cashFlowIncome = dashboardDirection === "past" ? receivables.receivableSummary.receivedMonthly : receivables.receivableSummary.monthly;
  const cashFlowOutcome = dashboardDirection === "past" ? payables.payableSummary.paidMonthly : payables.payableSummary.monthly;

  return {
    ...payables,
    ...receivables,
    ...sales,
    ...inventory,
    ...purchases,
    unavailable,
    dashboardDays,
    dashboardDirection,
    dashboardOverdueMode,
    dashboardRange: currentBounds,
    dashboardPeriodLabel: dashboardPeriodLabel(dashboardDays),
    cashFlowGranularityLabel: cashFlowGranularityLabel(dashboardDays),
    predictedBalance,
    realizedBalance,
    cashFlow: mergeCashFlow(currentPeriod, cashFlowIncome, cashFlowOutcome),
    salesMonthly: sales.salesSummary.monthlySales,
    purchasesMonthly: purchases.purchaseSummary.monthlyPurchased
  };
}
