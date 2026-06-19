import "server-only";
import { existsSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";

type Row = Record<string, unknown>;
type JsonRow = { raw_json: string; source_day?: string; saved_at?: string };

type ChartItem = {
  label: string;
  value: number;
  count: number;
};

export type DreMonthlyItem = {
  key: string;
  label: string;
  grossRevenue: number;
  cancellations: number;
  netRevenue: number;
  costs: number;
  competenceResult: number;
  received: number;
  paid: number;
  cashResult: number;
};

type SalesContract = {
  id?: number;
  number?: string;
  enterpriseName?: string;
  contractDate?: string;
  issueDate?: string;
  situation?: string;
  value?: number;
  totalSellingValue?: number;
  cancellationDate?: string;
};

type PurchaseOrder = {
  id?: number;
  date?: string;
  status?: string;
  totalAmount?: number;
  supplierId?: number;
};

const dataDir = path.join(process.cwd(), ".sienge-data");
const dbFiles = {
  payables: path.join(dataDir, "finance-payables.sqlite"),
  receivables: path.join(dataDir, "finance-receivables.sqlite"),
  sales: path.join(dataDir, "commercial-sales.sqlite"),
  purchases: path.join(dataDir, "purchases.sqlite")
};

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function todayIso() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return iso(today);
}

function normalizeDate(value?: string) {
  return value ? value.slice(0, 10) : undefined;
}

function inRange(value: string | undefined, start: string, end: string) {
  return Boolean(value && value >= start && value <= end);
}

function monthKey(value?: string) {
  return value ? value.slice(0, 7) : undefined;
}

function monthLabel(key: string) {
  const date = new Date(`${key}-01T12:00:00`);
  if (Number.isNaN(date.getTime())) return key;
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(date).replace(".", "");
}

export function normalizeDreYear(value: unknown, availableYears: number[] = []) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const year = Number(rawValue);
  const fallback = availableYears[0] || Number(todayIso().slice(0, 4));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return fallback;
  return availableYears.length && !availableYears.includes(year) ? fallback : year;
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

function money(value: unknown) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function addMonthlyValue(map: Map<string, number>, key: string | undefined, value: number) {
  if (!key || !value) return;
  map.set(key, (map.get(key) || 0) + value);
}

function addMonthlyCount(map: Map<string, number>, key: string | undefined) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

function rowsToMonthlyMap(rows: Row[], valueKey = "value") {
  const map = new Map<string, number>();
  rows.forEach((row) => addMonthlyValue(map, String(row.month || ""), money(row[valueKey])));
  return map;
}

function sourceStatus(databasePath: string, table: string, label: string, endpoint?: string) {
  const database = openDatabase(databasePath);
  if (!database) return { label, count: 0, lastIntegrationDay: undefined as string | undefined, lastSavedAt: undefined as string | undefined };
  try {
    if (!tableExists(database, table)) {
      return { label, count: 0, lastIntegrationDay: undefined as string | undefined, lastSavedAt: undefined as string | undefined };
    }
    const endpointFilter = endpoint ? "WHERE endpoint = ?" : "";
    const params = endpoint ? [endpoint] : [];
    const hasSourceDay = table === "sienge_records" || table.endsWith("_installments");
    const dayExpression = hasSourceDay ? "MAX(source_day)" : "NULL";
    const row = database.prepare(`
      SELECT COUNT(*) AS count, ${dayExpression} AS sourceDay, MAX(saved_at) AS savedAt
      FROM ${table}
      ${endpointFilter}
    `).get(...params) as Row;
    return {
      label,
      count: Number(row.count || 0),
      lastIntegrationDay: row.sourceDay ? String(row.sourceDay) : undefined,
      lastSavedAt: row.savedAt ? String(row.savedAt) : undefined
    };
  } finally {
    database.close();
  }
}

function addYearFromDate(years: Set<number>, value?: string) {
  const year = Number(value?.slice(0, 4));
  if (Number.isInteger(year) && year >= 2000 && year <= 2100) years.add(year);
}

function addYearsFromSql(databasePath: string, table: string, expression: string, years: Set<number>) {
  const database = openDatabase(databasePath);
  if (!database) return;
  try {
    if (!tableExists(database, table)) return;
    const rows = database.prepare(`
      SELECT DISTINCT substr(${expression}, 1, 4) AS year
      FROM ${table}
      WHERE ${expression} IS NOT NULL
    `).all() as Row[];
    rows.forEach((row) => addYearFromDate(years, String(row.year || "")));
  } finally {
    database.close();
  }
}

function addSalesYears(years: Set<number>) {
  const database = openDatabase(dbFiles.sales);
  if (!database) return;
  try {
    if (!tableExists(database, "sienge_records")) return;
    const rows = database.prepare("SELECT raw_json FROM sienge_records WHERE endpoint = '/v1/sales-contracts'").all() as JsonRow[];
    rows.forEach((row) => {
      const contract = safeJson<SalesContract>(row.raw_json);
      if (!contract) return;
      addYearFromDate(years, contract.issueDate || contract.contractDate);
      addYearFromDate(years, contract.cancellationDate);
    });
  } finally {
    database.close();
  }
}

function addPurchaseYears(years: Set<number>) {
  const database = openDatabase(dbFiles.purchases);
  if (!database) return;
  try {
    if (!tableExists(database, "sienge_records")) return;
    const rows = database.prepare("SELECT raw_json FROM sienge_records WHERE endpoint = '/v1/purchase-orders'").all() as JsonRow[];
    rows.forEach((row) => {
      const order = safeJson<PurchaseOrder>(row.raw_json);
      addYearFromDate(years, order?.date);
    });
  } finally {
    database.close();
  }
}

export function loadDreYearOptions() {
  const years = new Set<number>([Number(todayIso().slice(0, 4))]);
  addSalesYears(years);
  addPurchaseYears(years);
  addYearsFromSql(dbFiles.payables, "bulk_outcome_installments", "COALESCE(issueDate, billDate, dueDate)", years);
  addYearsFromSql(dbFiles.payables, "bulk_outcome_payments", "paymentDate", years);
  addYearsFromSql(dbFiles.receivables, "bulk_income_installments", "dueDate", years);
  addYearsFromSql(dbFiles.receivables, "bulk_income_receipts", "paymentDate", years);
  return Array.from(years).sort((left, right) => right - left);
}

function loadSales(start: string, end: string) {
  const database = openDatabase(dbFiles.sales);
  const monthlyGross = new Map<string, number>();
  const monthlyCancellations = new Map<string, number>();
  const monthlyCount = new Map<string, number>();
  const enterprises = new Map<string, ChartItem>();
  let grossRevenue = 0;
  let cancellations = 0;
  let contractCount = 0;
  let cancelledCount = 0;
  let unavailable = false;

  if (!database) unavailable = true;
  try {
    if (!database || !tableExists(database, "sienge_records")) unavailable = true;
    const rows = database && tableExists(database, "sienge_records")
      ? database.prepare("SELECT raw_json, source_day, saved_at FROM sienge_records WHERE endpoint = '/v1/sales-contracts'").all() as JsonRow[]
      : [];

    rows.forEach((row) => {
      const contract = safeJson<SalesContract>(row.raw_json);
      if (!contract) return;
      const saleDate = normalizeDate(contract.issueDate || contract.contractDate);
      const value = money(contract.totalSellingValue || contract.value);
      const cancelled = /cancelad|distrat/i.test(contract.situation || "") || Boolean(contract.cancellationDate);
      const cancellationDate = normalizeDate(contract.cancellationDate || saleDate);

      if (inRange(saleDate, start, end)) {
        grossRevenue += value;
        contractCount += 1;
        addMonthlyValue(monthlyGross, monthKey(saleDate), value);
        addMonthlyCount(monthlyCount, monthKey(saleDate));

        const label = contract.enterpriseName || "Empreendimento não informado";
        const current = enterprises.get(label) || { label, value: 0, count: 0 };
        current.value += value;
        current.count += 1;
        enterprises.set(label, current);
      }

      if (cancelled && inRange(cancellationDate, start, end)) {
        cancellations += value;
        cancelledCount += 1;
        addMonthlyValue(monthlyCancellations, monthKey(cancellationDate), value);
      }
    });
  } finally {
    database?.close();
  }

  return {
    grossRevenue,
    cancellations,
    netRevenue: grossRevenue - cancellations,
    contractCount,
    cancelledCount,
    monthlyGross,
    monthlyCancellations,
    monthlyCount,
    enterprises: Array.from(enterprises.values()).sort((left, right) => right.value - left.value).slice(0, 10),
    unavailable
  };
}

function loadPurchases(start: string, end: string) {
  const database = openDatabase(dbFiles.purchases);
  let purchasedAmount = 0;
  let orderCount = 0;
  let pendingCount = 0;
  let unavailable = false;

  if (!database) unavailable = true;
  try {
    if (!database || !tableExists(database, "sienge_records")) unavailable = true;
    const rows = database && tableExists(database, "sienge_records")
      ? database.prepare("SELECT raw_json FROM sienge_records WHERE endpoint = '/v1/purchase-orders'").all() as JsonRow[]
      : [];
    rows.forEach((row) => {
      const order = safeJson<PurchaseOrder>(row.raw_json);
      if (!order || !inRange(normalizeDate(order.date), start, end) || order.status === "CANCELED") return;
      const amount = money(order.totalAmount);
      purchasedAmount += amount;
      orderCount += 1;
      if (order.status === "PENDING" || order.status === "PARTIALLY_DELIVERED") pendingCount += 1;
    });
  } finally {
    database?.close();
  }

  return { purchasedAmount, orderCount, pendingCount, unavailable };
}

function loadPayables(start: string, end: string) {
  const database = openDatabase(dbFiles.payables);
  const empty = {
    costs: 0,
    costCount: 0,
    paid: 0,
    paidCount: 0,
    openPayables: 0,
    openPayablesCount: 0,
    monthlyCosts: new Map<string, number>(),
    monthlyPaid: new Map<string, number>(),
    creditors: [] as ChartItem[],
    unavailable: true
  };
  if (!database) return empty;
  try {
    if (!tableExists(database, "bulk_outcome_installments")) return empty;
    const dateExpression = "COALESCE(issueDate, billDate, dueDate)";
    const amountExpression = "COALESCE(originalAmount, correctedBalanceAmount, balanceAmount, 0)";
    const costRow = database.prepare(`
      SELECT COUNT(*) AS count, SUM(${amountExpression}) AS total
      FROM bulk_outcome_installments
      WHERE ${dateExpression} BETWEEN ? AND ?
        AND ${amountExpression} > 0
    `).get(start, end) as Row;
    const monthlyCosts = rowsToMonthlyMap(database.prepare(`
      SELECT substr(${dateExpression}, 1, 7) AS month, SUM(${amountExpression}) AS value
      FROM bulk_outcome_installments
      WHERE ${dateExpression} BETWEEN ? AND ?
        AND ${amountExpression} > 0
      GROUP BY substr(${dateExpression}, 1, 7)
      ORDER BY month ASC
    `).all(start, end) as Row[]);
    const creditors = (database.prepare(`
      SELECT COALESCE(creditorName, 'Fornecedor não informado') AS label, SUM(${amountExpression}) AS value, COUNT(*) AS count
      FROM bulk_outcome_installments
      WHERE ${dateExpression} BETWEEN ? AND ?
        AND ${amountExpression} > 0
      GROUP BY COALESCE(creditorName, 'Fornecedor não informado')
      ORDER BY value DESC
      LIMIT 10
    `).all(start, end) as Row[]).map((row) => ({
      label: String(row.label),
      value: money(row.value),
      count: Number(row.count || 0)
    }));

    const hasPayments = tableExists(database, "bulk_outcome_payments");
    const paidRow = hasPayments
      ? database.prepare(`
        SELECT COUNT(*) AS count, SUM(COALESCE(netAmount, correctedNetAmount, grossAmount, 0)) AS total
        FROM bulk_outcome_payments
        WHERE paymentDate BETWEEN ? AND ?
          AND COALESCE(netAmount, correctedNetAmount, grossAmount, 0) > 0
      `).get(start, end) as Row
      : { count: 0, total: 0 };
    const monthlyPaid = hasPayments
      ? rowsToMonthlyMap(database.prepare(`
        SELECT substr(paymentDate, 1, 7) AS month, SUM(COALESCE(netAmount, correctedNetAmount, grossAmount, 0)) AS value
        FROM bulk_outcome_payments
        WHERE paymentDate BETWEEN ? AND ?
          AND COALESCE(netAmount, correctedNetAmount, grossAmount, 0) > 0
        GROUP BY substr(paymentDate, 1, 7)
        ORDER BY month ASC
      `).all(start, end) as Row[])
      : new Map<string, number>();

    const openJoin = hasPayments
      ? `LEFT JOIN bulk_outcome_payments p
          ON p.tenant = i.tenant
          AND p.billId = i.billId
          AND p.installmentId = i.installmentId`
      : "";
    const openPaymentFilter = hasPayments ? "AND p.billId IS NULL" : "";
    const openRow = database.prepare(`
      SELECT COUNT(*) AS count, SUM(COALESCE(i.correctedBalanceAmount, i.balanceAmount, i.originalAmount, 0)) AS total
      FROM bulk_outcome_installments i
      ${openJoin}
      WHERE i.dueDate <= ?
        AND COALESCE(i.correctedBalanceAmount, i.balanceAmount, i.originalAmount, 0) > 0
        ${openPaymentFilter}
    `).get(end) as Row;

    return {
      costs: money(costRow.total),
      costCount: Number(costRow.count || 0),
      paid: money(paidRow.total),
      paidCount: Number(paidRow.count || 0),
      openPayables: money(openRow.total),
      openPayablesCount: Number(openRow.count || 0),
      monthlyCosts,
      monthlyPaid,
      creditors,
      unavailable: false
    };
  } finally {
    database.close();
  }
}

function loadReceivables(start: string, end: string) {
  const database = openDatabase(dbFiles.receivables);
  const empty = {
    received: 0,
    receivedCount: 0,
    openReceivables: 0,
    openReceivablesCount: 0,
    monthlyReceived: new Map<string, number>(),
    unavailable: true
  };
  if (!database) return empty;
  try {
    if (!tableExists(database, "bulk_income_installments")) return empty;
    const hasReceipts = tableExists(database, "bulk_income_receipts");
    const receivedRow = hasReceipts
      ? database.prepare(`
        SELECT COUNT(*) AS count, SUM(COALESCE(netAmount, grossAmount, 0)) AS total
        FROM bulk_income_receipts
        WHERE paymentDate BETWEEN ? AND ?
          AND COALESCE(netAmount, grossAmount, 0) > 0
      `).get(start, end) as Row
      : { count: 0, total: 0 };
    const monthlyReceived = hasReceipts
      ? rowsToMonthlyMap(database.prepare(`
        SELECT substr(paymentDate, 1, 7) AS month, SUM(COALESCE(netAmount, grossAmount, 0)) AS value
        FROM bulk_income_receipts
        WHERE paymentDate BETWEEN ? AND ?
          AND COALESCE(netAmount, grossAmount, 0) > 0
        GROUP BY substr(paymentDate, 1, 7)
        ORDER BY month ASC
      `).all(start, end) as Row[])
      : new Map<string, number>();

    const openRow = database.prepare(`
      SELECT COUNT(*) AS count, SUM(COALESCE(correctedBalanceAmount, balanceAmount, originalAmount, 0)) AS total
      FROM bulk_income_installments
      WHERE dueDate <= ?
        AND COALESCE(correctedBalanceAmount, balanceAmount, originalAmount, 0) > 0
    `).get(end) as Row;

    return {
      received: money(receivedRow.total),
      receivedCount: Number(receivedRow.count || 0),
      openReceivables: money(openRow.total),
      openReceivablesCount: Number(openRow.count || 0),
      monthlyReceived,
      unavailable: false
    };
  } finally {
    database.close();
  }
}

function buildMonthly({
  sales,
  payables,
  receivables
}: {
  sales: ReturnType<typeof loadSales>;
  payables: ReturnType<typeof loadPayables>;
  receivables: ReturnType<typeof loadReceivables>;
}) {
  const keys = new Set<string>();
  [
    sales.monthlyGross,
    sales.monthlyCancellations,
    payables.monthlyCosts,
    payables.monthlyPaid,
    receivables.monthlyReceived
  ].forEach((map) => map.forEach((_, key) => keys.add(key)));

  return Array.from(keys)
    .sort((left, right) => left.localeCompare(right))
    .map((key): DreMonthlyItem => {
      const grossRevenue = sales.monthlyGross.get(key) || 0;
      const cancellations = sales.monthlyCancellations.get(key) || 0;
      const netRevenue = grossRevenue - cancellations;
      const costs = payables.monthlyCosts.get(key) || 0;
      const received = receivables.monthlyReceived.get(key) || 0;
      const paid = payables.monthlyPaid.get(key) || 0;
      return {
        key,
        label: monthLabel(key),
        grossRevenue,
        cancellations,
        netRevenue,
        costs,
        competenceResult: netRevenue - costs,
        received,
        paid,
        cashResult: received - paid
      };
    });
}

export async function loadDreGerencial(year = Number(todayIso().slice(0, 4))) {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const sales = loadSales(start, end);
  const payables = loadPayables(start, end);
  const receivables = loadReceivables(start, end);
  const purchases = loadPurchases(start, end);
  const monthly = buildMonthly({ sales, payables, receivables });
  const netResult = sales.netRevenue - payables.costs;
  const cashResult = receivables.received - payables.paid;
  const margin = sales.netRevenue ? (netResult / sales.netRevenue) * 100 : 0;

  return {
    year,
    range: { start, end },
    unavailable: [
      sales.unavailable ? "vendas" : undefined,
      payables.unavailable ? "contas a pagar" : undefined,
      receivables.unavailable ? "contas a receber" : undefined,
      purchases.unavailable ? "compras" : undefined
    ].filter(Boolean) as string[],
    grossRevenue: sales.grossRevenue,
    cancellations: sales.cancellations,
    netRevenue: sales.netRevenue,
    costAmount: payables.costs,
    costCount: payables.costCount,
    netResult,
    margin,
    receivedAmount: receivables.received,
    receivedCount: receivables.receivedCount,
    paidAmount: payables.paid,
    paidCount: payables.paidCount,
    cashResult,
    openReceivables: receivables.openReceivables,
    openReceivablesCount: receivables.openReceivablesCount,
    openPayables: payables.openPayables,
    openPayablesCount: payables.openPayablesCount,
    purchasedAmount: purchases.purchasedAmount,
    purchaseOrderCount: purchases.orderCount,
    pendingPurchaseCount: purchases.pendingCount,
    contractCount: sales.contractCount,
    cancelledContractCount: sales.cancelledCount,
    monthly,
    competenceFlow: monthly.map((item) => ({ label: item.label, income: Math.max(0, item.netRevenue), outcome: Math.max(0, item.costs) })),
    cashFlow: monthly.map((item) => ({ label: item.label, income: Math.max(0, item.received), outcome: Math.max(0, item.paid) })),
    salesByEnterprise: sales.enterprises,
    expenseByCreditor: payables.creditors,
    integrations: [
      sourceStatus(dbFiles.sales, "sienge_records", "Vendas", "/v1/sales-contracts"),
      sourceStatus(dbFiles.receivables, "bulk_income_installments", "Contas a receber"),
      sourceStatus(dbFiles.payables, "bulk_outcome_installments", "Contas a pagar"),
      sourceStatus(dbFiles.purchases, "sienge_records", "Compras", "/v1/purchase-orders")
    ]
  };
}
