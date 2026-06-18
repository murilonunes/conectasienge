import "server-only";
import { existsSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { contasPagarApi } from "@/lib/api/financeiro";
import { SiengeApiError, type SiengeErrorDetails } from "@/lib/api/sienge";
import { getAppSettings, type SiengeIntegrationRange } from "@/lib/settings";
import type { PayablesScheduleResult, ScheduleBucket, ScheduledPayable } from "./types";

type SqlRow = {
  raw_json: string;
  source_day?: string;
  saved_at?: string;
};

const dataDir = path.join(process.cwd(), ".sienge-data");
const payablesDatabasePath = path.join(dataDir, "finance-payables.sqlite");

const iso = (date: Date) => date.toISOString().slice(0, 10);
const atDay = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`);
const amount = (item: ScheduledPayable) => item.correctedBalanceAmount ?? item.balanceAmount ?? item.originalAmount ?? 0;

function localDataError(title: string, explanation: string): SiengeErrorDetails {
  return {
    method: "GET",
    endpoint: "/bulk-data/v1/outcome",
    title,
    explanation,
    suggestion: "Atualize Contas a pagar em Configurações para preencher os dados.",
    occurredAt: new Date().toISOString()
  };
}

function openDatabase() {
  const database = new DatabaseSync(payablesDatabasePath);
  database.exec("PRAGMA busy_timeout = 8000;");
  return database;
}

function tableExists(database: DatabaseSync, table: string) {
  return Boolean(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function ensureIndexes(database: DatabaseSync) {
  try {
    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_bulk_outcome_installments_dueDate ON bulk_outcome_installments(dueDate);
    `);
  } catch {
    // The screen can still read without the index; it will only be slower on very large bases.
  }
}

function annotate(row: SqlRow): ScheduledPayable | undefined {
  try {
    return {
      ...(JSON.parse(row.raw_json) as ScheduledPayable),
      __siengeIntegrationDay: row.source_day,
      __siengeIntegratedAt: row.saved_at
    };
  } catch {
    return undefined;
  }
}

function emptyResult(futureMonths: number, error: SiengeErrorDetails): PayablesScheduleResult {
  return {
    items: [],
    buckets: buildBuckets([], futureMonths),
    totalAmount: 0,
    totalCount: 0,
    authorizedCount: 0,
    futureMonths,
    error
  };
}

function buildBuckets(sourceItems: ScheduledPayable[], futureMonths: number): ScheduleBucket[] {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + (today.getDay() === 0 ? 0 : 7 - today.getDay()));
  const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 12);

  const futureDefinitions = Array.from({ length: futureMonths }, (_, index) => {
    const monthOffset = index + 1;
    const monthDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1, 12);
    return {
      id: `future-${monthOffset}`,
      label: monthOffset === 1 ? "Próximo mês" : `Daqui a ${monthOffset} meses`,
      note: new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(monthDate),
      start: new Date(today.getFullYear(), today.getMonth() + monthOffset, 0, 12),
      end: new Date(today.getFullYear(), today.getMonth() + monthOffset + 1, 0, 12)
    };
  });

  const definitions: Array<Omit<ScheduleBucket, "items" | "amount"> & { start?: Date; end?: Date }> = [
    { id: "today", label: "Hoje", note: "Vencimentos do dia" },
    { id: "week", label: "Restante da semana", note: "Até domingo" },
    { id: "month", label: "Restante do mês", note: new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(today) },
    ...futureDefinitions
  ];

  return definitions.map((definition) => {
    const bucketItems = sourceItems.filter((item) => {
      const date = atDay(item.dueDate);
      if (definition.id === "today") return iso(date) === iso(today);
      if (definition.id === "week") return date > today && date <= weekEnd;
      if (definition.id === "month") return date > weekEnd && date <= currentMonthEnd;
      return !!definition.start && !!definition.end && date > definition.start && date <= definition.end;
    });
    return { ...definition, items: bucketItems, amount: bucketItems.reduce((sum, item) => sum + amount(item), 0) };
  });
}

function summarize(items: ScheduledPayable[], futureMonths: number): PayablesScheduleResult {
  const sorted = items
    .filter((item) => item.dueDate && amount(item) > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.billId - b.billId || a.installmentId - b.installmentId);

  return {
    items: sorted,
    buckets: buildBuckets(sorted, futureMonths),
    totalAmount: sorted.reduce((sum, item) => sum + amount(item), 0),
    totalCount: sorted.length,
    authorizedCount: sorted.filter((item) => item.authorizationStatus === "S").length,
    futureMonths
  };
}

function readLocalSchedule(futureMonths: number): PayablesScheduleResult {
  if (!existsSync(payablesDatabasePath)) {
    return emptyResult(
      futureMonths,
      localDataError("Contas a pagar sem dados carregados", "Os dados de contas a pagar ainda não foram atualizados.")
    );
  }

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const end = new Date(today.getFullYear(), today.getMonth() + futureMonths + 1, 0, 12);
  const database = openDatabase();

  try {
    if (!tableExists(database, "bulk_outcome_installments")) {
      return emptyResult(
        futureMonths,
        localDataError("Parcelas a pagar ainda não disponíveis", "Os dados salvos ainda não possuem parcelas para exibição.")
      );
    }

    ensureIndexes(database);
    const amountExpression = "COALESCE(correctedBalanceAmount, balanceAmount, originalAmount, 0)";
    const rows = database.prepare(`
      SELECT raw_json, source_day, saved_at
      FROM bulk_outcome_installments
      WHERE dueDate BETWEEN ? AND ?
        AND ${amountExpression} > 0
      ORDER BY dueDate ASC, billId ASC, installmentId ASC
    `).all(iso(today), iso(end)) as SqlRow[];

    return summarize(rows.map(annotate).filter((item): item is ScheduledPayable => Boolean(item)), futureMonths);
  } finally {
    database.close();
  }
}

async function refreshFromSienge(forceReplaceFinalized: boolean, range: SiengeIntegrationRange, futureMonths: number): Promise<PayablesScheduleResult> {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const response = await contasPagarApi.advancedSearch<{ data?: ScheduledPayable[] }>({
    startDate: range.startDate,
    endDate: range.endDate,
    selectionType: "D",
    correctionIndexerId: 1,
    correctionDate: iso(today),
    withBankMovements: false,
    withAuthorizations: true
  }, true, forceReplaceFinalized);

  return summarize(response.data || [], futureMonths);
}

export async function loadPayablesSchedule(forceRefresh = false, forceReplaceFinalized = false, range?: SiengeIntegrationRange): Promise<PayablesScheduleResult> {
  const settings = getAppSettings();
  const futureMonths = settings.payablesFutureMonths;
  const integrationRange = range || { startDate: settings.siengeStartDate, endDate: settings.siengeEndDate };

  if (!forceRefresh) return readLocalSchedule(futureMonths);

  try {
    return await refreshFromSienge(forceReplaceFinalized, integrationRange, futureMonths);
  } catch (error) {
    return {
      ...readLocalSchedule(futureMonths),
      error: error instanceof SiengeApiError ? {
        ...error.details,
        explanation: error.details.status === 403 ? "A credencial não possui acesso às parcelas de Contas a pagar." : error.details.explanation,
        suggestion: error.details.status === 403 ? "Libere Contas a pagar no Painel de Integrações do Sienge." : error.details.suggestion
      } : {
        method: "GET",
        endpoint: "/bulk-data/v1/outcome",
        title: "Não foi possível atualizar a agenda de pagamentos",
        explanation: error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
        suggestion: "Confira o acesso a Contas a pagar e tente atualizar novamente em Configurações.",
        occurredAt: new Date().toISOString()
      }
    };
  }
}
