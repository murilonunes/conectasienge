import "server-only";
import { existsSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";

type Row = Record<string, unknown>;

export type TitleDirection = "payable" | "receivable";
export type TitleStatus = "overdue" | "open" | "settled" | "inclusion" | "incomplete" | "unavailable";

export type FinancialTitle = {
  key: string;
  direction: TitleDirection;
  tenant: string;
  billId: number;
  companyId?: number;
  companyName: string;
  partyId?: number;
  partyName: string;
  documentIdentificationId: string;
  documentIdentificationName: string;
  documentNumber: string;
  originId: string;
  observation: string;
  issueDate: string;
  firstDueDate: string;
  lastDueDate: string;
  installmentCount: number;
  originalAmount: number;
  openAmount: number;
  overdueAmount: number;
  status: TitleStatus;
  integratedAt: string;
};

export type TitleSearchFilters = {
  q: string;
  direction: "all" | TitleDirection;
  status: "all" | TitleStatus;
  company: string;
  origin: string;
  observation: "all" | "with" | "without";
  dateType: "issue" | "due";
  startDate: string;
  endDate: string;
  sort: "newest" | "due" | "highest" | "title";
  page: number;
};

export type FinancialTitlesResult = {
  items: FinancialTitle[];
  totalItems: number;
  totalPages: number;
  page: number;
  pageSize: number;
  openAmount: number;
  overdueAmount: number;
  withObservation: number;
  companies: Array<{ id: string; label: string }>;
  origins: string[];
  filters: TitleSearchFilters;
  warnings: string[];
};

type BillHeader = {
  id?: number;
  debtorId?: number;
  creditorId?: number;
  documentIdentificationId?: string;
  documentNumber?: string;
  issueDate?: string;
  installmentsNumber?: number;
  totalInvoiceAmount?: number;
  notes?: string;
  status?: "S" | "N" | "I";
  originId?: string;
};

const dataDir = path.join(process.cwd(), ".sienge-data");
const databasePaths = {
  payable: path.join(dataDir, "finance-payables.sqlite"),
  receivable: path.join(dataDir, "finance-receivables.sqlite"),
  dump: path.join(dataDir, "sienge-dump.sqlite")
};
const pageSize = 50;

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function number(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalize(value: unknown) {
  return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function tableExists(database: DatabaseSync, table: string) {
  return Boolean(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function openDatabase(databasePath: string) {
  if (!existsSync(databasePath)) return undefined;
  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA busy_timeout = 8000;");
  return database;
}

function titleStatus(row: Pick<FinancialTitle, "openAmount" | "overdueAmount">, headerStatus?: BillHeader["status"]): TitleStatus {
  if (row.overdueAmount > 0.005) return "overdue";
  if (row.openAmount > 0.005) return "open";
  if (headerStatus === "I") return "inclusion";
  if (headerStatus === "N") return "incomplete";
  return "settled";
}

function payableHeaders(database: DatabaseSync) {
  const headers = new Map<string, BillHeader>();
  if (!tableExists(database, "sienge_records")) return headers;

  const rows = database.prepare(`
    SELECT tenant, raw_json
    FROM sienge_records
    WHERE endpoint = '/v1/bills'
  `).all() as Array<{ tenant: string; raw_json: string }>;

  rows.forEach((row) => {
    try {
      const header = JSON.parse(row.raw_json) as BillHeader;
      if (Number.isInteger(Number(header.id))) headers.set(`${row.tenant}:${header.id}`, header);
    } catch {
      // Um registro malformado nao deve impedir a consulta dos demais titulos.
    }
  });
  return headers;
}

function payableDumpObservations() {
  const observations = new Map<number, string>();
  const database = openDatabase(databasePaths.dump);
  if (!database) return observations;

  try {
    if (!tableExists(database, "ecpgtitulo")) return observations;
    const rows = database.prepare(`
      SELECT nutitulo, deobservacao
      FROM ecpgtitulo
      WHERE TRIM(COALESCE(deobservacao, '')) <> ''
    `).all() as Array<{ nutitulo: string; deobservacao: string }>;
    rows.forEach((row) => {
      const billId = number(row.nutitulo);
      const observation = text(row.deobservacao);
      if (billId && observation) observations.set(billId, observation);
    });
    return observations;
  } finally {
    database.close();
  }
}

function loadPayables(warnings: string[]) {
  const database = openDatabase(databasePaths.payable);
  if (!database) {
    warnings.push("Contas a pagar ainda não foram atualizadas em Configurações.");
    return [];
  }

  try {
    if (!tableExists(database, "bulk_outcome_installments")) {
      warnings.push("A carga local de contas a pagar ainda não possui parcelas.");
      return [];
    }
    const headers = payableHeaders(database);
    const dumpObservations = payableDumpObservations();
    const rows = database.prepare(`
      SELECT
        tenant,
        billId,
        MIN(companyId) AS companyId,
        MIN(companyName) AS companyName,
        MIN(creditorId) AS partyId,
        MIN(creditorName) AS partyName,
        MIN(documentIdentificationId) AS documentIdentificationId,
        MIN(documentIdentificationName) AS documentIdentificationName,
        MIN(documentNumber) AS documentNumber,
        MIN(originId) AS originId,
        MIN(issueDate) AS issueDate,
        MIN(dueDate) AS firstDueDate,
        MAX(dueDate) AS lastDueDate,
        COUNT(*) AS installmentCount,
        SUM(COALESCE(originalAmount, 0)) AS originalAmount,
        SUM(COALESCE(correctedBalanceAmount, balanceAmount, originalAmount, 0)) AS openAmount,
        SUM(CASE WHEN dueDate < date('now', 'localtime') THEN COALESCE(correctedBalanceAmount, balanceAmount, originalAmount, 0) ELSE 0 END) AS overdueAmount,
        MAX(saved_at) AS integratedAt
      FROM bulk_outcome_installments
      GROUP BY tenant, billId
    `).all() as Row[];

    const items = rows.map((row): FinancialTitle => {
      const tenant = text(row.tenant);
      const billId = number(row.billId);
      const header = headers.get(`${tenant}:${billId}`);
      const base = {
        openAmount: number(row.openAmount),
        overdueAmount: number(row.overdueAmount)
      };
      headers.delete(`${tenant}:${billId}`);
      return {
        key: `payable:${tenant}:${billId}`,
        direction: "payable",
        tenant,
        billId,
        companyId: optionalNumber(row.companyId ?? header?.debtorId),
        companyName: text(row.companyName) || (header?.debtorId ? `Empresa #${header.debtorId}` : "Empresa não informada"),
        partyId: optionalNumber(row.partyId ?? header?.creditorId),
        partyName: text(row.partyName) || (header?.creditorId ? `Credor #${header.creditorId}` : "Credor não informado"),
        documentIdentificationId: text(row.documentIdentificationId || header?.documentIdentificationId),
        documentIdentificationName: text(row.documentIdentificationName),
        documentNumber: text(row.documentNumber || header?.documentNumber),
        originId: text(row.originId || header?.originId),
        // O cabecalho da API e a fonte mais recente. Quando ele ainda nao foi
        // paginado para este titulo, o dump completa a observacao historica.
        observation: header ? text(header.notes) : text(dumpObservations.get(billId)),
        issueDate: text(row.issueDate || header?.issueDate),
        firstDueDate: text(row.firstDueDate),
        lastDueDate: text(row.lastDueDate),
        installmentCount: number(row.installmentCount) || number(header?.installmentsNumber),
        originalAmount: number(row.originalAmount) || number(header?.totalInvoiceAmount),
        ...base,
        status: titleStatus(base, header?.status),
        integratedAt: text(row.integratedAt)
      };
    });

    headers.forEach((header, headerKey) => {
      const [tenant, rawBillId] = headerKey.split(":");
      const billId = number(rawBillId);
      const base = { openAmount: 0, overdueAmount: 0 };
      items.push({
        key: `payable:${tenant}:${billId}`,
        direction: "payable",
        tenant,
        billId,
        companyId: optionalNumber(header.debtorId),
        companyName: header.debtorId ? `Empresa #${header.debtorId}` : "Empresa não informada",
        partyId: optionalNumber(header.creditorId),
        partyName: header.creditorId ? `Credor #${header.creditorId}` : "Credor não informado",
        documentIdentificationId: text(header.documentIdentificationId),
        documentIdentificationName: "",
        documentNumber: text(header.documentNumber),
        originId: text(header.originId),
        observation: text(header.notes) || text(dumpObservations.get(billId)),
        issueDate: text(header.issueDate),
        firstDueDate: "",
        lastDueDate: "",
        installmentCount: number(header.installmentsNumber),
        originalAmount: number(header.totalInvoiceAmount),
        ...base,
        status: "unavailable",
        integratedAt: ""
      });
    });
    return items;
  } finally {
    database.close();
  }
}

function loadReceivables(warnings: string[]) {
  const database = openDatabase(databasePaths.receivable);
  if (!database) {
    warnings.push("Contas a receber ainda não foram atualizadas em Configurações.");
    return [];
  }

  try {
    if (!tableExists(database, "bulk_income_installments")) {
      warnings.push("A carga local de contas a receber ainda não possui parcelas.");
      return [];
    }
    const rows = database.prepare(`
      SELECT
        tenant,
        billId,
        MIN(companyId) AS companyId,
        MIN(companyName) AS companyName,
        MIN(clientId) AS partyId,
        MIN(clientName) AS partyName,
        MIN(documentIdentificationId) AS documentIdentificationId,
        MIN(documentIdentificationName) AS documentIdentificationName,
        MIN(documentNumber) AS documentNumber,
        MIN(originId) AS originId,
        MIN(issueDate) AS issueDate,
        MIN(dueDate) AS firstDueDate,
        MAX(dueDate) AS lastDueDate,
        COUNT(*) AS installmentCount,
        SUM(COALESCE(originalAmount, 0)) AS originalAmount,
        SUM(COALESCE(correctedBalanceAmount, balanceAmount, originalAmount, 0)) AS openAmount,
        SUM(CASE WHEN dueDate < date('now', 'localtime') THEN COALESCE(correctedBalanceAmount, balanceAmount, originalAmount, 0) ELSE 0 END) AS overdueAmount,
        MAX(saved_at) AS integratedAt
      FROM bulk_income_installments
      GROUP BY tenant, billId
    `).all() as Row[];

    return rows.map((row): FinancialTitle => {
      const tenant = text(row.tenant);
      const billId = number(row.billId);
      const base = {
        openAmount: number(row.openAmount),
        overdueAmount: number(row.overdueAmount)
      };
      return {
        key: `receivable:${tenant}:${billId}`,
        direction: "receivable",
        tenant,
        billId,
        companyId: optionalNumber(row.companyId),
        companyName: text(row.companyName) || (row.companyId ? `Empresa #${row.companyId}` : "Empresa não informada"),
        partyId: optionalNumber(row.partyId),
        partyName: text(row.partyName) || (row.partyId ? `Cliente #${row.partyId}` : "Cliente não informado"),
        documentIdentificationId: text(row.documentIdentificationId),
        documentIdentificationName: text(row.documentIdentificationName),
        documentNumber: text(row.documentNumber),
        originId: text(row.originId),
        observation: "",
        issueDate: text(row.issueDate),
        firstDueDate: text(row.firstDueDate),
        lastDueDate: text(row.lastDueDate),
        installmentCount: number(row.installmentCount),
        originalAmount: number(row.originalAmount),
        ...base,
        status: titleStatus(base),
        integratedAt: text(row.integratedAt)
      };
    });
  } finally {
    database.close();
  }
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function enumValue<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback;
}

export function titleFiltersFromParams(params: Record<string, string | string[] | undefined>): TitleSearchFilters {
  return {
    q: one(params.q).trim().slice(0, 160),
    direction: enumValue(one(params.tipo), ["all", "payable", "receivable"] as const, "all"),
    status: enumValue(one(params.situacao), ["all", "overdue", "open", "settled", "inclusion", "incomplete", "unavailable"] as const, "all"),
    company: one(params.empresa).trim().slice(0, 80),
    origin: one(params.origem).trim().slice(0, 40),
    observation: enumValue(one(params.observacao), ["all", "with", "without"] as const, "all"),
    dateType: enumValue(one(params.data), ["issue", "due"] as const, "due"),
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(one(params.inicio)) ? one(params.inicio) : "",
    endDate: /^\d{4}-\d{2}-\d{2}$/.test(one(params.fim)) ? one(params.fim) : "",
    sort: enumValue(one(params.ordem), ["newest", "due", "highest", "title"] as const, "newest"),
    page: Math.max(1, Number.parseInt(one(params.pagina), 10) || 1)
  };
}

function matchesSearch(item: FinancialTitle, rawQuery: string) {
  if (!rawQuery) return true;
  const exactBill = rawQuery.match(/^#\s*(\d+)$/);
  if (exactBill) return item.billId === Number(exactBill[1]);
  const query = normalize(rawQuery);
  return [
    item.billId,
    item.documentIdentificationId,
    item.documentIdentificationName,
    item.documentNumber,
    item.companyId,
    item.companyName,
    item.partyId,
    item.partyName,
    item.originId,
    item.observation
  ].some((value) => normalize(value).includes(query));
}

function compareTitles(sort: TitleSearchFilters["sort"]) {
  if (sort === "due") return (left: FinancialTitle, right: FinancialTitle) => (left.firstDueDate || "9999").localeCompare(right.firstDueDate || "9999") || right.billId - left.billId;
  if (sort === "highest") return (left: FinancialTitle, right: FinancialTitle) => right.openAmount - left.openAmount || right.billId - left.billId;
  if (sort === "title") return (left: FinancialTitle, right: FinancialTitle) => right.billId - left.billId || left.direction.localeCompare(right.direction);
  return (left: FinancialTitle, right: FinancialTitle) => (right.issueDate || "").localeCompare(left.issueDate || "") || right.billId - left.billId;
}

export function loadFinancialTitles(filters: TitleSearchFilters): FinancialTitlesResult {
  const warnings: string[] = [];
  const allItems = [...loadPayables(warnings), ...loadReceivables(warnings)];
  const companyMap = new Map<string, string>();
  const originSet = new Set<string>();
  allItems.forEach((item) => {
    if (item.companyId) companyMap.set(String(item.companyId), item.companyName);
    if (item.originId) originSet.add(item.originId);
  });

  const filtered = allItems.filter((item) => {
    const selectedDate = filters.dateType === "issue" ? item.issueDate : item.firstDueDate;
    return matchesSearch(item, filters.q)
      && (filters.direction === "all" || item.direction === filters.direction)
      && (filters.status === "all" || item.status === filters.status)
      && (!filters.company || String(item.companyId || "") === filters.company)
      && (!filters.origin || item.originId === filters.origin)
      && (filters.observation === "all" || (filters.observation === "with" ? Boolean(item.observation) : !item.observation))
      && (!filters.startDate || Boolean(selectedDate) && selectedDate >= filters.startDate)
      && (!filters.endDate || Boolean(selectedDate) && selectedDate <= filters.endDate);
  }).sort(compareTitles(filters.sort));

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    totalItems: filtered.length,
    totalPages,
    page,
    pageSize,
    openAmount: filtered.reduce((sum, item) => sum + item.openAmount, 0),
    overdueAmount: filtered.reduce((sum, item) => sum + item.overdueAmount, 0),
    withObservation: filtered.filter((item) => Boolean(item.observation)).length,
    companies: Array.from(companyMap, ([id, label]) => ({ id, label })).sort((left, right) => left.label.localeCompare(right.label, "pt-BR")),
    origins: Array.from(originSet).sort((left, right) => left.localeCompare(right, "pt-BR")),
    filters: { ...filters, page },
    warnings
  };
}
