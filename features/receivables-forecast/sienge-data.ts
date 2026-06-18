import "server-only";
import { existsSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { contasReceberApi } from "@/lib/api/financeiro";
import { SiengeApiError, type SiengeErrorDetails } from "@/lib/api/sienge";
import type { ChartItem } from "@/features/financeiro/sienge-data";
import type { SiengeIntegrationRange } from "@/lib/settings";

export type ReceivableReceipt = {
  grossAmount?: number;
  netAmount?: number;
  paymentDate?: string;
  operationTypeName?: string;
};

export type ReceivableInstallment = {
  companyId?: number;
  companyName?: string;
  projectId?: number;
  projectName?: string;
  businessAreaName?: string;
  clientId?: number;
  clientName?: string;
  billId?: number;
  receivableBillId?: number;
  installmentId?: number;
  documentIdentificationId?: string;
  documentIdentificationName?: string;
  documentNumber?: string;
  documentForecast?: string;
  originId?: string;
  originalAmount?: number;
  balanceAmount?: number;
  correctedBalanceAmount?: number;
  dueDate?: string;
  issueDate?: string;
  billDate?: string;
  defaulterSituation?: string;
  mainUnit?: string;
  installmentNumber?: string;
  bearerId?: number;
  receipts?: ReceivableReceipt[];
  __siengeIntegrationDay?: string;
  __siengeIntegratedAt?: string;
};

type IncomeResponse = {
  data?: ReceivableInstallment[];
};

type SqlRow = {
  raw_json: string;
  source_day?: string;
  saved_at?: string;
};

export type ReceivablesForecastResult = {
  entries: ReceivableInstallment[];
  forecastEntries: ReceivableInstallment[];
  totalCount: number;
  loadedFrom: string;
  range: {
    startDate: string;
    endDate: string;
    correctionDate: string;
  };
  error?: SiengeErrorDetails;
};

export type ReceivablesForecastAnalytics = {
  totalOpen: number;
  overdueAmount: number;
  currentMonthAmount: number;
  next30DaysAmount: number;
  forecastCount: number;
  overdueCount: number;
  monthly: ChartItem[];
  clients: ChartItem[];
  origins: ChartItem[];
};

const ORIGIN_LABELS: Record<string, string> = {
  CR: "Contas a receber",
  CO: "Comercial",
  ME: "Medições",
  CA: "Contrapartida",
  CI: "Controle de investidores",
  AR: "Administração de obras",
  SC: "Condomínios",
  LO: "Locações",
  NE: "Nota fiscal eletrônica",
  NS: "Nota fiscal de serviço",
  AC: "Administração de compras",
  NF: "Solicitação de nota fiscal"
};

const dataDir = path.join(process.cwd(), ".sienge-data");
const receivablesDatabasePath = path.join(dataDir, "finance-receivables.sqlite");

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function forecastRange(range?: SiengeIntegrationRange) {
  const today = new Date();
  if (range) {
    return {
      startDate: range.startDate,
      endDate: range.endDate,
      correctionDate: iso(today)
    };
  }
  const end = new Date(today.getFullYear() + 5, 11, 31);
  return {
    startDate: "2000-01-01",
    endDate: iso(end),
    correctionDate: iso(today)
  };
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function localDataError(title: string, explanation: string): SiengeErrorDetails {
  return {
    method: "GET",
    endpoint: "/bulk-data/v1/income",
    title,
    explanation,
    suggestion: "Atualize Contas a receber em Configurações para preencher os dados.",
    occurredAt: new Date().toISOString()
  };
}

function openDatabase() {
  const database = new DatabaseSync(receivablesDatabasePath);
  database.exec("PRAGMA busy_timeout = 8000;");
  return database;
}

function tableExists(database: DatabaseSync, table: string) {
  return Boolean(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function ensureIndexes(database: DatabaseSync) {
  try {
    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_bulk_income_installments_dueDate ON bulk_income_installments(dueDate);
      CREATE INDEX IF NOT EXISTS idx_bulk_income_installments_clientId ON bulk_income_installments(clientId);
      CREATE INDEX IF NOT EXISTS idx_bulk_income_installments_projectId ON bulk_income_installments(projectId);
    `);
  } catch {
    // Reading still works without new indexes; it can only be slower on large local bases.
  }
}

function annotate(row: SqlRow): ReceivableInstallment | undefined {
  try {
    return {
      ...(JSON.parse(row.raw_json) as ReceivableInstallment),
      __siengeIntegrationDay: row.source_day,
      __siengeIntegratedAt: row.saved_at
    };
  } catch {
    return undefined;
  }
}

function emptyResult(range: ReturnType<typeof forecastRange>, error: SiengeErrorDetails): ReceivablesForecastResult {
  return {
    entries: [],
    forecastEntries: [],
    totalCount: 0,
    loadedFrom: "/bulk-data/v1/income",
    range,
    error
  };
}

export function receivableOpenAmount(entry: ReceivableInstallment) {
  const corrected = numberValue(entry.correctedBalanceAmount);
  if (corrected !== undefined) return corrected;
  const balance = numberValue(entry.balanceAmount);
  if (balance !== undefined) return balance;
  return numberValue(entry.originalAmount) ?? 0;
}

export function receivablePaidAmount(entry: ReceivableInstallment) {
  return (entry.receipts || []).reduce((sum, receipt) => {
    const value = numberValue(receipt.netAmount) ?? numberValue(receipt.grossAmount) ?? 0;
    return sum + value;
  }, 0);
}

export function receivableDocument(entry: ReceivableInstallment) {
  const title = entry.billId || entry.receivableBillId;
  const document = [entry.documentIdentificationId, entry.documentNumber].filter(Boolean).join(" - ");
  return document || (title ? `Título #${title}` : "Título sem número");
}

export function receivableStatus(entry: ReceivableInstallment, today = new Date()) {
  const amount = receivableOpenAmount(entry);
  if (amount <= 0) return "Recebido";
  const dueDate = parseDate(entry.dueDate);
  if (!dueDate) return "Sem vencimento";
  const todayOnly = parseDate(iso(today)) || today;
  if (dueDate < todayOnly) return "Em atraso";
  if (entry.documentForecast === "S") return "Previsto";
  return "A receber";
}

function buildResult(entries: ReceivableInstallment[], range: ReturnType<typeof forecastRange>): ReceivablesForecastResult {
  const forecastEntries = entries
    .filter((entry) => receivableOpenAmount(entry) > 0)
    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "") || (a.billId || 0) - (b.billId || 0));

  return {
    entries,
    forecastEntries,
    totalCount: entries.length,
    loadedFrom: "/bulk-data/v1/income",
    range
  };
}

function readLocalForecast(range: ReturnType<typeof forecastRange>): ReceivablesForecastResult {
  if (!existsSync(receivablesDatabasePath)) {
    return emptyResult(
      range,
      localDataError("Contas a receber sem dados carregados", "Os dados de contas a receber ainda não foram atualizados.")
    );
  }

  const database = openDatabase();
  try {
    if (!tableExists(database, "bulk_income_installments")) {
      return emptyResult(
        range,
        localDataError("Parcelas a receber ainda não disponíveis", "Os dados salvos ainda não possuem parcelas para exibição.")
      );
    }

    ensureIndexes(database);
    const amountExpression = "COALESCE(correctedBalanceAmount, balanceAmount, originalAmount, 0)";
    const rows = database.prepare(`
      SELECT raw_json, source_day, saved_at
      FROM bulk_income_installments
      WHERE dueDate BETWEEN ? AND ?
        AND ${amountExpression} > 0
      ORDER BY dueDate ASC, billId ASC, installmentId ASC
    `).all(range.startDate, range.endDate) as SqlRow[];

    return buildResult(rows.map(annotate).filter((entry): entry is ReceivableInstallment => Boolean(entry)), range);
  } finally {
    database.close();
  }
}

async function refreshFromSienge(forceReplaceFinalized: boolean, range: ReturnType<typeof forecastRange>): Promise<ReceivablesForecastResult> {
  const response = await contasReceberApi.incomeForecast<IncomeResponse>({
    startDate: range.startDate,
    endDate: range.endDate,
    selectionType: "D",
    correctionIndexerId: 1,
    correctionDate: range.correctionDate
  }, true, forceReplaceFinalized);

  return buildResult(response.data || [], range);
}

export async function loadReceivablesForecast(forceRefresh = false, forceReplaceFinalized = false, integrationRange?: SiengeIntegrationRange): Promise<ReceivablesForecastResult> {
  const range = forecastRange(integrationRange);

  if (!forceRefresh) return readLocalForecast(range);

  try {
    return await refreshFromSienge(forceReplaceFinalized, range);
  } catch (error) {
    return {
      ...readLocalForecast(range),
      error: error instanceof SiengeApiError ? error.details : {
        method: "GET",
        endpoint: "/bulk-data/v1/income",
        title: "Não foi possível atualizar a previsão de recebimentos",
        explanation: error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
        suggestion: "Confira o acesso a Contas a receber e tente atualizar novamente em Configurações.",
        occurredAt: new Date().toISOString()
      }
    };
  }
}

function groupEntries(entries: ReceivableInstallment[], key: (entry: ReceivableInstallment) => string): ChartItem[] {
  const groups = new Map<string, ChartItem>();
  entries.forEach((entry) => {
    const label = key(entry);
    const current = groups.get(label) || { label, value: 0, count: 0 };
    current.value += receivableOpenAmount(entry);
    current.count += 1;
    groups.set(label, current);
  });
  return Array.from(groups.values()).sort((a, b) => b.value - a.value);
}

export function analyzeReceivablesForecast(result: ReceivablesForecastResult): ReceivablesForecastAnalytics {
  const today = new Date();
  const todayOnly = parseDate(iso(today)) || today;
  const next30 = new Date(todayOnly);
  next30.setDate(next30.getDate() + 30);
  const currentMonth = todayOnly.getMonth();
  const currentYear = todayOnly.getFullYear();
  const entries = result.forecastEntries;
  const totalOpen = entries.reduce((sum, entry) => sum + receivableOpenAmount(entry), 0);
  const monthlyMap = new Map<string, ChartItem & { order: number }>();

  entries.forEach((entry) => {
    const dueDate = parseDate(entry.dueDate);
    if (!dueDate) return;
    const order = dueDate.getFullYear() * 12 + dueDate.getMonth();
    const label = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(dueDate).replace(".", "");
    const current = monthlyMap.get(label) || { label, value: 0, count: 0, order };
    current.value += receivableOpenAmount(entry);
    current.count += 1;
    monthlyMap.set(label, current);
  });

  return {
    totalOpen,
    overdueAmount: entries
      .filter((entry) => {
        const dueDate = parseDate(entry.dueDate);
        return dueDate ? dueDate < todayOnly : false;
      })
      .reduce((sum, entry) => sum + receivableOpenAmount(entry), 0),
    currentMonthAmount: entries
      .filter((entry) => {
        const dueDate = parseDate(entry.dueDate);
        return dueDate ? dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear : false;
      })
      .reduce((sum, entry) => sum + receivableOpenAmount(entry), 0),
    next30DaysAmount: entries
      .filter((entry) => {
        const dueDate = parseDate(entry.dueDate);
        return dueDate ? dueDate >= todayOnly && dueDate <= next30 : false;
      })
      .reduce((sum, entry) => sum + receivableOpenAmount(entry), 0),
    forecastCount: entries.length,
    overdueCount: entries.filter((entry) => receivableStatus(entry, todayOnly) === "Em atraso").length,
    monthly: Array.from(monthlyMap.values()).sort((a, b) => a.order - b.order).slice(0, 36),
    clients: groupEntries(entries, (entry) => entry.clientName || (entry.clientId ? `Cliente #${entry.clientId}` : "Cliente não informado")).slice(0, 8),
    origins: groupEntries(entries, (entry) => ORIGIN_LABELS[entry.originId || ""] || entry.originId || "Origem não informada").slice(0, 8)
  };
}
