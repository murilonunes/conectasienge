import "server-only";
import { existsSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";

type Row = Record<string, unknown>;

type ChartItem = {
  label: string;
  value: number;
  count: number;
};

export type FinancialDreMonthlyItem = {
  key: string;
  label: string;
  receivableDue: number;
  receivableReceived: number;
  payableDue: number;
  payablePaid: number;
  projectedResult: number;
  realizedResult: number;
  openReceivables: number;
  openPayables: number;
};

export type FinancialDreFutureGroup = {
  key: string;
  label: string;
  receivableOpen: number;
  receivableCount: number;
  payableOpen: number;
  payableCount: number;
  netResult: number;
};

export type FinancialDreYearlyItem = {
  year: number;
  receivableDue: number;
  payableDue: number;
  projectedResult: number;
  receivableReceived: number;
  payablePaid: number;
  realizedResult: number;
};

const dataDir = path.join(process.cwd(), ".sienge-data");
const dbFiles = {
  payables: path.join(dataDir, "finance-payables.sqlite"),
  receivables: path.join(dataDir, "finance-receivables.sqlite")
};

const futureBuckets = [
  { key: "d30", label: "Hoje a 30 dias", min: 0, max: 30 },
  { key: "d60", label: "31 a 60 dias", min: 31, max: 60 },
  { key: "d90", label: "61 a 90 dias", min: 61, max: 90 },
  { key: "d180", label: "91 a 180 dias", min: 91, max: 180 },
  { key: "d365", label: "181 a 365 dias", min: 181, max: 365 },
  { key: "future", label: "Acima de 365 dias", min: 366, max: Number.POSITIVE_INFINITY }
] as const;

function openDatabase(databasePath: string) {
  if (!existsSync(databasePath)) return undefined;
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA busy_timeout = 4000;");
  return database;
}

function tableExists(database: DatabaseSync, table: string) {
  return Boolean(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function money(value: unknown) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function todayIso() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return iso(today);
}

function monthLabel(key: string) {
  const date = new Date(`${key}-01T12:00:00`);
  if (Number.isNaN(date.getTime())) return key;
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(date).replace(".", "");
}

function addYear(years: Set<number>, value: unknown) {
  const year = Number(String(value || "").slice(0, 4));
  if (Number.isInteger(year) && year >= 2000 && year <= 2100) years.add(year);
}

function addYearsFromTable(databasePath: string, table: string, dateColumns: string[], years: Set<number>) {
  const database = openDatabase(databasePath);
  if (!database) return 0;
  try {
    if (!tableExists(database, table)) return 0;
    const columns = dateColumns.join(", ");
    const rows = database.prepare(`SELECT ${columns} FROM ${table}`).all() as Row[];
    rows.forEach((row) => dateColumns.forEach((column) => addYear(years, row[column])));
    return rows.length;
  } finally {
    database.close();
  }
}

export function loadFinancialDreYearOptions() {
  const years = new Set<number>();
  addYearsFromTable(dbFiles.receivables, "bulk_income_installments", ["dueDate"], years);
  addYearsFromTable(dbFiles.receivables, "bulk_income_receipts", ["paymentDate"], years);
  addYearsFromTable(dbFiles.payables, "bulk_outcome_installments", ["dueDate"], years);
  addYearsFromTable(dbFiles.payables, "bulk_outcome_payments", ["paymentDate"], years);
  if (!years.size) years.add(Number(todayIso().slice(0, 4)));
  return Array.from(years).sort((left, right) => right - left);
}

export function normalizeFinancialDreYear(value: unknown, availableYears: number[] = []) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const year = Number(rawValue);
  const fallback = availableYears.includes(Number(todayIso().slice(0, 4)))
    ? Number(todayIso().slice(0, 4))
    : availableYears[0] || Number(todayIso().slice(0, 4));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return fallback;
  return availableYears.length && !availableYears.includes(year) ? fallback : year;
}

function rowsToMonthlyMap(rows: Row[]) {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    const key = String(row.month || "");
    if (!key) return;
    map.set(key, (map.get(key) || 0) + money(row.value));
  });
  return map;
}

function rowsToMonthlyCount(rows: Row[]) {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    const key = String(row.month || "");
    if (!key) return;
    map.set(key, (map.get(key) || 0) + Number(row.count || 0));
  });
  return map;
}

function chartRows(rows: Row[]): ChartItem[] {
  return rows.map((row) => ({
    label: String(row.label || "Não informado"),
    value: money(row.value),
    count: Number(row.count || 0)
  }));
}

function sourceStatus(databasePath: string, table: string, label: string) {
  const database = openDatabase(databasePath);
  if (!database) return { label, count: 0, lastIntegrationDay: undefined as string | undefined, lastSavedAt: undefined as string | undefined };
  try {
    if (!tableExists(database, table)) {
      return { label, count: 0, lastIntegrationDay: undefined as string | undefined, lastSavedAt: undefined as string | undefined };
    }
    const hasSourceDay = table.endsWith("_installments");
    const dayExpression = hasSourceDay ? "MAX(source_day)" : "NULL";
    const row = database.prepare(`
      SELECT COUNT(*) AS count, ${dayExpression} AS sourceDay, MAX(saved_at) AS savedAt
      FROM ${table}
    `).get() as Row;
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

function daysBetween(start: string, end: string) {
  const startTime = new Date(`${start}T12:00:00`).getTime();
  const endTime = new Date(`${end}T12:00:00`).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return undefined;
  return Math.floor((endTime - startTime) / 86_400_000);
}

function emptyFutureGroups(): FinancialDreFutureGroup[] {
  return futureBuckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    receivableOpen: 0,
    receivableCount: 0,
    payableOpen: 0,
    payableCount: 0,
    netResult: 0
  }));
}

function bucketForDueDate(baseDate: string, dueDate: unknown) {
  const days = daysBetween(baseDate, String(dueDate || "").slice(0, 10));
  if (days === undefined || days < 0) return undefined;
  return futureBuckets.find((bucket) => days >= bucket.min && days <= bucket.max);
}

function addFutureOpen(groups: FinancialDreFutureGroup[], kind: "receivable" | "payable", baseDate: string, rows: Row[]) {
  rows.forEach((row) => {
    const bucket = bucketForDueDate(baseDate, row.dueDate);
    if (!bucket) return;
    const current = groups.find((item) => item.key === bucket.key);
    if (!current) return;
    const value = money(row.value);
    if (kind === "receivable") {
      current.receivableOpen += value;
      current.receivableCount += 1;
    } else {
      current.payableOpen += value;
      current.payableCount += 1;
    }
    current.netResult = current.receivableOpen - current.payableOpen;
  });
}

function loadReceivables(start: string, end: string, baseDate: string) {
  const database = openDatabase(dbFiles.receivables);
  const empty = {
    due: 0,
    dueCount: 0,
    received: 0,
    receivedCount: 0,
    open: 0,
    openCount: 0,
    overdue: 0,
    overdueCount: 0,
    monthlyDue: new Map<string, number>(),
    monthlyReceived: new Map<string, number>(),
    monthlyOpen: new Map<string, number>(),
    monthlyDueCount: new Map<string, number>(),
    clients: [] as ChartItem[],
    futureRows: [] as Row[],
    unavailable: true
  };
  if (!database) return empty;
  try {
    if (!tableExists(database, "bulk_income_installments")) return empty;
    const installmentAmount = "COALESCE(originalAmount, correctedBalanceAmount, balanceAmount, 0)";
    const openAmount = "COALESCE(correctedBalanceAmount, balanceAmount, 0)";
    const dueRow = database.prepare(`
      SELECT COUNT(*) AS count, SUM(${installmentAmount}) AS total
      FROM bulk_income_installments
      WHERE dueDate BETWEEN ? AND ? AND ${installmentAmount} > 0
    `).get(start, end) as Row;
    const monthlyDue = rowsToMonthlyMap(database.prepare(`
      SELECT substr(dueDate, 1, 7) AS month, SUM(${installmentAmount}) AS value
      FROM bulk_income_installments
      WHERE dueDate BETWEEN ? AND ? AND ${installmentAmount} > 0
      GROUP BY substr(dueDate, 1, 7)
    `).all(start, end) as Row[]);
    const monthlyDueCount = rowsToMonthlyCount(database.prepare(`
      SELECT substr(dueDate, 1, 7) AS month, COUNT(*) AS count
      FROM bulk_income_installments
      WHERE dueDate BETWEEN ? AND ? AND ${installmentAmount} > 0
      GROUP BY substr(dueDate, 1, 7)
    `).all(start, end) as Row[]);
    const monthlyOpen = rowsToMonthlyMap(database.prepare(`
      SELECT substr(dueDate, 1, 7) AS month, SUM(${openAmount}) AS value
      FROM bulk_income_installments
      WHERE dueDate BETWEEN ? AND ? AND ${openAmount} > 0
      GROUP BY substr(dueDate, 1, 7)
    `).all(start, end) as Row[]);
    const openRow = database.prepare(`
      SELECT COUNT(*) AS count, SUM(${openAmount}) AS total
      FROM bulk_income_installments
      WHERE dueDate BETWEEN ? AND ? AND ${openAmount} > 0
    `).get(start, end) as Row;
    const overdueRow = database.prepare(`
      SELECT COUNT(*) AS count, SUM(${openAmount}) AS total
      FROM bulk_income_installments
      WHERE dueDate BETWEEN ? AND ? AND dueDate < ? AND ${openAmount} > 0
    `).get(start, end, baseDate) as Row;
    const clients = chartRows(database.prepare(`
      SELECT COALESCE(clientName, 'Cliente não informado') AS label, SUM(${installmentAmount}) AS value, COUNT(*) AS count
      FROM bulk_income_installments
      WHERE dueDate BETWEEN ? AND ? AND ${installmentAmount} > 0
      GROUP BY COALESCE(clientName, 'Cliente não informado')
      ORDER BY value DESC
      LIMIT 10
    `).all(start, end) as Row[]);
    const futureRows = database.prepare(`
      SELECT dueDate, ${openAmount} AS value
      FROM bulk_income_installments
      WHERE dueDate >= ? AND ${openAmount} > 0
    `).all(baseDate) as Row[];
    const hasReceipts = tableExists(database, "bulk_income_receipts");
    const receivedRow = hasReceipts
      ? database.prepare(`
        SELECT COUNT(*) AS count, SUM(COALESCE(netAmount, grossAmount, 0)) AS total
        FROM bulk_income_receipts
        WHERE paymentDate BETWEEN ? AND ? AND COALESCE(netAmount, grossAmount, 0) > 0
      `).get(start, end) as Row
      : { count: 0, total: 0 };
    const monthlyReceived = hasReceipts
      ? rowsToMonthlyMap(database.prepare(`
        SELECT substr(paymentDate, 1, 7) AS month, SUM(COALESCE(netAmount, grossAmount, 0)) AS value
        FROM bulk_income_receipts
        WHERE paymentDate BETWEEN ? AND ? AND COALESCE(netAmount, grossAmount, 0) > 0
        GROUP BY substr(paymentDate, 1, 7)
      `).all(start, end) as Row[])
      : new Map<string, number>();

    return {
      due: money(dueRow.total),
      dueCount: Number(dueRow.count || 0),
      received: money(receivedRow.total),
      receivedCount: Number(receivedRow.count || 0),
      open: money(openRow.total),
      openCount: Number(openRow.count || 0),
      overdue: money(overdueRow.total),
      overdueCount: Number(overdueRow.count || 0),
      monthlyDue,
      monthlyReceived,
      monthlyOpen,
      monthlyDueCount,
      clients,
      futureRows,
      unavailable: false
    };
  } finally {
    database.close();
  }
}

function loadPayables(start: string, end: string, baseDate: string) {
  const database = openDatabase(dbFiles.payables);
  const empty = {
    due: 0,
    dueCount: 0,
    paid: 0,
    paidCount: 0,
    open: 0,
    openCount: 0,
    overdue: 0,
    overdueCount: 0,
    monthlyDue: new Map<string, number>(),
    monthlyPaid: new Map<string, number>(),
    monthlyOpen: new Map<string, number>(),
    monthlyDueCount: new Map<string, number>(),
    creditors: [] as ChartItem[],
    futureRows: [] as Row[],
    unavailable: true
  };
  if (!database) return empty;
  try {
    if (!tableExists(database, "bulk_outcome_installments")) return empty;
    const installmentAmount = "COALESCE(originalAmount, correctedBalanceAmount, balanceAmount, 0)";
    const openAmount = "COALESCE(correctedBalanceAmount, balanceAmount, 0)";
    const dueRow = database.prepare(`
      SELECT COUNT(*) AS count, SUM(${installmentAmount}) AS total
      FROM bulk_outcome_installments
      WHERE dueDate BETWEEN ? AND ? AND ${installmentAmount} > 0
    `).get(start, end) as Row;
    const monthlyDue = rowsToMonthlyMap(database.prepare(`
      SELECT substr(dueDate, 1, 7) AS month, SUM(${installmentAmount}) AS value
      FROM bulk_outcome_installments
      WHERE dueDate BETWEEN ? AND ? AND ${installmentAmount} > 0
      GROUP BY substr(dueDate, 1, 7)
    `).all(start, end) as Row[]);
    const monthlyDueCount = rowsToMonthlyCount(database.prepare(`
      SELECT substr(dueDate, 1, 7) AS month, COUNT(*) AS count
      FROM bulk_outcome_installments
      WHERE dueDate BETWEEN ? AND ? AND ${installmentAmount} > 0
      GROUP BY substr(dueDate, 1, 7)
    `).all(start, end) as Row[]);
    const monthlyOpen = rowsToMonthlyMap(database.prepare(`
      SELECT substr(dueDate, 1, 7) AS month, SUM(${openAmount}) AS value
      FROM bulk_outcome_installments
      WHERE dueDate BETWEEN ? AND ? AND ${openAmount} > 0
      GROUP BY substr(dueDate, 1, 7)
    `).all(start, end) as Row[]);
    const openRow = database.prepare(`
      SELECT COUNT(*) AS count, SUM(${openAmount}) AS total
      FROM bulk_outcome_installments
      WHERE dueDate BETWEEN ? AND ? AND ${openAmount} > 0
    `).get(start, end) as Row;
    const overdueRow = database.prepare(`
      SELECT COUNT(*) AS count, SUM(${openAmount}) AS total
      FROM bulk_outcome_installments
      WHERE dueDate BETWEEN ? AND ? AND dueDate < ? AND ${openAmount} > 0
    `).get(start, end, baseDate) as Row;
    const creditors = chartRows(database.prepare(`
      SELECT COALESCE(creditorName, 'Fornecedor não informado') AS label, SUM(${installmentAmount}) AS value, COUNT(*) AS count
      FROM bulk_outcome_installments
      WHERE dueDate BETWEEN ? AND ? AND ${installmentAmount} > 0
      GROUP BY COALESCE(creditorName, 'Fornecedor não informado')
      ORDER BY value DESC
      LIMIT 10
    `).all(start, end) as Row[]);
    const futureRows = database.prepare(`
      SELECT dueDate, ${openAmount} AS value
      FROM bulk_outcome_installments
      WHERE dueDate >= ? AND ${openAmount} > 0
    `).all(baseDate) as Row[];
    const hasPayments = tableExists(database, "bulk_outcome_payments");
    const paidRow = hasPayments
      ? database.prepare(`
        SELECT COUNT(*) AS count, SUM(COALESCE(netAmount, correctedNetAmount, grossAmount, 0)) AS total
        FROM bulk_outcome_payments
        WHERE paymentDate BETWEEN ? AND ? AND COALESCE(netAmount, correctedNetAmount, grossAmount, 0) > 0
      `).get(start, end) as Row
      : { count: 0, total: 0 };
    const monthlyPaid = hasPayments
      ? rowsToMonthlyMap(database.prepare(`
        SELECT substr(paymentDate, 1, 7) AS month, SUM(COALESCE(netAmount, correctedNetAmount, grossAmount, 0)) AS value
        FROM bulk_outcome_payments
        WHERE paymentDate BETWEEN ? AND ? AND COALESCE(netAmount, correctedNetAmount, grossAmount, 0) > 0
        GROUP BY substr(paymentDate, 1, 7)
      `).all(start, end) as Row[])
      : new Map<string, number>();

    return {
      due: money(dueRow.total),
      dueCount: Number(dueRow.count || 0),
      paid: money(paidRow.total),
      paidCount: Number(paidRow.count || 0),
      open: money(openRow.total),
      openCount: Number(openRow.count || 0),
      overdue: money(overdueRow.total),
      overdueCount: Number(overdueRow.count || 0),
      monthlyDue,
      monthlyPaid,
      monthlyOpen,
      monthlyDueCount,
      creditors,
      futureRows,
      unavailable: false
    };
  } finally {
    database.close();
  }
}

function buildMonthly(year: number, receivables: ReturnType<typeof loadReceivables>, payables: ReturnType<typeof loadPayables>) {
  return Array.from({ length: 12 }, (_, index): FinancialDreMonthlyItem => {
    const key = `${year}-${String(index + 1).padStart(2, "0")}`;
    const receivableDue = receivables.monthlyDue.get(key) || 0;
    const receivableReceived = receivables.monthlyReceived.get(key) || 0;
    const payableDue = payables.monthlyDue.get(key) || 0;
    const payablePaid = payables.monthlyPaid.get(key) || 0;
    return {
      key,
      label: monthLabel(key),
      receivableDue,
      receivableReceived,
      payableDue,
      payablePaid,
      projectedResult: receivableDue - payableDue,
      realizedResult: receivableReceived - payablePaid,
      openReceivables: receivables.monthlyOpen.get(key) || 0,
      openPayables: payables.monthlyOpen.get(key) || 0
    };
  });
}

export async function loadFinancialDre(year = Number(todayIso().slice(0, 4))) {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const baseDate = todayIso();
  const receivables = loadReceivables(start, end, baseDate);
  const payables = loadPayables(start, end, baseDate);
  const monthly = buildMonthly(year, receivables, payables);
  const futureGroups = emptyFutureGroups();
  addFutureOpen(futureGroups, "receivable", baseDate, receivables.futureRows);
  addFutureOpen(futureGroups, "payable", baseDate, payables.futureRows);

  const projectedResult = receivables.due - payables.due;
  const realizedResult = receivables.received - payables.paid;
  const openResult = receivables.open - payables.open;
  const futureReceivableOpen = futureGroups.reduce((sum, item) => sum + item.receivableOpen, 0);
  const futurePayableOpen = futureGroups.reduce((sum, item) => sum + item.payableOpen, 0);

  return {
    year,
    range: { start, end },
    baseDate,
    unavailable: [
      receivables.unavailable ? "contas a receber" : undefined,
      payables.unavailable ? "contas a pagar" : undefined
    ].filter(Boolean) as string[],
    receivableDue: receivables.due,
    receivableDueCount: receivables.dueCount,
    receivableReceived: receivables.received,
    receivableReceivedCount: receivables.receivedCount,
    payableDue: payables.due,
    payableDueCount: payables.dueCount,
    payablePaid: payables.paid,
    payablePaidCount: payables.paidCount,
    projectedResult,
    realizedResult,
    openReceivables: receivables.open,
    openReceivablesCount: receivables.openCount,
    openPayables: payables.open,
    openPayablesCount: payables.openCount,
    openResult,
    overdueReceivables: receivables.overdue,
    overdueReceivablesCount: receivables.overdueCount,
    overduePayables: payables.overdue,
    overduePayablesCount: payables.overdueCount,
    futureReceivableOpen,
    futurePayableOpen,
    futureNetResult: futureReceivableOpen - futurePayableOpen,
    futureGroups,
    monthly,
    projectedFlow: monthly.map((item) => ({ label: item.label, income: Math.max(0, item.receivableDue), outcome: Math.max(0, item.payableDue) })),
    realizedFlow: monthly.map((item) => ({ label: item.label, income: Math.max(0, item.receivableReceived), outcome: Math.max(0, item.payablePaid) })),
    clients: receivables.clients,
    creditors: payables.creditors,
    integrations: [
      sourceStatus(dbFiles.receivables, "bulk_income_installments", "Parcelas a receber"),
      sourceStatus(dbFiles.receivables, "bulk_income_receipts", "Recebimentos"),
      sourceStatus(dbFiles.payables, "bulk_outcome_installments", "Parcelas a pagar"),
      sourceStatus(dbFiles.payables, "bulk_outcome_payments", "Pagamentos")
    ]
  };
}

function yearlyAmountMap(databasePath: string, table: string, dateColumn: string, amountExpression: string) {
  const map = new Map<number, number>();
  const database = openDatabase(databasePath);
  if (!database) return map;
  try {
    if (!tableExists(database, table)) return map;
    const rows = database.prepare(`
      SELECT substr(${dateColumn}, 1, 4) AS year, SUM(${amountExpression}) AS value
      FROM ${table}
      WHERE ${amountExpression} > 0
      GROUP BY substr(${dateColumn}, 1, 4)
    `).all() as Row[];
    rows.forEach((row) => {
      const year = Number(row.year);
      if (Number.isInteger(year) && year >= 2000 && year <= 2100) map.set(year, money(row.value));
    });
    return map;
  } finally {
    database.close();
  }
}

export function loadFinancialDreYearlySeries(): FinancialDreYearlyItem[] {
  const installmentAmount = "COALESCE(originalAmount, correctedBalanceAmount, balanceAmount, 0)";
  const receivableDueByYear = yearlyAmountMap(dbFiles.receivables, "bulk_income_installments", "dueDate", installmentAmount);
  const receivableReceivedByYear = yearlyAmountMap(dbFiles.receivables, "bulk_income_receipts", "paymentDate", "COALESCE(netAmount, grossAmount, 0)");
  const payableDueByYear = yearlyAmountMap(dbFiles.payables, "bulk_outcome_installments", "dueDate", installmentAmount);
  const payablePaidByYear = yearlyAmountMap(dbFiles.payables, "bulk_outcome_payments", "paymentDate", "COALESCE(netAmount, correctedNetAmount, grossAmount, 0)");

  const years = new Set<number>([
    ...Array.from(receivableDueByYear.keys()),
    ...Array.from(receivableReceivedByYear.keys()),
    ...Array.from(payableDueByYear.keys()),
    ...Array.from(payablePaidByYear.keys())
  ]);

  return Array.from(years).sort((left, right) => left - right).map((year) => {
    const receivableDue = receivableDueByYear.get(year) || 0;
    const payableDue = payableDueByYear.get(year) || 0;
    const receivableReceived = receivableReceivedByYear.get(year) || 0;
    const payablePaid = payablePaidByYear.get(year) || 0;
    return {
      year,
      receivableDue,
      payableDue,
      projectedResult: receivableDue - payableDue,
      receivableReceived,
      payablePaid,
      realizedResult: receivableReceived - payablePaid
    };
  });
}

export function loadFinancialDreReportSummary() {
  const availableYears = loadFinancialDreYearOptions();
  const currentYear = normalizeFinancialDreYear(undefined, availableYears);
  const receivableCount = addYearsFromTable(dbFiles.receivables, "bulk_income_installments", ["dueDate"], new Set<number>());
  const payableCount = addYearsFromTable(dbFiles.payables, "bulk_outcome_installments", ["dueDate"], new Set<number>());
  return {
    year: currentYear,
    availableYears,
    baseCount: receivableCount + payableCount
  };
}
