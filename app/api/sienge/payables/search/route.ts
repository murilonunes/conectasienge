import { existsSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

type PayableInstallment = {
  creditorId?: number;
  billId: number;
  installmentId: number;
  payments?: Array<{ paymentDate?: string }>;
  __siengeIntegrationDay?: string;
  __siengeIntegratedAt?: string;
  [key: string]: unknown;
};

type Creditor = {
  id?: number;
  cnpj?: string;
  cpf?: string;
};

type SqlRow = {
  raw_json: string;
  source_day?: string;
  saved_at?: string;
};

type CreditorRow = {
  raw_json: string;
};

const dataDir = path.join(process.cwd(), ".sienge-data");
const payablesDatabasePath = path.join(dataDir, "finance-payables.sqlite");
const creditorsDatabasePath = path.join(dataDir, "parties-creditors.sqlite");
let indexesChecked = false;

function currentDay() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function openDatabase(databasePath: string) {
  const database = new DatabaseSync(databasePath);
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
      CREATE INDEX IF NOT EXISTS idx_bulk_outcome_installments_issueDate ON bulk_outcome_installments(issueDate);
      CREATE INDEX IF NOT EXISTS idx_bulk_outcome_installments_billDate ON bulk_outcome_installments(billDate);
      CREATE INDEX IF NOT EXISTS idx_bulk_outcome_installments_baseDate ON bulk_outcome_installments(installmentBaseDate);
      CREATE INDEX IF NOT EXISTS idx_bulk_outcome_installments_companyId ON bulk_outcome_installments(companyId);
      CREATE INDEX IF NOT EXISTS idx_bulk_outcome_payments_paymentDate ON bulk_outcome_payments(paymentDate);
      CREATE INDEX IF NOT EXISTS idx_bulk_outcome_payments_parent ON bulk_outcome_payments(tenant, billId, installmentId);
      CREATE INDEX IF NOT EXISTS idx_bulk_outcome_buildings_filter ON bulk_outcome_buildings_costs(tenant, billId, installmentId, buildingId, buildingUnitId);
    `);
  } catch {
    // If the database is busy, continue with existing indexes instead of blocking the search.
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
  const paymentStatus = params.get("paymentStatus") || "all";

  if (selectionType === "P") {
    clauses.push(`EXISTS (
      SELECT 1 FROM bulk_outcome_payments p
      WHERE p.tenant = i.tenant
        AND p.billId = i.billId
        AND p.installmentId = i.installmentId
        AND p.paymentDate BETWEEN ? AND ?
    )`);
    values.push(startDate, endDate);
  } else {
    clauses.push(`${dateColumn(selectionType)} BETWEEN ? AND ?`);
    values.push(startDate, endDate);
  }

  if (paymentStatus === "paid" && selectionType !== "P") {
    clauses.push(`EXISTS (
      SELECT 1 FROM bulk_outcome_payments p
      WHERE p.tenant = i.tenant
        AND p.billId = i.billId
        AND p.installmentId = i.installmentId
    )`);
  }

  if (paymentStatus === "unpaid") {
    clauses.push(`NOT EXISTS (
      SELECT 1 FROM bulk_outcome_payments p
      WHERE p.tenant = i.tenant
        AND p.billId = i.billId
        AND p.installmentId = i.installmentId
    )`);
  }

  addOptionalNumberFilter(clauses, values, params, "companyId", "i.companyId = ?");

  const buildingId = params.get("buildingId");
  const buildingUnitId = params.get("buildingUnitId");
  if (buildingId || buildingUnitId) {
    const buildingClauses = [
      "b.tenant = i.tenant",
      "b.billId = i.billId",
      "b.installmentId = i.installmentId"
    ];
    if (buildingId && Number.isFinite(Number(buildingId))) {
      buildingClauses.push("b.buildingId = ?");
      values.push(Number(buildingId));
    }
    if (buildingUnitId && Number.isFinite(Number(buildingUnitId))) {
      buildingClauses.push("b.buildingUnitId = ?");
      values.push(Number(buildingUnitId));
    }
    clauses.push(`EXISTS (SELECT 1 FROM bulk_outcome_buildings_costs b WHERE ${buildingClauses.join(" AND ")})`);
  }

  return { sql: clauses.join(" AND "), values };
}

function annotate(row: SqlRow): PayableInstallment {
  const item = JSON.parse(row.raw_json) as PayableInstallment;
  return {
    ...item,
    __siengeIntegrationDay: row.source_day,
    __siengeIntegratedAt: row.saved_at
  };
}

function loadCreditors(ids: number[]) {
  if (!ids.length || !existsSync(creditorsDatabasePath)) return new Map<number, Creditor>();
  const database = openDatabase(creditorsDatabasePath);
  try {
    if (!tableExists(database, "sienge_records")) return new Map<number, Creditor>();
    const result = new Map<number, Creditor>();
    for (let index = 0; index < ids.length; index += 400) {
      const chunk = ids.slice(index, index + 400);
      const placeholders = chunk.map(() => "?").join(", ");
      const rows = database.prepare(`
        SELECT raw_json
        FROM sienge_records
        WHERE endpoint LIKE '/v1/creditors%'
          AND record_id IN (${placeholders})
      `).all(...chunk.map((id) => `id:${id}`)) as CreditorRow[];
      rows.forEach((row) => {
        try {
          const creditor = JSON.parse(row.raw_json) as Creditor;
          if (typeof creditor.id === "number") result.set(creditor.id, creditor);
        } catch {
          // Ignore malformed auxiliary records.
        }
      });
    }
    return result;
  } finally {
    database.close();
  }
}

function searchLocalPayables(params: URLSearchParams, selectionType: string, startDate: string, endDate: string) {
  if (!existsSync(payablesDatabasePath)) {
    return { error: "Os dados de contas a pagar ainda não foram atualizados. Atualize Contas a pagar em Configurações." };
  }

  const database = openDatabase(payablesDatabasePath);
  try {
    if (!tableExists(database, "bulk_outcome_installments")) {
      return { error: "As parcelas de contas a pagar ainda não estão disponíveis. Atualize Contas a pagar em Configurações." };
    }
    ensureIndexes(database);
    const where = buildWhere(params, selectionType, startDate, endDate);
    const rows = database.prepare(`
      SELECT i.raw_json, i.source_day, i.saved_at
      FROM bulk_outcome_installments i
      WHERE ${where.sql}
      ORDER BY ${selectionType === "P" ? "i.dueDate" : dateColumn(selectionType)} ASC, i.billId ASC, i.installmentId ASC
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
  const correctionIndexerId = Number(params.get("correctionIndexerId"));
  const correctionDate = params.get("correctionDate");

  if (!startDate || !endDate || !correctionDate || !["I", "D", "P", "B"].includes(selectionType || "") || !Number.isInteger(correctionIndexerId) || correctionIndexerId <= 0) {
    return NextResponse.json({ message: "Informe período, tipo de data, indexador e data de correção válidos." }, { status: 400 });
  }

  try {
    const local = searchLocalPayables(params, selectionType!, startDate, endDate);
    if ("error" in local) return NextResponse.json({ message: local.error }, { status: 404 });

    const creditorIds = Array.from(new Set(local.data.map((item) => item.creditorId).filter((id): id is number => typeof id === "number")));
    const creditors = loadCreditors(creditorIds);
    const data = local.data.map((item) => ({
      ...item,
      creditorCnpj: item.creditorId ? creditors.get(item.creditorId)?.cnpj : undefined,
      creditorCpf: item.creditorId ? creditors.get(item.creditorId)?.cpf : undefined
    }));

    return NextResponse.json({
      data,
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
