import "server-only";
import { existsSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";

type Row = Record<string, unknown>;
type JsonRow = { raw_json: string };

export type ContractsReportSummary = {
  totalValue: number;
  activeCount: number;
  totalCount: number;
};

export type DreReportSummary = {
  year: number;
  availableYears: number[];
  baseCount: number;
};

const dataDir = path.join(process.cwd(), ".sienge-data");
const dbFiles = {
  sales: path.join(dataDir, "commercial-sales.sqlite"),
  contracts: path.join(dataDir, "contracts-supply.sqlite")
};

function todayYear() {
  return Number(new Date().toISOString().slice(0, 4));
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

function supplyContractValue(contract: Row) {
  return money(contract.totalValue ?? contract.contractValue ?? contract.value);
}

function isClosedSupplyContract(contract: Row) {
  return /encerrad|finalizad|cancelad|distrat/i.test(String(contract.status || contract.situation || contract.contractStatus || ""));
}

function addYear(years: Set<number>, value: unknown) {
  const year = Number(String(value || "").slice(0, 4));
  if (Number.isInteger(year) && year >= 2000 && year <= 2100) years.add(year);
}

function addYearsFromDatabase(databasePath: string, endpointSql: string, dateFields: string[], years: Set<number>) {
  const database = openDatabase(databasePath);
  if (!database) return 0;
  try {
    if (!tableExists(database, "sienge_records")) return 0;
    const rows = database.prepare(`
      SELECT raw_json
      FROM sienge_records
      WHERE ${endpointSql}
    `).all() as JsonRow[];
    rows.forEach((row) => {
      const record = safeJson<Row>(row.raw_json);
      if (!record) return;
      dateFields.forEach((field) => addYear(years, record[field]));
    });
    return rows.length;
  } finally {
    database.close();
  }
}

export function loadContractsReportSummary(): ContractsReportSummary {
  const database = openDatabase(dbFiles.contracts);
  if (!database) return { totalValue: 0, activeCount: 0, totalCount: 0 };
  try {
    if (!tableExists(database, "sienge_records")) return { totalValue: 0, activeCount: 0, totalCount: 0 };
    const rows = database.prepare(`
      SELECT raw_json
      FROM sienge_records
      WHERE endpoint IN ('/v1/supply-contracts/all', '/v1/supply-contracts')
    `).all() as JsonRow[];
    const contracts = rows.map((row) => safeJson<Row>(row.raw_json)).filter((item): item is Row => Boolean(item));
    return {
      totalValue: contracts.reduce((sum, contract) => sum + supplyContractValue(contract), 0),
      activeCount: contracts.filter((contract) => !isClosedSupplyContract(contract)).length,
      totalCount: contracts.length
    };
  } finally {
    database.close();
  }
}

export function loadDreReportSummary(): DreReportSummary {
  const years = new Set<number>();
  const salesCount = addYearsFromDatabase(
    dbFiles.sales,
    "endpoint = '/v1/sales-contracts'",
    ["issueDate", "contractDate", "cancellationDate"],
    years
  );
  const contractsCount = addYearsFromDatabase(
    dbFiles.contracts,
    "endpoint IN ('/v1/supply-contracts/all', '/v1/supply-contracts')",
    ["issueDate", "contractDate", "signatureDate", "startDate"],
    years
  );
  if (!years.size) years.add(todayYear());
  const availableYears = Array.from(years).sort((left, right) => right - left);
  return {
    year: availableYears[0] || todayYear(),
    availableYears,
    baseCount: salesCount + contractsCount
  };
}
