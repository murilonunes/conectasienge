import "server-only";
import { contasReceberApi } from "@/lib/api/financeiro";
import { SiengeApiError, type SiengeErrorDetails } from "@/lib/api/sienge";
import type { ChartItem } from "@/features/financeiro/sienge-data";

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
};

type IncomeResponse = {
  data?: ReceivableInstallment[];
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

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function forecastRange() {
  const today = new Date();
  const end = new Date(today.getFullYear() + 5, 11, 31);
  return {
    startDate: "2000-01-01",
    endDate: iso(end),
    correctionDate: iso(today)
  };
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
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
  const document = [entry.documentIdentificationId, entry.documentNumber].filter(Boolean).join("-");
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

export async function loadReceivablesForecast(forceRefresh = false): Promise<ReceivablesForecastResult> {
  const range = forecastRange();
  try {
    const response = await contasReceberApi.incomeForecast<IncomeResponse>({
      startDate: range.startDate,
      endDate: range.endDate,
      selectionType: "D",
      correctionIndexerId: 1,
      correctionDate: range.correctionDate
    }, forceRefresh);
    const entries = response.data || [];
    const forecastEntries = entries
      .filter((entry) => receivableOpenAmount(entry) > 0)
      .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
    return {
      entries,
      forecastEntries,
      totalCount: entries.length,
      loadedFrom: "/bulk-data/v1/income",
      range
    };
  } catch (error) {
    return {
      entries: [],
      forecastEntries: [],
      totalCount: 0,
      loadedFrom: "/bulk-data/v1/income",
      range,
      error: error instanceof SiengeApiError ? error.details : {
        method: "GET",
        endpoint: "/bulk-data/v1/income",
        title: "Não foi possível consultar a previsão de recebimentos",
        explanation: error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
        suggestion: "Tente novamente e verifique os registros do servidor caso o erro continue.",
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
    const label = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(dueDate);
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
