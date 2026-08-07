import "server-only";
import { contasPagarApi } from "@/lib/api/financeiro";
import { SiengeApiError, type SiengeErrorDetails } from "@/lib/api/sienge";
import type { SiengeIntegrationRange } from "@/lib/settings";
import type { FinancialEntry, EntryStatus } from "./types";

type SiengeBill = {
  id: number;
  creditorId: number;
  documentIdentificationId?: string;
  documentNumber?: string;
  issueDate: string;
  totalInvoiceAmount?: number;
  notes?: string;
  originId?: string;
  status?: "S" | "N" | "I";
  __siengeIntegrationDay?: string;
  __siengeIntegratedAt?: string;
};

export type PayablesResult = {
  entries: FinancialEntry[];
  totalCount: number;
  error?: SiengeErrorDetails;
};

export type ChartItem = {
  label: string;
  value: number;
  count: number;
};

export type PayablesAnalytics = {
  totalAmount: number;
  averageAmount: number;
  coverage: number;
  completeCount: number;
  incompleteCount: number;
  monthly: ChartItem[];
  creditors: ChartItem[];
  origins: ChartItem[];
  valueRanges: ChartItem[];
};

const PAYABLES_PAGE_LIMIT = 200;

const statusLabels: Record<NonNullable<SiengeBill["status"]>, EntryStatus> = {
  S: "Completo",
  N: "Incompleto",
  I: "Em inclusão"
};

function dateRange(range?: SiengeIntegrationRange) {
  if (range) return range;
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 1);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  return { startDate: iso(start), endDate: iso(end) };
}

export async function loadPayables(forceRefresh = false, forceReplaceFinalized = false, range?: SiengeIntegrationRange): Promise<PayablesResult> {
  try {
    const filters = dateRange(range);
    const response = await contasPagarApi.list<SiengeBill>({ ...filters, limit: PAYABLES_PAGE_LIMIT, offset: 0 }, forceRefresh, forceReplaceFinalized);
    const totalCount = response.resultSetMetadata?.count ?? response.results.length;
    const bills = [...(response.results || [])];

    // A atualizacao em Configuracoes precisa percorrer todas as paginas para
    // que observacoes de titulos recentes nao fiquem limitadas aos 200
    // registros da primeira resposta. As chamadas sequenciais respeitam
    // melhor o limite REST do Sienge.
    if (forceRefresh) {
      const remainingPages = Math.max(0, Math.ceil(totalCount / PAYABLES_PAGE_LIMIT) - 1);
      for (let page = 1; page <= remainingPages; page += 1) {
        const nextPage = await contasPagarApi.list<SiengeBill>({
          ...filters,
          limit: PAYABLES_PAGE_LIMIT,
          offset: page * PAYABLES_PAGE_LIMIT
        }, true, forceReplaceFinalized);
        bills.push(...(nextPage.results || []));
      }
    }

    return {
      totalCount,
      entries: bills.map((bill) => ({
        id: bill.id,
        document: [bill.documentIdentificationId, bill.documentNumber].filter(Boolean).join("-") || String(bill.id),
        description: bill.notes || `Título de origem ${bill.originId || "não informada"}`,
        party: `Credor #${bill.creditorId}`,
        dueDate: bill.issueDate,
        amount: bill.totalInvoiceAmount || 0,
        status: bill.status ? statusLabels[bill.status] : "Incompleto",
        kind: "payable",
        originId: bill.originId,
        __siengeIntegrationDay: bill.__siengeIntegrationDay,
        __siengeIntegratedAt: bill.__siengeIntegratedAt
      }))
    };
  } catch (error) {
    return {
      entries: [],
      totalCount: 0,
      error: error instanceof SiengeApiError ? error.details : {
        method: "GET",
        endpoint: "/v1/bills",
        title: "Não foi possível consultar o Sienge",
        explanation: error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
        suggestion: "Tente novamente e verifique os registros do servidor caso o erro continue.",
        occurredAt: new Date().toISOString()
      }
    };
  }
}

const originLabels: Record<string, string> = {
  AC: "Administração de compras",
  RA: "Administração de obras",
  AI: "Apuração de impostos",
  CO: "Comercial",
  CF: "Conhecimento de frete",
  CP: "Contas a pagar",
  ME: "Contratos e medições",
  MO: "Mão de obra",
  DV: "Devolução de nota fiscal",
  RF: "Financiamento bancário",
  FP: "Folha de pagamento",
  FE: "Frota de equipamentos",
  GI: "Guia de impostos",
  LO: "Locação de imóveis",
  SE: "Sistemas externos"
};

function groupEntries(entries: FinancialEntry[], key: (entry: FinancialEntry) => string): ChartItem[] {
  const groups = new Map<string, ChartItem>();
  entries.forEach((entry) => {
    const label = key(entry);
    const current = groups.get(label) || { label, value: 0, count: 0 };
    current.value += entry.amount;
    current.count += 1;
    groups.set(label, current);
  });
  return Array.from(groups.values()).sort((a, b) => b.value - a.value);
}

export function analyzePayables(result: PayablesResult): PayablesAnalytics {
  const entries = result.entries;
  const totalAmount = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const monthlyMap = new Map<string, ChartItem & { order: number }>();
  entries.forEach((entry) => {
    const date = new Date(`${entry.dueDate}T00:00:00`);
    const order = date.getFullYear() * 12 + date.getMonth();
    const label = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(date);
    const current = monthlyMap.get(label) || { label, value: 0, count: 0, order };
    current.value += entry.amount;
    current.count += 1;
    monthlyMap.set(label, current);
  });
  const monthly = Array.from(monthlyMap.values()).sort((a, b) => a.order - b.order);
  const rangeDefinitions = [
    { label: "Até R$ 10 mil", min: 0, max: 10_000 },
    { label: "R$ 10 mil a R$ 50 mil", min: 10_000, max: 50_000 },
    { label: "R$ 50 mil a R$ 100 mil", min: 50_000, max: 100_000 },
    { label: "R$ 100 mil a R$ 500 mil", min: 100_000, max: 500_000 },
    { label: "Acima de R$ 500 mil", min: 500_000, max: Number.POSITIVE_INFINITY }
  ];
  const valueRanges = rangeDefinitions.map((range) => {
    const matching = entries.filter((entry) => entry.amount >= range.min && entry.amount < range.max);
    return {
      label: range.label,
      value: matching.reduce((sum, entry) => sum + entry.amount, 0),
      count: matching.length
    };
  });

  return {
    totalAmount,
    averageAmount: entries.length ? totalAmount / entries.length : 0,
    coverage: result.totalCount ? Math.min(100, (entries.length / result.totalCount) * 100) : 0,
    completeCount: entries.filter((entry) => entry.status === "Completo").length,
    incompleteCount: entries.filter((entry) => entry.status !== "Completo").length,
    monthly,
    creditors: groupEntries(entries, (entry) => entry.party).slice(0, 6),
    origins: groupEntries(entries, (entry) => originLabels[entry.originId || ""] || entry.originId || "Origem não informada").slice(0, 6),
    valueRanges
  };
}
