import "server-only";
import { existsSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { contratosApi } from "@/lib/api/financeiro";
import { SiengeApiError, type SiengeErrorDetails, type SiengePage } from "@/lib/api/sienge";
import type { SupplyContract, ContractsResult, ContractsSummary } from "./types";
import { contractStatus, contractValue, isClosedContract, measuredValue, balanceValue } from "./utils";

type SqlRow = {
  raw_json: string;
  source_day?: string;
  saved_at?: string;
};

const LIMIT = 200;
const dataDir = path.join(process.cwd(), ".sienge-data");
const contractsDatabasePath = path.join(dataDir, "contracts-supply.sqlite");

function openDatabase() {
  const database = new DatabaseSync(contractsDatabasePath);
  database.exec("PRAGMA busy_timeout = 8000;");
  return database;
}

function tableExists(database: DatabaseSync, table: string) {
  return Boolean(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function localDataError(title: string, explanation: string): SiengeErrorDetails {
  return {
    method: "GET",
    endpoint: "/v1/supply-contracts",
    title,
    explanation,
    suggestion: "Atualize Contratos em Configurações para preencher os dados.",
    occurredAt: new Date().toISOString()
  };
}

function annotate(row: SqlRow): SupplyContract | undefined {
  try {
    return {
      ...(JSON.parse(row.raw_json) as SupplyContract),
      __siengeIntegrationDay: row.source_day,
      __siengeIntegratedAt: row.saved_at
    };
  } catch {
    return undefined;
  }
}

function contractId(contract: SupplyContract) {
  return Number(contract.id || contract.contractId || contract.number || contract.contractNumber || 0);
}

function contractDate(contract: SupplyContract) {
  return contract.issueDate || contract.contractDate || contract.signatureDate || contract.startDate || "";
}

function readLocalContracts(): ContractsResult {
  if (!existsSync(contractsDatabasePath)) {
    return {
      contracts: [],
      totalCount: 0,
      error: localDataError("Contratos sem dados carregados", "Os contratos de fornecimento ainda não foram atualizados.")
    };
  }

  const database = openDatabase();
  try {
    if (!tableExists(database, "sienge_records")) {
      return {
        contracts: [],
        totalCount: 0,
        error: localDataError("Contratos ainda não disponíveis", "Ainda não há contratos salvos para exibição.")
      };
    }

    const rows = database.prepare(`
      SELECT raw_json, source_day, saved_at
      FROM sienge_records
      WHERE endpoint = '/v1/supply-contracts'
      ORDER BY saved_at DESC
    `).all() as SqlRow[];
    const contracts = rows
      .map(annotate)
      .filter((item): item is SupplyContract => Boolean(item))
      .sort((left, right) => contractDate(right).localeCompare(contractDate(left)) || contractId(right) - contractId(left));

    return { contracts, totalCount: contracts.length };
  } finally {
    database.close();
  }
}

async function loadAllPages(forceReplaceFinalized = false) {
  const firstPage = await contratosApi.supply<SupplyContract>({ limit: LIMIT, offset: 0 }, true, forceReplaceFinalized);
  const totalCount = firstPage.resultSetMetadata?.count ?? firstPage.results.length;
  const remainingPages = Math.max(0, Math.ceil(totalCount / LIMIT) - 1);
  const additionalPages = await Promise.all(Array.from({ length: remainingPages }, (_, index) =>
    contratosApi.supply<SupplyContract>({ limit: LIMIT, offset: (index + 1) * LIMIT }, true, forceReplaceFinalized)
  ));

  const contracts = [
    ...(firstPage.results || []),
    ...additionalPages.flatMap((page: SiengePage<SupplyContract>) => page.results || [])
  ];

  return { contracts, totalCount };
}

export async function loadSupplyContracts(forceRefresh = false, forceReplaceFinalized = false): Promise<ContractsResult> {
  if (!forceRefresh) return readLocalContracts();

  try {
    return await loadAllPages(forceReplaceFinalized);
  } catch (error) {
    return {
      ...readLocalContracts(),
      error: error instanceof SiengeApiError ? {
        ...error.details,
        explanation: error.details.status === 403
          ? "A credencial não possui acesso aos contratos de fornecimento."
          : error.details.explanation,
        suggestion: error.details.status === 403
          ? "Libere Contratos de Fornecimento no Painel de Integrações do Sienge."
          : error.details.suggestion
      } : {
        method: "GET",
        endpoint: "/v1/supply-contracts",
        title: "Não foi possível atualizar contratos",
        explanation: error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
        suggestion: "Confira o acesso a Contratos de Fornecimento e tente atualizar novamente em Configurações.",
        occurredAt: new Date().toISOString()
      }
    };
  }
}

export function analyzeContracts(contracts: SupplyContract[]): ContractsSummary {
  const byStatus = new Map<string, { label: string; value: number; count: number }>();
  contracts.forEach((contract) => {
    const label = contractStatus(contract);
    const current = byStatus.get(label) || { label, value: 0, count: 0 };
    current.value += contractValue(contract);
    current.count += 1;
    byStatus.set(label, current);
  });

  const suppliers = new Set(contracts.map((contract) => contract.supplierId || contract.creditorId || contract.supplierName || contract.creditorName).filter(Boolean));

  return {
    totalValue: contracts.reduce((sum, contract) => sum + contractValue(contract), 0),
    measuredValue: contracts.reduce((sum, contract) => sum + measuredValue(contract), 0),
    balanceValue: contracts.reduce((sum, contract) => sum + balanceValue(contract), 0),
    activeCount: contracts.filter((contract) => !isClosedContract(contract)).length,
    closedCount: contracts.filter(isClosedContract).length,
    suppliersCount: suppliers.size,
    byStatus: Array.from(byStatus.values()).sort((left, right) => right.count - left.count)
  };
}
