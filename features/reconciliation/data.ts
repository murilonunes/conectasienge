import "server-only";
import { existsSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { conciliacaoApi } from "@/lib/api/financeiro";
import { SiengeApiError, type SiengeErrorDetails, type SiengeRequestProgress } from "@/lib/api/sienge";
import type { SiengeIntegrationRange } from "@/lib/settings";
import type { BankMovement, ReconciliationAccountOption, ReconciliationMonthlySummary, ReconciliationSummary } from "./types";
import { isLinked, isReconciled, movementAmount, movementVolume } from "./utils";

type BankMovementResponse = {
  data?: BankMovement[];
};

type SqlRow = {
  raw_json: string;
  source_day?: string;
  saved_at?: string;
};

export type ReconciliationResult = {
  movements: BankMovement[];
  totalCount: number;
  error?: SiengeErrorDetails;
};

const START_DATE = "2000-01-01";
const dataDir = path.join(process.cwd(), ".sienge-data");
const reconciliationDatabasePath = path.join(dataDir, "finance-reconciliation.sqlite");

function wideEndDate() {
  const today = new Date();
  return new Date(today.getFullYear() + 2, 11, 31, 12).toISOString().slice(0, 10);
}

function reconciliationRange(range?: SiengeIntegrationRange) {
  return range || { startDate: START_DATE, endDate: wideEndDate() };
}

function localDataError(title: string, explanation: string): SiengeErrorDetails {
  return {
    method: "GET",
    endpoint: "/bulk-data/v1/bank-movement",
    title,
    explanation,
    suggestion: "Atualize Conciliação em Configurações para preencher os dados.",
    occurredAt: new Date().toISOString()
  };
}

function openDatabase() {
  const database = new DatabaseSync(reconciliationDatabasePath);
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

function annotate(row: SqlRow): BankMovement | undefined {
  try {
    return {
      ...(JSON.parse(row.raw_json) as BankMovement),
      __siengeIntegrationDay: row.source_day,
      __siengeIntegratedAt: row.saved_at
    };
  } catch {
    return undefined;
  }
}

function sortedMovements(movements: BankMovement[]) {
  return movements.sort((left, right) =>
    String(right.bankMovementDate || "").localeCompare(String(left.bankMovementDate || ""))
    || Number(right.bankMovementId || 0) - Number(left.bankMovementId || 0)
  );
}

function readLocalMovements(onProgress?: (progress: SiengeRequestProgress) => void): ReconciliationResult {
  onProgress?.({
    stage: "local-mirror-read",
    message: "Lendo movimentos de Caixa e Bancos já salvos.",
    detail: "Conciliação"
  });

  if (!existsSync(reconciliationDatabasePath)) {
    return {
      movements: [],
      totalCount: 0,
      error: localDataError("Conciliação sem dados carregados", "Os movimentos de conciliação ainda não foram atualizados.")
    };
  }

  const database = openDatabase();
  try {
    if (!tableExists(database, "sienge_records")) {
      return {
        movements: [],
        totalCount: 0,
        error: localDataError("Movimentos bancários não disponíveis", "Ainda não há movimentos salvos para exibir.")
      };
    }

    ensureIndexes(database);
    const rows = database.prepare(`
      SELECT raw_json, source_day, saved_at
      FROM sienge_records
      WHERE endpoint = '/bulk-data/v1/bank-movement'
      ORDER BY saved_at DESC
    `).all() as SqlRow[];

    onProgress?.({
      stage: "local-mirror-hit",
      message: "Movimentos encontrados nos dados salvos.",
      detail: `${rows.length} registro(s)`,
      current: rows.length,
      total: rows.length
    });

    const movements = sortedMovements(rows.map(annotate).filter((item): item is BankMovement => Boolean(item)));
    return { movements, totalCount: movements.length };
  } finally {
    database.close();
  }
}

export function loadReconciliationAccounts(): ReconciliationAccountOption[] {
  if (!existsSync(reconciliationDatabasePath)) return [];
  const database = openDatabase();
  try {
    if (!tableExists(database, "sienge_records")) return [];
    ensureIndexes(database);
    const rows = database.prepare(`
      SELECT raw_json, source_day, saved_at
      FROM sienge_records
      WHERE endpoint = '/bulk-data/v1/bank-movement'
    `).all() as SqlRow[];
    const accounts = new Map<string, ReconciliationAccountOption>();
    rows.forEach((row) => {
      const movement = annotate(row);
      const accountNumber = movement?.accountNumber?.trim();
      if (!accountNumber) return;
      const current = accounts.get(accountNumber) || {
        accountNumber,
        label: [accountNumber, movement?.companyName].filter(Boolean).join(" - "),
        count: 0
      };
      current.count += 1;
      accounts.set(accountNumber, current);
    });
    return Array.from(accounts.values()).sort((left, right) => right.count - left.count || left.accountNumber.localeCompare(right.accountNumber));
  } finally {
    database.close();
  }
}

async function refreshFromSienge(
  onProgress: ((progress: SiengeRequestProgress) => void) | undefined,
  forceReplaceFinalized: boolean,
  range?: SiengeIntegrationRange
): Promise<ReconciliationResult> {
  const dates = reconciliationRange(range);
  onProgress?.({
    stage: "prepare-query",
    message: "Preparando atualização de movimentos bancários no Sienge.",
    detail: `${dates.startDate} ate ${dates.endDate}`
  });
  const response = await conciliacaoApi.bankMovements<BankMovementResponse>({
    startDate: dates.startDate,
    endDate: dates.endDate,
    selectionType: "M",
    onlyDetachedMovement: "N"
  }, true, onProgress, forceReplaceFinalized);
  const movements = sortedMovements(response.data || []);
  return { movements, totalCount: movements.length };
}

export async function loadReconciliationMovements(
  onProgress?: (progress: SiengeRequestProgress) => void,
  forceRefresh = false,
  forceReplaceFinalized = false,
  range?: SiengeIntegrationRange
): Promise<ReconciliationResult> {
  try {
    const result = forceRefresh
      ? await refreshFromSienge(onProgress, forceReplaceFinalized, range)
      : readLocalMovements(onProgress);
    onProgress?.({
      stage: "analyze",
      message: "Organizando movimentos para exibição.",
      detail: `${result.movements.length} movimento(s)`
    });
    return result;
  } catch (error) {
    return {
      ...readLocalMovements(onProgress),
      error: error instanceof SiengeApiError ? {
        ...error.details,
        explanation: error.details.status === 403
          ? "A credencial não possui acesso aos movimentos de Caixa e Bancos."
          : error.details.explanation,
        suggestion: error.details.status === 403
          ? "Libere os movimentos de Caixa e Bancos no Painel de Integrações do Sienge."
          : error.details.suggestion
      } : {
        method: "GET",
        endpoint: "/bulk-data/v1/bank-movement",
        title: "Não foi possível atualizar a conciliação",
        explanation: error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
        suggestion: "Confira o acesso aos movimentos bancários e tente atualizar novamente em Configurações.",
        occurredAt: new Date().toISOString()
      }
    };
  }
}

function movementMonthKey(movement: BankMovement) {
  const date = movement.bankMovementDate || movement.billDate;
  if (!date) return "sem-data";
  return date.slice(0, 7);
}

function movementMonthLabel(key: string) {
  if (key === "sem-data") return "Sem data";
  const date = new Date(`${key}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return key;
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date);
}

function monthSortValue(key: string) {
  if (key === "sem-data") return 0;
  const [year, month] = key.split("-").map(Number);
  return (year || 0) * 12 + (month || 0);
}

function emptyMonth(key: string): ReconciliationMonthlySummary {
  return {
    key,
    label: movementMonthLabel(key),
    totalAmount: 0,
    totalCount: 0,
    reconciledAmount: 0,
    reconciledCount: 0,
    unreconciledAmount: 0,
    unreconciledCount: 0,
    linkedCount: 0,
    detachedCount: 0
  };
}

export function analyzeReconciliation(movements: BankMovement[]): ReconciliationSummary {
  const byAccount = new Map<string, { label: string; value: number; count: number }>();
  const byMonth = new Map<string, ReconciliationMonthlySummary>();

  movements.forEach((movement) => {
    const label = movement.accountNumber || "Conta não informada";
    const current = byAccount.get(label) || { label, value: 0, count: 0 };
    current.value += movementAmount(movement);
    current.count += 1;
    byAccount.set(label, current);

    const key = movementMonthKey(movement);
    const month = byMonth.get(key) || emptyMonth(key);
    const amount = movementVolume(movement);
    month.totalAmount += amount;
    month.totalCount += 1;

    if (isReconciled(movement)) {
      month.reconciledAmount += amount;
      month.reconciledCount += 1;
    } else {
      month.unreconciledAmount += amount;
      month.unreconciledCount += 1;
    }

    if (isLinked(movement)) month.linkedCount += 1;
    else month.detachedCount += 1;
    byMonth.set(key, month);
  });

  const reconciled = movements.filter(isReconciled);
  const unreconciled = movements.filter((movement) => !isReconciled(movement));
  return {
    totalAmount: movements.reduce((sum, movement) => sum + movementVolume(movement), 0),
    reconciledAmount: reconciled.reduce((sum, movement) => sum + movementVolume(movement), 0),
    unreconciledAmount: unreconciled.reduce((sum, movement) => sum + movementVolume(movement), 0),
    reconciledCount: reconciled.length,
    unreconciledCount: unreconciled.length,
    detachedCount: movements.filter((movement) => !isLinked(movement)).length,
    linkedCount: movements.filter(isLinked).length,
    byAccount: Array.from(byAccount.values()).sort((left, right) => Math.abs(right.value) - Math.abs(left.value)).slice(0, 8),
    monthly: Array.from(byMonth.values()).sort((left, right) => monthSortValue(right.key) - monthSortValue(left.key))
  };
}
