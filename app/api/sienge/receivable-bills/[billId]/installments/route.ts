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
  companyName?: string;
  clientId?: number;
  clientName?: string;
  projectId?: number;
  projectName?: string;
  businessAreaName?: string;
  documentIdentificationId?: string;
  documentNumber?: string;
  documentForecast?: string;
  originId?: string;
  originalAmount?: number;
  discountAmount?: number;
  taxAmount?: number;
  balanceAmount?: number;
  correctedBalanceAmount?: number;
  dueDate?: string;
  issueDate?: string;
  billDate?: string;
  installmentBaseDate?: string;
  mainUnit?: string;
  installmentNumber?: string;
  bearerId?: number;
  receipts?: unknown[];
  [key: string]: unknown;
};

const receivablesDatabasePath = path.join(process.cwd(), ".sienge-data", "finance-receivables.sqlite");

function openDatabase() {
  const database = new DatabaseSync(receivablesDatabasePath);
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

  if (!existsSync(receivablesDatabasePath)) {
    return NextResponse.json({ message: "Os dados de contas a receber ainda não foram atualizados. Atualize Contas a receber em Configurações." }, { status: 404 });
  }

  const database = openDatabase();
  try {
    if (!tableExists(database, "bulk_income_installments")) {
      return NextResponse.json({ message: "As parcelas de contas a receber ainda não estão disponíveis. Atualize Contas a receber em Configurações." }, { status: 404 });
    }

    const rows = database.prepare(`
      SELECT raw_json, source_day, saved_at
      FROM bulk_income_installments
      WHERE billId = ?
      ORDER BY installmentId ASC
    `).all(billId) as SqlRow[];

    if (!rows.length) {
      return NextResponse.json({ message: "Nenhuma parcela foi encontrada para este título a receber." }, { status: 404 });
    }

    const parsed = parseRows(rows);
    const first = parsed[0].raw;
    const integrationDay = parsed.map((item) => item.sourceDay).filter(Boolean).sort().at(-1);
    const integratedAt = parsed.map((item) => item.savedAt).filter(Boolean).sort().at(-1);
    const totalInvoiceAmount = parsed.reduce((sum, item) => sum + (Number(item.raw.originalAmount) || 0), 0);
    const discount = parsed.reduce((sum, item) => sum + (Number(item.raw.discountAmount) || 0), 0);

    const bill = {
      id: billId,
      companyId: first.companyId,
      companyName: first.companyName,
      clientId: first.clientId,
      clientName: first.clientName,
      projectId: first.projectId,
      projectName: first.projectName,
      businessAreaName: first.businessAreaName,
      documentIdentificationId: first.documentIdentificationId,
      documentNumber: first.documentNumber,
      issueDate: first.issueDate,
      installmentsNumber: parsed.length,
      totalInvoiceAmount,
      discount,
      originId: first.originId,
      mainUnit: first.mainUnit,
      __siengeIntegrationDay: integrationDay,
      __siengeIntegratedAt: integratedAt
    };

    const installments = parsed.map((item) => {
      const raw = item.raw;
      const receipts = Array.isArray(raw.receipts) ? raw.receipts : [];
      const open = Number(raw.balanceAmount ?? raw.correctedBalanceAmount ?? raw.originalAmount ?? 0);
      return {
        installmentNumber: raw.installmentNumber || raw.installmentId || 0,
        installmentId: raw.installmentId || 0,
        dueDate: raw.dueDate,
        baseDate: raw.installmentBaseDate,
        billDate: raw.billDate,
        issueDate: raw.issueDate,
        amount: raw.originalAmount || 0,
        originalAmount: raw.originalAmount || 0,
        balanceAmount: raw.balanceAmount,
        correctedBalanceAmount: raw.correctedBalanceAmount,
        discountAmount: raw.discountAmount,
        taxAmount: raw.taxAmount,
        documentForecast: raw.documentForecast,
        bearerId: raw.bearerId,
        receipts,
        situation: receipts.length ? "Com recebimento" : open <= 0 ? "Recebida" : "Em aberto",
        __siengeIntegrationDay: item.sourceDay,
        __siengeIntegratedAt: item.savedAt
      };
    });

    return NextResponse.json({
      bill,
      installments,
      receiptsCategories: parseChildren(database, "bulk_income_receipts_categories", billId),
      bankMovements: parseChildren(database, "bulk_income_bank_movements", billId),
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
