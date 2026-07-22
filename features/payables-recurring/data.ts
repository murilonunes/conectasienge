import "server-only";
import { existsSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import type { SiengeErrorDetails } from "@/lib/api/sienge";

export type RecurringCreditor = {
  creditorId: number;
  creditorName: string;
  monthsWithBill: string[];
  amountByMonth: Record<string, number>;
  totalAmount: number;
  billCount: number;
  lastDueDate: string;
  category?: string;
};

export type RecurringPayablesResult = {
  creditors: RecurringCreditor[];
  monthKeys: string[];
  generatedAt: string;
  error?: SiengeErrorDetails;
};

const dataDir = path.join(process.cwd(), ".sienge-data");
const payablesDatabasePath = path.join(dataDir, "finance-payables.sqlite");

// Meses do calendário, do mais antigo para o mais recente, incluindo o atual
// (mesmo que parcial). "no ano" usa monthsBack correspondente a janeiro até hoje.
function monthKeysBack(monthsBack: number, today: Date): string[] {
  const keys: string[] = [];
  for (let offset = monthsBack - 1; offset >= 0; offset -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    keys.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

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

function tableExists(database: DatabaseSync, table: string) {
  return Boolean(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

// Carrega os últimos 12 meses de uma vez (cobre as janelas de 3/6/9/12 meses e
// "no ano"); o filtro por janela específica é feito no cliente, sem nova consulta.
//
// A recorrência é medida por título (bulk_outcome_installments), não por baixa:
// um título conta para o mês do seu vencimento mesmo que ainda não tenha sido
// pago. O mesmo campo (dueDate) também decide se já existe título futuro
// cadastrado, então a consulta é uma só: tudo com vencimento a partir do início
// da janela de 12 meses.
export async function loadRecurringPayables(): Promise<RecurringPayablesResult> {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const monthKeys = monthKeysBack(12, today);
  const todayIso = today.toISOString().slice(0, 10);
  const lookbackStart = `${monthKeys[0]}-01`;

  if (!existsSync(payablesDatabasePath)) {
    return {
      creditors: [],
      monthKeys,
      generatedAt: today.toISOString(),
      error: localDataError("Contas a pagar sem dados carregados", "Os dados de contas a pagar ainda não foram atualizados.")
    };
  }

  const database = new DatabaseSync(payablesDatabasePath);
  database.exec("PRAGMA busy_timeout = 8000;");
  try {
    if (!tableExists(database, "bulk_outcome_installments")) {
      return {
        creditors: [],
        monthKeys,
        generatedAt: today.toISOString(),
        error: localDataError("Contas a pagar ainda não disponíveis", "Os dados salvos ainda não possuem títulos para exibição.")
      };
    }

    type InstallmentRow = {
      dueDate: string;
      amount: number;
      creditorId: number | null;
      creditorName: string | null;
      billId: number;
      installmentId: number;
    };

    // Não filtra por baixa: um título conta para a recorrência esteja pago ou
    // em aberto. O valor usado é o valor original do título (a baixa zera o
    // saldo de um título já pago, o que subestimaria o total histórico).
    const rows = database.prepare(`
      SELECT dueDate, COALESCE(originalAmount, 0) AS amount, creditorId, creditorName, billId, installmentId
      FROM bulk_outcome_installments
      WHERE dueDate >= ? AND creditorId IS NOT NULL AND COALESCE(originalAmount, 0) > 0
    `).all(lookbackStart) as InstallmentRow[];

    const categoryRows = tableExists(database, "bulk_outcome_payments_categories")
      ? database.prepare(`
        SELECT billId, installmentId, financialCategoryName
        FROM bulk_outcome_payments_categories
        WHERE financialCategoryName IS NOT NULL
      `).all() as Array<{ billId: number; installmentId: number; financialCategoryName: string }>
      : [];
    const categoryByBill = new Map<string, string>();
    categoryRows.forEach((row) => {
      categoryByBill.set(`${row.billId}:${row.installmentId}`, row.financialCategoryName);
    });

    type Group = {
      creditorId: number;
      creditorName: string;
      months: Set<string>;
      amountByMonth: Map<string, number>;
      totalAmount: number;
      billCount: number;
      lastDueDate: string;
      hasFutureBill: boolean;
      categoryCounts: Map<string, number>;
    };
    const groups = new Map<number, Group>();
    rows.forEach((row) => {
      if (!row.creditorId) return;
      let group = groups.get(row.creditorId);
      if (!group) {
        group = {
          creditorId: row.creditorId,
          creditorName: row.creditorName || `Fornecedor #${row.creditorId}`,
          months: new Set(),
          amountByMonth: new Map(),
          totalAmount: 0,
          billCount: 0,
          lastDueDate: row.dueDate,
          hasFutureBill: false,
          categoryCounts: new Map()
        };
        groups.set(row.creditorId, group);
      }
      if (row.dueDate > todayIso) {
        group.hasFutureBill = true;
      } else {
        const monthKey = row.dueDate.slice(0, 7);
        if (monthKeys.includes(monthKey)) {
          group.months.add(monthKey);
          group.amountByMonth.set(monthKey, (group.amountByMonth.get(monthKey) || 0) + row.amount);
        }
        group.totalAmount += row.amount;
        group.billCount += 1;
        const category = categoryByBill.get(`${row.billId}:${row.installmentId}`);
        if (category) group.categoryCounts.set(category, (group.categoryCounts.get(category) || 0) + 1);
      }
      if (row.dueDate > group.lastDueDate) group.lastDueDate = row.dueDate;
    });

    const creditors: RecurringCreditor[] = Array.from(groups.values())
      .filter((group) => !group.hasFutureBill && group.months.size > 0)
      .map((group) => {
        const topCategory = Array.from(group.categoryCounts.entries()).sort((left, right) => right[1] - left[1])[0];
        return {
          creditorId: group.creditorId,
          creditorName: group.creditorName,
          monthsWithBill: Array.from(group.months).sort(),
          amountByMonth: Object.fromEntries(group.amountByMonth),
          totalAmount: group.totalAmount,
          billCount: group.billCount,
          lastDueDate: group.lastDueDate,
          category: topCategory?.[0]
        };
      })
      .sort((left, right) => right.monthsWithBill.length - left.monthsWithBill.length || right.totalAmount - left.totalAmount);

    return { creditors, monthKeys, generatedAt: today.toISOString() };
  } finally {
    database.close();
  }
}
