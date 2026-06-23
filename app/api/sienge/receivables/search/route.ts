import { existsSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

type ReceivableInstallment = {
  companyId?: number;
  companyName?: string;
  businessAreaName?: string;
  projectId?: number;
  projectName?: string;
  clientId?: number;
  clientName?: string;
  billId: number;
  installmentId: number;
  documentIdentificationId?: string;
  documentNumber?: string;
  documentForecast?: string;
  originalAmount?: number;
  balanceAmount?: number;
  correctedBalanceAmount?: number;
  dueDate?: string;
  issueDate?: string;
  billDate?: string;
  installmentBaseDate?: string;
  mainUnit?: string;
  receipts?: unknown[];
  __siengeIntegrationDay?: string;
  __siengeIntegratedAt?: string;
  [key: string]: unknown;
};

type SqlRow = {
  raw_json: string;
  source_day?: string;
  saved_at?: string;
};

const dataDir = path.join(process.cwd(), ".sienge-data");
const receivablesDatabasePath = path.join(dataDir, "finance-receivables.sqlite");
let indexesChecked = false;

function currentDay() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
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
  if (indexesChecked) return;
  indexesChecked = true;
  try {
    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_bulk_income_installments_issueDate ON bulk_income_installments(issueDate);
      CREATE INDEX IF NOT EXISTS idx_bulk_income_installments_billDate ON bulk_income_installments(billDate);
      CREATE INDEX IF NOT EXISTS idx_bulk_income_installments_baseDate ON bulk_income_installments(installmentBaseDate);
      CREATE INDEX IF NOT EXISTS idx_bulk_income_installments_companyId_filter ON bulk_income_installments(companyId);
      CREATE INDEX IF NOT EXISTS idx_bulk_income_installments_projectId_filter ON bulk_income_installments(projectId);
      CREATE INDEX IF NOT EXISTS idx_bulk_income_installments_clientId_filter ON bulk_income_installments(clientId);
      CREATE INDEX IF NOT EXISTS idx_bulk_income_receipts_paymentDate ON bulk_income_receipts(paymentDate);
      CREATE INDEX IF NOT EXISTS idx_bulk_income_receipts_parent ON bulk_income_receipts(tenant, billId, installmentId);
    `);
  } catch {
    // A busca continua funcionando sem os índices; apenas pode ficar mais lenta em bases grandes.
  }
}

function dateColumn(selectionType: string) {
  if (selectionType === "I") return "i.issueDate";
  if (selectionType === "B") return "COALESCE(NULLIF(i.billDate, ''), i.installmentBaseDate)";
  return "i.dueDate";
}

function addOptionalNumberFilter(
  clauses: string[],
  values: Array<string | number>,
  params: URLSearchParams,
  key: string,
  sql: string
) {
  const value = params.get(key);
  if (!value) return;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return;
  clauses.push(sql);
  values.push(parsed);
}

function buildWhere(params: URLSearchParams, selectionType: string, startDate: string, endDate: string) {
  const clauses: string[] = [];
  const values: Array<string | number> = [];
  const receiptStatus = params.get("receiptStatus") || "all";

  if (selectionType === "R") {
    clauses.push(`EXISTS (
      SELECT 1 FROM bulk_income_receipts r
      WHERE r.tenant = i.tenant
        AND r.billId = i.billId
        AND r.installmentId = i.installmentId
        AND r.paymentDate BETWEEN ? AND ?
    )`);
    values.push(startDate, endDate);
  } else {
    clauses.push(`${dateColumn(selectionType)} BETWEEN ? AND ?`);
    values.push(startDate, endDate);
  }

  if (receiptStatus === "received" && selectionType !== "R") {
    clauses.push(`EXISTS (
      SELECT 1 FROM bulk_income_receipts r
      WHERE r.tenant = i.tenant
        AND r.billId = i.billId
        AND r.installmentId = i.installmentId
    )`);
  }

  if (receiptStatus === "open") {
    clauses.push(`NOT EXISTS (
      SELECT 1 FROM bulk_income_receipts r
      WHERE r.tenant = i.tenant
        AND r.billId = i.billId
        AND r.installmentId = i.installmentId
    )`);
  }

  addOptionalNumberFilter(clauses, values, params, "companyId", "i.companyId = ?");
  addOptionalNumberFilter(clauses, values, params, "projectId", "i.projectId = ?");
  addOptionalNumberFilter(clauses, values, params, "clientId", "i.clientId = ?");
  addOptionalNumberFilter(clauses, values, params, "businessAreaId", "i.businessAreaId = ?");

  return { sql: clauses.join(" AND "), values };
}

function annotate(row: SqlRow): ReceivableInstallment {
  const item = JSON.parse(row.raw_json) as ReceivableInstallment;
  return {
    ...item,
    __siengeIntegrationDay: row.source_day,
    __siengeIntegratedAt: row.saved_at
  };
}

function searchLocalReceivables(params: URLSearchParams, selectionType: string, startDate: string, endDate: string) {
  if (!existsSync(receivablesDatabasePath)) {
    return { error: "Os dados de contas a receber ainda não foram atualizados. Atualize Contas a receber em Configurações." };
  }

  const database = openDatabase();
  try {
    if (!tableExists(database, "bulk_income_installments")) {
      return { error: "As parcelas de contas a receber ainda não estão disponíveis. Atualize Contas a receber em Configurações." };
    }
    ensureIndexes(database);
    const where = buildWhere(params, selectionType, startDate, endDate);
    const rows = database.prepare(`
      SELECT i.raw_json, i.source_day, i.saved_at
      FROM bulk_income_installments i
      WHERE ${where.sql}
      ORDER BY ${selectionType === "R" ? "i.dueDate" : dateColumn(selectionType)} ASC, i.billId ASC, i.installmentId ASC
    `).all(...where.values) as SqlRow[];
    const data = rows.map(annotate);
    const savedAt = rows.map((row) => row.saved_at).filter(Boolean).sort().at(-1) || new Date().toISOString();
    return { data, savedAt };
  } finally {
    database.close();
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const startDate = params.get("startDate");
  const endDate = params.get("endDate");
  const selectionType = params.get("selectionType");

  if (!startDate || !endDate || !["I", "D", "R", "B"].includes(selectionType || "")) {
    return NextResponse.json({ message: "Informe período e tipo de data válidos." }, { status: 400 });
  }

  try {
    const local = searchLocalReceivables(params, selectionType!, startDate, endDate);
    if ("error" in local) return NextResponse.json({ message: local.error }, { status: 404 });

    return NextResponse.json({
      data: local.data,
      cacheInfo: {
        source: "sqlite",
        savedAt: local.savedAt,
        day: currentDay(),
        queryMode: "structured-local"
      }
    });
  } catch (error) {
    return NextResponse.json({
      message: error instanceof Error ? error.message : "Erro inesperado ao consultar os dados salvos."
    }, { status: 500 });
  }
}
