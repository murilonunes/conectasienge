import "server-only";
import { existsSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { contratosApi } from "@/lib/api/financeiro";
import { SiengeApiError, type SiengeErrorDetails } from "@/lib/api/sienge";
import type { SalesContract, SalesSummary } from "./types";

export type SalesResult = {
  contracts: SalesContract[];
  totalCount: number;
  error?: SiengeErrorDetails;
};

type SqlRow = {
  raw_json: string;
  source_day?: string;
  saved_at?: string;
};

const dataDir = path.join(process.cwd(), ".sienge-data");
const salesDatabasePath = path.join(dataDir, "commercial-sales.sqlite");

function openDatabase() {
  const database = new DatabaseSync(salesDatabasePath);
  database.exec("PRAGMA busy_timeout = 8000;");
  return database;
}

function tableExists(database: DatabaseSync, table: string) {
  return Boolean(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function localDataError(title: string, explanation: string): SiengeErrorDetails {
  return {
    method: "GET",
    endpoint: "/v1/sales-contracts",
    title,
    explanation,
    suggestion: "Atualize Vendas em Configurações para preencher os dados.",
    occurredAt: new Date().toISOString()
  };
}

function annotate(row: SqlRow): SalesContract | undefined {
  try {
    return {
      ...(JSON.parse(row.raw_json) as SalesContract),
      __siengeIntegrationDay: row.source_day,
      __siengeIntegratedAt: row.saved_at
    } as SalesContract;
  } catch {
    return undefined;
  }
}

function saleDate(contract: SalesContract) {
  return contract.issueDate || contract.contractDate || "";
}

function readLocalSales(): SalesResult {
  if (!existsSync(salesDatabasePath)) {
    return {
      contracts: [],
      totalCount: 0,
      error: localDataError("Vendas sem dados carregados", "Os contratos de venda ainda não foram atualizados.")
    };
  }

  const database = openDatabase();
  try {
    if (!tableExists(database, "sienge_records")) {
      return {
        contracts: [],
        totalCount: 0,
        error: localDataError("Vendas ainda não disponíveis", "Ainda não há contratos de venda salvos para exibição.")
      };
    }

    const rows = database.prepare(`
      SELECT raw_json, source_day, saved_at
      FROM sienge_records
      WHERE endpoint = '/v1/sales-contracts'
      ORDER BY saved_at DESC
    `).all() as SqlRow[];
    const contracts = rows
      .map(annotate)
      .filter((item): item is SalesContract => Boolean(item))
      .sort((left, right) => saleDate(right).localeCompare(saleDate(left)) || Number(right.id || 0) - Number(left.id || 0));

    return {
      contracts,
      totalCount: contracts.length,
      ...(contracts.length === 0 ? {
        error: localDataError("Vendas sem dados", "Nenhum contrato de venda foi encontrado na base local.")
      } : {})
    };
  } finally {
    database.close();
  }
}

export async function loadSalesContracts(forceRefresh = false, forceReplaceFinalized = false): Promise<SalesResult> {
  if (!forceRefresh) return readLocalSales();

  try {
    const limit = 200;
    const response = await contratosApi.sales<SalesContract>({ limit, offset: 0 }, forceRefresh, forceReplaceFinalized);
    const totalCount = response.resultSetMetadata?.count ?? response.results.length;
    const remainingPages = Math.max(0, Math.ceil(totalCount / limit) - 1);
    const additionalResponses = await Promise.all(Array.from({ length: remainingPages }, (_, index) =>
      contratosApi.sales<SalesContract>({ limit, offset: (index + 1) * limit }, forceRefresh, forceReplaceFinalized)
    ));
    const contracts = [
      ...(response.results || []),
      ...additionalResponses.flatMap((page) => page.results || [])
    ];
    return {
      contracts,
      totalCount
    };
  } catch (error) {
    const details = error instanceof SiengeApiError ? error.details : undefined;
    return {
      contracts: [],
      totalCount: 0,
      error: details ? {
        ...details,
        explanation: details.status === 403
          ? "O Sienge reconheceu a autenticação, mas bloqueou o acesso aos contratos de vendas."
          : details.explanation,
        suggestion: details.status === 403
          ? "No Painel de Integrações do Sienge, libere Contratos de Vendas para esta credencial."
          : details.suggestion
      } : {
        method: "GET",
        endpoint: "/v1/sales-contracts",
        title: "Não foi possível consultar contratos de vendas",
        explanation: error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
        suggestion: "Verifique a permissão de Contratos de Vendas no Sienge.",
        occurredAt: new Date().toISOString()
      }
    };
  }
}

function groupContracts(contracts: SalesContract[], label: (contract: SalesContract) => string) {
  const groups = new Map<string, { label: string; value: number; count: number }>();
  contracts.forEach((contract) => {
    const key = label(contract);
    const current = groups.get(key) || { label: key, value: 0, count: 0 };
    current.value += contract.totalSellingValue || contract.value || 0;
    current.count += 1;
    groups.set(key, current);
  });
  return Array.from(groups.values()).sort((a, b) => b.value - a.value);
}

export function analyzeSales(contracts: SalesContract[]): SalesSummary {
  const totalValue = contracts.reduce((sum, contract) => sum + (contract.totalSellingValue || contract.value || 0), 0);
  const conditions = contracts.flatMap((contract) => contract.paymentConditions || []);
  const outstandingBalance = conditions.reduce((sum, condition) => sum + (condition.outstandingBalance || 0), 0);
  const amountPaid = conditions.reduce((sum, condition) => sum + (condition.amountPaid || 0), 0);
  const monthlyMap = new Map<string, { label: string; value: number; count: number; order: number }>();
  contracts.forEach((contract) => {
    const rawDate = contract.issueDate || contract.contractDate;
    if (!rawDate) return;
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return;
    const label = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(date);
    const current = monthlyMap.get(label) || {
      label,
      value: 0,
      count: 0,
      order: date.getFullYear() * 12 + date.getMonth()
    };
    current.value += contract.totalSellingValue || contract.value || 0;
    current.count += 1;
    monthlyMap.set(label, current);
  });

  return {
    totalValue,
    outstandingBalance,
    amountPaid,
    averageValue: contracts.length ? totalValue / contracts.length : 0,
    activeCount: contracts.filter((contract) => !/cancelad|distrat/i.test(contract.situation || "")).length,
    cancelledCount: contracts.filter((contract) => /cancelad|distrat/i.test(contract.situation || "")).length,
    byEnterprise: groupContracts(contracts, (contract) => contract.enterpriseName || "Empreendimento não informado").slice(0, 8),
    bySituation: groupContracts(contracts, (contract) => contract.situation || "Situação não informada"),
    monthlySales: Array.from(monthlyMap.values()).sort((a, b) => a.order - b.order)
  };
}
