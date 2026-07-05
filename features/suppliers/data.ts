import "server-only";
import { existsSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { credoresApi, type SiengeListFilters } from "@/lib/api/financeiro";

type JsonRecord = Record<string, unknown>;

export type SupplierDirectoryItem = {
  id: number;
  name: string;
  tradeName?: string;
  document?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  active?: boolean;
  source: "creditors" | "payables";
};

type SupplierDirectoryResult = {
  suppliers: SupplierDirectoryItem[];
  total: number;
  warning?: string;
};

const dataDir = path.join(process.cwd(), ".sienge-data");
const creditorsDatabasePath = path.join(dataDir, "parties-creditors.sqlite");
const payablesDatabasePath = path.join(dataDir, "finance-payables.sqlite");

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function documentFrom(record: JsonRecord) {
  return asText(record.cnpj)
    || asText(record.cpf)
    || asText(record.document)
    || asText(record.documentNumber)
    || asText(record.taxId)
    || undefined;
}

function emailFrom(record: JsonRecord) {
  return asText(record.email)
    || asText(record.emailAddress)
    || asText(record.mail)
    || asText(record.contactEmail)
    || asText(record.mainEmail)
    || undefined;
}

function phoneFrom(record: JsonRecord) {
  return asText(record.phone)
    || asText(record.phoneNumber)
    || asText(record.telephone)
    || asText(record.telephoneNumber)
    || asText(record.mobilePhone)
    || asText(record.cellPhone)
    || asText(record.contactPhone)
    || undefined;
}

function nameFrom(record: JsonRecord) {
  return asText(record.name)
    || asText(record.corporateName)
    || asText(record.companyName)
    || asText(record.creditorName)
    || asText(record.tradeName)
    || "Fornecedor sem nome";
}

function supplierFromCreditor(record: JsonRecord): SupplierDirectoryItem | undefined {
  const id = asNumber(record.id) || asNumber(record.creditorId);
  if (!id) return undefined;

  return {
    id,
    name: nameFrom(record),
    tradeName: asText(record.tradeName) || asText(record.fantasyName) || undefined,
    document: documentFrom(record),
    email: emailFrom(record),
    phone: phoneFrom(record),
    city: asText(record.city) || undefined,
    state: asText(record.state) || asText(record.uf) || undefined,
    active: typeof record.active === "boolean" ? record.active : undefined,
    source: "creditors"
  };
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchesSearch(supplier: SupplierDirectoryItem, search: string) {
  const normalized = normalizeText(search);
  const text = normalizeText([
    supplier.id,
    supplier.name,
    supplier.tradeName,
    supplier.document,
    supplier.city,
    supplier.state
  ].filter(Boolean).join(" "));
  return text.includes(normalized);
}

function readCreditors() {
  if (!existsSync(creditorsDatabasePath)) return [];
  const database = new DatabaseSync(creditorsDatabasePath);
  try {
    const table = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sienge_records'").get();
    if (!table) return [];
    const rows = database.prepare(`
      SELECT raw_json
      FROM sienge_records
      WHERE endpoint LIKE '/v1/creditors%'
      ORDER BY saved_at DESC
    `).all() as Array<{ raw_json: string }>;

    return rows
      .map((row) => {
        try {
          return supplierFromCreditor(JSON.parse(row.raw_json) as JsonRecord);
        } catch {
          return undefined;
        }
      })
      .filter((item): item is SupplierDirectoryItem => Boolean(item));
  } finally {
    database.close();
  }
}

function readPayableSuppliers() {
  if (!existsSync(payablesDatabasePath)) return [];
  const database = new DatabaseSync(payablesDatabasePath);
  try {
    const table = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'bulk_outcome_installments'").get();
    if (!table) return [];
    const rows = database.prepare(`
      SELECT creditorId AS id, creditorName AS name, MAX(saved_at) AS savedAt
      FROM bulk_outcome_installments
      WHERE creditorId IS NOT NULL
      GROUP BY creditorId, creditorName
      ORDER BY savedAt DESC
    `).all() as Array<{ id?: number; name?: string }>;

    return rows
      .map<SupplierDirectoryItem | undefined>((row) => {
        const id = asNumber(row.id);
        if (!id) return undefined;
        return {
          id,
          name: asText(row.name) || `Fornecedor #${id}`,
          source: "payables" as const
        };
      })
      .filter((item): item is SupplierDirectoryItem => Boolean(item));
  } finally {
    database.close();
  }
}

function dedupeSuppliers(items: SupplierDirectoryItem[]) {
  const byId = new Map<number, SupplierDirectoryItem>();
  items.forEach((item) => {
    const current = byId.get(item.id);
    if (!current || current.source === "payables") byId.set(item.id, item);
  });
  return Array.from(byId.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export function searchLocalSuppliers(search = "", limit = 20): SupplierDirectoryResult {
  const merged = dedupeSuppliers([...readCreditors(), ...readPayableSuppliers()]);
  const filtered = search.trim() ? merged.filter((supplier) => matchesSearch(supplier, search.trim())) : merged;
  return {
    suppliers: filtered.slice(0, limit),
    total: filtered.length,
    warning: merged.length ? undefined : "Nenhum fornecedor foi encontrado na base local. Atualize Fornecedores em Configurações."
  };
}

export function getLocalSupplierById(id: number) {
  if (!Number.isFinite(id) || id <= 0) return undefined;
  return dedupeSuppliers([...readCreditors(), ...readPayableSuppliers()]).find((supplier) => supplier.id === id);
}

export async function refreshSupplierDirectory(forceRefresh = false) {
  const limit = 200;
  let offset = 0;
  let total = 0;
  let loaded = 0;

  do {
    const filters: SiengeListFilters = { limit, offset };
    const page = await credoresApi.list<JsonRecord>(filters, forceRefresh, true);
    const results = Array.isArray(page.results) ? page.results : [];
    loaded += results.length;
    total = page.resultSetMetadata?.count || loaded;
    offset += limit;
    if (!results.length) break;
  } while (loaded < total);

  return {
    suppliers: searchLocalSuppliers("", 1).total,
    imported: loaded,
    total
  };
}
