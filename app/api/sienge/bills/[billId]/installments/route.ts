import { existsSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { NextResponse } from "next/server";

type SqlRow = {
  raw_json: string;
  source_day?: string;
  saved_at?: string;
};

type RawInstallment = {
  billId?: number;
  installmentId?: number;
  companyId?: number;
  creditorId?: number;
  documentIdentificationId?: string;
  documentNumber?: string;
  issueDate?: string;
  dueDate?: string;
  billDate?: string;
  installmentBaseDate?: string;
  originalAmount?: number;
  balanceAmount?: number;
  correctedBalanceAmount?: number;
  discountAmount?: number;
  indexerId?: number;
  consistencyStatus?: string;
  originId?: string;
  authorizationStatus?: string;
  registeredBy?: string;
  registeredDate?: string;
  payments?: unknown[];
  [key: string]: unknown;
};

const payablesDatabasePath = path.join(process.cwd(), ".sienge-data", "finance-payables.sqlite");

function openDatabase() {
  const database = new DatabaseSync(payablesDatabasePath);
  database.exec("PRAGMA busy_timeout = 8000;");
  return database;
}

function tableExists(database: DatabaseSync, table: string) {
  return Boolean(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function parseRows(rows: SqlRow[]) {
  return rows.map((row) => ({
    raw: JSON.parse(row.raw_json) as RawInstallment,
    sourceDay: row.source_day,
    savedAt: row.saved_at
  }));
}

function parseChildren(database: DatabaseSync, table: string, billId: number) {
  if (!tableExists(database, table)) return [];
  return (database.prepare(`SELECT raw_json FROM ${table} WHERE billId = ? ORDER BY installmentId ASC, rowIndex ASC`).all(billId) as Array<{ raw_json: string }>)
    .map((row) => {
      try {
        return JSON.parse(row.raw_json);
      } catch {
        return undefined;
      }
    })
    .filter(Boolean);
}

export async function GET(_: Request, { params }: { params: { billId: string } }) {
  const billId = Number(params.billId);
  if (!Number.isInteger(billId) || billId <= 0) {
    return NextResponse.json({ message: "Informe um código de título válido." }, { status: 400 });
  }

  if (!existsSync(payablesDatabasePath)) {
    return NextResponse.json({ message: "Os dados de contas a pagar ainda não foram atualizados. Atualize Contas a pagar em Configurações." }, { status: 404 });
  }

  const database = openDatabase();
  try {
    if (!tableExists(database, "bulk_outcome_installments")) {
      return NextResponse.json({ message: "As parcelas de contas a pagar ainda não estão disponíveis. Atualize Contas a pagar em Configurações." }, { status: 404 });
    }

    const rows = database.prepare(`
      SELECT raw_json, source_day, saved_at
      FROM bulk_outcome_installments
      WHERE billId = ?
      ORDER BY installmentId ASC
    `).all(billId) as SqlRow[];

    if (!rows.length) {
      return NextResponse.json({ message: "Nenhuma parcela foi encontrada para este título." }, { status: 404 });
    }

    const parsed = parseRows(rows);
    const first = parsed[0].raw;
    const integrationDay = parsed.map((item) => item.sourceDay).filter(Boolean).sort().at(-1);
    const integratedAt = parsed.map((item) => item.savedAt).filter(Boolean).sort().at(-1);
    const totalInvoiceAmount = parsed.reduce((sum, item) => sum + (Number(item.raw.originalAmount) || 0), 0);
    const discount = parsed.reduce((sum, item) => sum + (Number(item.raw.discountAmount) || 0), 0);

    const bill = {
      id: billId,
      debtorId: first.companyId,
      creditorId: first.creditorId,
      documentIdentificationId: first.documentIdentificationId,
      documentNumber: first.documentNumber,
      issueDate: first.issueDate,
      installmentsNumber: parsed.length,
      totalInvoiceAmount,
      discount,
      status: first.consistencyStatus,
      originId: first.originId,
      notes: first.creditorName ? `Credor ${first.creditorName}` : undefined,
      registeredBy: first.registeredBy,
      registeredDate: first.registeredDate,
      __siengeIntegrationDay: integrationDay,
      __siengeIntegratedAt: integratedAt
    };

    const installments = parsed.map((item) => {
      const raw = item.raw;
      const paid = Array.isArray(raw.payments) && raw.payments.length > 0;
      return {
        installmentNumber: raw.installmentId || 0,
        dueDate: raw.dueDate,
        baseDate: raw.installmentBaseDate,
        billDate: raw.billDate,
        amount: raw.originalAmount || 0,
        originalAmount: raw.originalAmount || 0,
        balanceAmount: raw.balanceAmount,
        correctedBalanceAmount: raw.correctedBalanceAmount,
        indexId: raw.indexerId,
        authorizationStatus: raw.authorizationStatus,
        payments: raw.payments || [],
        situation: paid ? "Com baixa" : raw.consistencyStatus === "S" ? "Não paga" : "Em revisão",
        sentToBank: false,
        batchNumber: undefined,
        __siengeIntegrationDay: item.sourceDay,
        __siengeIntegratedAt: item.savedAt
      };
    });

    return NextResponse.json({
      bill,
      installments,
      budgetCategories: parseChildren(database, "bulk_outcome_payments_categories", billId),
      buildingsCost: parseChildren(database, "bulk_outcome_buildings_costs", billId),
      departmentsCost: parseChildren(database, "bulk_outcome_departaments_costs", billId),
      attachments: [],
      cacheInfo: {
        source: "sqlite",
        savedAt: integratedAt,
        queryMode: "structured-local"
      }
    });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Erro inesperado ao consultar os dados salvos." }, { status: 500 });
  } finally {
    database.close();
  }
}
