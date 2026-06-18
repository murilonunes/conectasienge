import "server-only";
import { createHash } from "crypto";
import { existsSync, mkdirSync } from "fs";
import { rm } from "fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { storeBulkResponse, storeGenericResponseRecords } from "./sienge-bulk-store";
import { annotateSiengeResponse } from "@/lib/integration-metadata";

type QueryValue = string | number | boolean | Array<string | number> | undefined;
export type SiengeRequestProgress = {
  stage: string;
  message: string;
  detail?: string;
  current?: number;
  total?: number;
  percent?: number;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  cache?: "daily" | "no-store" | "refresh";
  forceReplaceFinalized?: boolean;
  onProgress?: (progress: SiengeRequestProgress) => void;
};

export type SiengeErrorDetails = {
  status?: number;
  statusText?: string;
  method: string;
  endpoint: string;
  rateLimitType?: "BULK" | "REST";
  rateLimitDescription?: string;
  title: string;
  explanation: string;
  suggestion: string;
  apiMessage?: string;
  requestId?: string;
  occurredAt: string;
};

export class SiengeApiError extends Error {
  readonly details: SiengeErrorDetails;

  constructor(details: SiengeErrorDetails) {
    super(details.title);
    this.name = "SiengeApiError";
    this.details = details;
  }
}

export type SiengePage<T> = {
  results: T[];
  resultSetMetadata?: { count: number; offset: number; limit: number };
};

type DailyCacheEntry = {
  day: string;
  sourceDay?: string;
  value?: unknown;
  savedAt?: string;
  pending?: Promise<unknown>;
  error?: SiengeErrorDetails;
  errorExpiresAt?: number;
};

const dailyCache = new Map<string, DailyCacheEntry>();
let cacheRevision = 0;
const cacheDir = path.join(process.cwd(), ".sienge-data");
type SqliteResponsibility =
  | "cache"
  | "payables"
  | "receivables"
  | "reconciliation"
  | "inventory"
  | "purchases"
  | "sales"
  | "contracts"
  | "creditors"
  | "customers"
  | "misc";

const sqliteFiles: Record<SqliteResponsibility, string> = {
  cache: "00-cache.sqlite",
  payables: "finance-payables.sqlite",
  receivables: "finance-receivables.sqlite",
  reconciliation: "finance-reconciliation.sqlite",
  inventory: "inventory-assets.sqlite",
  purchases: "purchases.sqlite",
  sales: "commercial-sales.sqlite",
  contracts: "contracts-supply.sqlite",
  creditors: "parties-creditors.sqlite",
  customers: "parties-customers.sqlite",
  misc: "miscellaneous.sqlite"
};

const sqliteConnections = new Map<SqliteResponsibility, DatabaseSync>();
let legacyCacheMigrationDone = false;
let currentCacheMigrationDone = false;

export function getSiengeCacheRevision() {
  return cacheRevision;
}

export function invalidateSiengeCache() {
  dailyCache.clear();
  cacheRevision += 1;
  sqliteConnections.forEach((database) => database.close());
  sqliteConnections.clear();
  void rm(cacheDir, { recursive: true, force: true });
}

function currentDay() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function cacheKey(tenant: string, path: string, query: Record<string, QueryValue>) {
  const normalizedQuery = Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `${tenant}:${path}:${JSON.stringify(normalizedQuery)}`;
}

function cacheFilePath(key: string) {
  const hash = createHash("sha256").update(key).digest("hex");
  return hash;
}

function parseCacheKey(key: string) {
  const firstSeparator = key.indexOf(":");
  const secondSeparator = key.indexOf(":", firstSeparator + 1);
  return {
    tenant: key.slice(0, firstSeparator),
    endpoint: key.slice(firstSeparator + 1, secondSeparator),
    queryJson: key.slice(secondSeparator + 1)
  };
}

function sqliteResponsibilityForEndpoint(endpoint: string): SqliteResponsibility {
  if (endpoint === "/bulk-data/v1/outcome" || endpoint.startsWith("/v1/bills")) return "payables";
  if (endpoint === "/bulk-data/v1/income" || endpoint.startsWith("/v1/accounts-receivable")) return "receivables";
  if (endpoint === "/bulk-data/v1/bank-movement" || endpoint.startsWith("/v1/accounts-statements")) return "reconciliation";
  if (endpoint.startsWith("/v1/units") || endpoint.startsWith("/v1/patrimony")) return "inventory";
  if (endpoint.startsWith("/v1/purchase-") || endpoint === "/bulk-data/v1/purchase-quotations") return "purchases";
  if (endpoint.startsWith("/v1/sales-contracts")) return "sales";
  if (endpoint.startsWith("/v1/supply-contracts")) return "contracts";
  if (endpoint.startsWith("/v1/creditors")) return "creditors";
  if (endpoint.startsWith("/v1/customers") || endpoint.startsWith("/bulk-data/v1/customer")) return "customers";
  return "misc";
}

function getSqlite(responsibility: SqliteResponsibility) {
  const existing = sqliteConnections.get(responsibility);
  if (existing) return existing;
  mkdirSync(cacheDir, { recursive: true });
  const database = new DatabaseSync(path.join(cacheDir, sqliteFiles[responsibility]));
  sqliteConnections.set(responsibility, database);
  return database;
}

function getCacheSqlite() {
  const database = getSqlite("cache");
  database.exec(`
    CREATE TABLE IF NOT EXISTS sienge_response_cache (
      cache_key TEXT PRIMARY KEY,
      cache_hash TEXT NOT NULL,
      tenant TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      query_json TEXT NOT NULL,
      method TEXT NOT NULL,
      day TEXT NOT NULL,
      response_json TEXT,
      error_json TEXT,
      error_expires_at INTEGER,
      saved_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sienge_response_cache_day ON sienge_response_cache(day);
    CREATE INDEX IF NOT EXISTS idx_sienge_response_cache_endpoint ON sienge_response_cache(endpoint);
    CREATE TABLE IF NOT EXISTS sienge_response_cache_versions (
      cache_key TEXT NOT NULL,
      cache_hash TEXT NOT NULL,
      tenant TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      query_json TEXT NOT NULL,
      method TEXT NOT NULL,
      day TEXT NOT NULL,
      response_json TEXT,
      error_json TEXT,
      error_expires_at INTEGER,
      saved_at TEXT NOT NULL,
      PRIMARY KEY (cache_key, day)
    );
    CREATE INDEX IF NOT EXISTS idx_sienge_response_cache_versions_day ON sienge_response_cache_versions(day);
    CREATE INDEX IF NOT EXISTS idx_sienge_response_cache_versions_endpoint ON sienge_response_cache_versions(endpoint);
    CREATE INDEX IF NOT EXISTS idx_sienge_response_cache_versions_key_saved ON sienge_response_cache_versions(cache_key, saved_at);
    CREATE TABLE IF NOT EXISTS sienge_update_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      responsibility TEXT NOT NULL,
      day TEXT NOT NULL,
      status TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      query_json TEXT NOT NULL,
      summary TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sienge_update_history_endpoint ON sienge_update_history(endpoint);
    CREATE INDEX IF NOT EXISTS idx_sienge_update_history_saved_at ON sienge_update_history(saved_at);
  `);
  migrateCurrentCacheToVersions(database);
  migrateLegacyCache(database);
  return database;
}

function insertCacheVersion(database: DatabaseSync, row: Record<string, unknown>) {
  database.prepare(`
    INSERT OR IGNORE INTO sienge_response_cache_versions (
      cache_key, cache_hash, tenant, endpoint, query_json, method, day,
      response_json, error_json, error_expires_at, saved_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row.cache_key,
    row.cache_hash,
    row.tenant,
    row.endpoint,
    row.query_json,
    row.method,
    row.day,
    row.response_json,
    row.error_json,
    row.error_expires_at,
    row.saved_at
  );
}

function migrateCurrentCacheToVersions(cacheDatabase: DatabaseSync) {
  if (currentCacheMigrationDone) return;
  currentCacheMigrationDone = true;
  const alreadyMigrated = cacheDatabase
    .prepare("SELECT 1 FROM sienge_response_cache_versions LIMIT 1")
    .get();
  if (alreadyMigrated) return;
  cacheDatabase.exec(`
    INSERT OR IGNORE INTO sienge_response_cache_versions (
      cache_key, cache_hash, tenant, endpoint, query_json, method, day,
      response_json, error_json, error_expires_at, saved_at
    )
    SELECT cache_key, cache_hash, tenant, endpoint, query_json, method, day,
           response_json, error_json, error_expires_at, saved_at
    FROM sienge_response_cache;
  `);
}

function migrateLegacyCache(cacheDatabase: DatabaseSync) {
  if (legacyCacheMigrationDone) return;
  legacyCacheMigrationDone = true;
  const legacyPath = path.join(cacheDir, "sienge.sqlite");
  if (!existsSync(legacyPath)) return;
  const legacyDatabase = new DatabaseSync(legacyPath);
  try {
    const rows = legacyDatabase.prepare(`
      SELECT cache_key, cache_hash, tenant, endpoint, query_json, method, day,
             response_json, error_json, error_expires_at, saved_at
      FROM sienge_response_cache
    `).all() as Array<Record<string, unknown>>;
    const insert = cacheDatabase.prepare(`
      INSERT OR IGNORE INTO sienge_response_cache (
        cache_key, cache_hash, tenant, endpoint, query_json, method, day,
        response_json, error_json, error_expires_at, saved_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    cacheDatabase.exec("BEGIN");
    try {
      rows.forEach((row) => {
        insert.run(
          row.cache_key,
          row.cache_hash,
          row.tenant,
          row.endpoint,
          row.query_json,
          row.method,
          row.day,
          row.response_json,
          row.error_json,
          row.error_expires_at,
          row.saved_at
        );
        insertCacheVersion(cacheDatabase, row);
      });
      cacheDatabase.exec("COMMIT");
    } catch (error) {
      cacheDatabase.exec("ROLLBACK");
      throw error;
    }
  } catch {
    // If the legacy file is not from the old layout, leave it untouched and continue with the new files.
  } finally {
    legacyDatabase.close();
  }
}

type SqliteCacheRow = {
  cache_key?: string | null;
  tenant?: string | null;
  endpoint?: string | null;
  query_json?: string | null;
  day?: string | null;
  response_json?: string | null;
  error_json?: string | null;
  error_expires_at?: number | null;
  saved_at?: string | null;
};

type MirrorRow = SqliteCacheRow & {
  item_count?: number | null;
};

function responseItemCount(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== "object") return undefined;
  const record = value as { results?: unknown[]; data?: unknown[] };
  if (Array.isArray(record.results)) return record.results.length;
  if (Array.isArray(record.data)) return record.data.length;
  return undefined;
}

function isEmptySiengeResponse(value: unknown) {
  const count = responseItemCount(value);
  return count === 0;
}

function responseItems(value: unknown) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const record = value as { results?: unknown[]; data?: unknown[] };
  if (Array.isArray(record.results)) return record.results;
  if (Array.isArray(record.data)) return record.data;
  return [];
}

function recordIdentifier(item: unknown) {
  if (!item || typeof item !== "object") return undefined;
  const record = item as Record<string, unknown>;
  const keys = [
    "id",
    "bankMovementId",
    "billId",
    "installmentId",
    "receivableBillId",
    "contractId",
    "patrimonyId",
    "purchaseOrderId",
    "purchaseRequestId",
    "purchaseQuotationId",
    "sequentialNumber",
    "sequencialNumber",
    "itemNumber",
    "creditorId",
    "customerId",
    "enterpriseId",
    "buildingId",
    "buildingUnitId"
  ];
  const parts = keys
    .filter((keyName) => record[keyName] !== undefined && record[keyName] !== null)
    .map((keyName) => `${keyName}:${String(record[keyName])}`);
  return parts.length ? parts.join("|") : undefined;
}

function isFinalizedRecord(item: unknown) {
  if (!item || typeof item !== "object") return false;
  const record = item as Record<string, unknown>;
  const statusText = [
    record.status,
    record.situation,
    record.situationName,
    record.installmentSituation,
    record.paymentSituation,
    record.defaulterSituation,
    record.operationTypeName
  ]
    .filter((value) => value !== undefined && value !== null)
    .join(" ");
  if (/baixad|pago|paga|paid|liquidad|quitad|recebid|finaliz|cancelad|distrat|closed|conclu/i.test(statusText)) return true;
  if (record.paymentDate || record.settlementDate || record.cancellationDate) return true;

  const balances = [record.balanceAmount, record.correctedBalanceAmount, record.outstandingBalance]
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const hasMovement = Array.isArray(record.payments) && record.payments.length > 0
    || Array.isArray(record.receipts) && record.receipts.length > 0
    || Array.isArray(record.bankMovements) && record.bankMovements.length > 0;
  return hasMovement && balances.length > 0 && balances.every((value) => Math.abs(value) < 0.01);
}

function mergePreservingFinalized<T>(previousValue: unknown, nextValue: T, forceReplace: boolean): T {
  if (forceReplace || !previousValue || typeof previousValue !== "object" || !nextValue || typeof nextValue !== "object") return nextValue;

  const previousItems = responseItems(previousValue);
  const nextItems = responseItems(nextValue);
  if (!previousItems.length || !nextItems.length) {
    return isFinalizedRecord(previousValue) ? previousValue as T : nextValue;
  }

  const finalizedByKey = new Map<string, unknown>();
  previousItems.forEach((item) => {
    const key = recordIdentifier(item);
    if (key && isFinalizedRecord(item)) finalizedByKey.set(key, item);
  });
  if (!finalizedByKey.size) return nextValue;

  const mergedItems = nextItems.map((item) => {
    const key = recordIdentifier(item);
    return key && finalizedByKey.has(key) ? finalizedByKey.get(key) : item;
  });

  if (Array.isArray(nextValue)) return mergedItems as T;
  const response = nextValue as Record<string, unknown>;
  if (Array.isArray(response.results)) return { ...response, results: mergedItems } as T;
  if (Array.isArray(response.data)) return { ...response, data: mergedItems } as T;
  return nextValue;
}

function createMirrorTables(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS sienge_api_mirror (
      cache_key TEXT PRIMARY KEY,
      cache_hash TEXT NOT NULL,
      tenant TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      query_json TEXT NOT NULL,
      method TEXT NOT NULL,
      source_day TEXT NOT NULL,
      response_json TEXT,
      error_json TEXT,
      error_expires_at INTEGER,
      saved_at TEXT NOT NULL,
      item_count INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_sienge_api_mirror_endpoint ON sienge_api_mirror(endpoint);
    CREATE INDEX IF NOT EXISTS idx_sienge_api_mirror_saved_at ON sienge_api_mirror(saved_at);
    CREATE TABLE IF NOT EXISTS sienge_api_mirror_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cache_key TEXT NOT NULL,
      tenant TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      query_json TEXT NOT NULL,
      method TEXT NOT NULL,
      source_day TEXT NOT NULL,
      status TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      item_count INTEGER,
      summary TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sienge_api_mirror_history_endpoint ON sienge_api_mirror_history(endpoint);
    CREATE INDEX IF NOT EXISTS idx_sienge_api_mirror_history_saved_at ON sienge_api_mirror_history(saved_at);
  `);
}

function getMirrorSqlite(endpoint: string) {
  const database = getSqlite(sqliteResponsibilityForEndpoint(endpoint));
  createMirrorTables(database);
  return database;
}

const volatileQueryKeys = new Set(["startDate", "endDate", "correctionDate"]);

function queryEntries(queryJson?: string | null) {
  if (!queryJson) return new Map<string, unknown>();
  try {
    const entries = JSON.parse(queryJson) as Array<[string, unknown]>;
    return new Map(entries);
  } catch {
    return new Map<string, unknown>();
  }
}

function queriesCompatible(currentQueryJson: string, candidateQueryJson?: string | null) {
  const current = queryEntries(currentQueryJson);
  const candidate = queryEntries(candidateQueryJson);
  for (const [key, value] of Array.from(current.entries())) {
    if (volatileQueryKeys.has(key)) continue;
    if (JSON.stringify(candidate.get(key)) !== JSON.stringify(value)) return false;
  }
  for (const [key, value] of Array.from(candidate.entries())) {
    if (volatileQueryKeys.has(key)) continue;
    if (JSON.stringify(current.get(key)) !== JSON.stringify(value)) return false;
  }
  return true;
}

function cacheEntryFromRow(row: SqliteCacheRow): DailyCacheEntry {
  return {
    day: row.day || currentDay(),
    sourceDay: row.day || undefined,
    value: row.response_json ? JSON.parse(row.response_json) : undefined,
    savedAt: row.saved_at ?? undefined,
    error: row.error_json ? JSON.parse(row.error_json) : undefined,
    errorExpiresAt: row.error_expires_at ?? undefined
  };
}

function mirrorEntryFromRow(row: MirrorRow): DailyCacheEntry {
  return {
    day: row.day || currentDay(),
    sourceDay: row.day || undefined,
    value: row.response_json ? JSON.parse(row.response_json) : undefined,
    savedAt: row.saved_at ?? undefined,
    error: row.error_json ? JSON.parse(row.error_json) : undefined,
    errorExpiresAt: row.error_expires_at ?? undefined
  };
}

function readLocalMirror<T>(key: string, onProgress?: RequestOptions["onProgress"], requireNonEmpty = false) {
  const parsed = parseCacheKey(key);
  const database = getMirrorSqlite(parsed.endpoint);
  onProgress?.({
    stage: "local-mirror-read",
    message: "Lendo dados já salvos.",
    detail: `${sqliteFiles[sqliteResponsibilityForEndpoint(parsed.endpoint)]} - ${parsed.endpoint}`
  });

  const exactRows = database.prepare(`
    SELECT source_day AS day, response_json, error_json, error_expires_at, saved_at, query_json, item_count
    FROM sienge_api_mirror
    WHERE cache_key = ? AND response_json IS NOT NULL
    ORDER BY saved_at DESC
    LIMIT 5
  `).all(key) as MirrorRow[];

  const compatibleRows = exactRows.length ? [] : (database.prepare(`
    SELECT source_day AS day, response_json, error_json, error_expires_at, saved_at, query_json, item_count
    FROM sienge_api_mirror
    WHERE tenant = ? AND endpoint = ? AND response_json IS NOT NULL
    ORDER BY saved_at DESC
    LIMIT 200
  `).all(parsed.tenant, parsed.endpoint) as MirrorRow[])
    .filter((row) => queriesCompatible(parsed.queryJson, row.query_json));

  const rows = exactRows.length ? exactRows : compatibleRows;
  for (const row of rows) {
    const entry = mirrorEntryFromRow(row);
    if (entry.value === undefined) continue;
    if (requireNonEmpty && isEmptySiengeResponse(entry.value)) continue;
    onProgress?.({
      stage: "local-mirror-hit",
      message: "Dados salvos encontrados.",
      detail: `${entry.sourceDay || entry.day} - ${entry.savedAt || "sem horário"}`
    });
    writeStructuredTables(key, entry.sourceDay || entry.day, entry.value, onProgress, entry.savedAt);
    return annotateSiengeResponse(entry.value as T, entry.sourceDay || entry.day, entry.savedAt || new Date().toISOString());
  }
  return undefined;
}

function writeLocalMirror<T>(key: string, entry: DailyCacheEntry, onProgress?: RequestOptions["onProgress"], forceReplace = false) {
  const parsed = parseCacheKey(key);
  const database = getMirrorSqlite(parsed.endpoint);
  const savedAt = entry.savedAt || new Date().toISOString();
  const previous = readLocalMirror<T>(key, undefined, false);
  const value = entry.value !== undefined
    ? mergePreservingFinalized(previous, entry.value as T, forceReplace)
    : undefined;
  const itemCount = value !== undefined ? responseItemCount(value) ?? null : null;

  onProgress?.({
    stage: "local-mirror-write",
    message: "Atualizando dados salvos.",
    detail: `${sqliteFiles[sqliteResponsibilityForEndpoint(parsed.endpoint)]} - ${parsed.endpoint}`
  });

  database.prepare(`
    INSERT INTO sienge_api_mirror (
      cache_key, cache_hash, tenant, endpoint, query_json, method, source_day,
      response_json, error_json, error_expires_at, saved_at, item_count
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET
      cache_hash = excluded.cache_hash,
      tenant = excluded.tenant,
      endpoint = excluded.endpoint,
      query_json = excluded.query_json,
      method = excluded.method,
      source_day = excluded.source_day,
      response_json = excluded.response_json,
      error_json = excluded.error_json,
      error_expires_at = excluded.error_expires_at,
      saved_at = excluded.saved_at,
      item_count = excluded.item_count
  `).run(
    key,
    cacheFilePath(key),
    parsed.tenant,
    parsed.endpoint,
    parsed.queryJson,
    "GET",
    entry.day,
    value !== undefined ? JSON.stringify(value) : null,
    entry.error ? JSON.stringify(entry.error) : null,
    entry.errorExpiresAt ?? null,
    savedAt,
    itemCount
  );

  database.prepare(`
    INSERT INTO sienge_api_mirror_history (
      cache_key, tenant, endpoint, query_json, method, source_day, status, saved_at, item_count, summary
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    key,
    parsed.tenant,
    parsed.endpoint,
    parsed.queryJson,
    "GET",
    entry.day,
    entry.error ? "error" : "success",
    savedAt,
    itemCount,
    entry.error ? entry.error.title : "Dados integrados"
  );

  return value;
}

function readLatestSqliteCache<T>(key: string, onProgress?: RequestOptions["onProgress"], requireNonEmpty = false) {
  const parsed = parseCacheKey(key);
  onProgress?.({
    stage: "sqlite-cache-latest-read",
    message: "Procurando o último dado salvo.",
    detail: "Usado quando o Sienge não responde ou quando ainda não há dados atualizados do dia."
  });
  const rows = getCacheSqlite()
    .prepare(`
      SELECT day, response_json, error_json, error_expires_at, saved_at
      FROM sienge_response_cache_versions
      WHERE cache_key = ? AND response_json IS NOT NULL
      ORDER BY saved_at DESC
      LIMIT 30
    `)
    .all(key) as SqliteCacheRow[];

  const endpointRows = rows.length ? [] : (getCacheSqlite()
    .prepare(`
      SELECT day, response_json, error_json, error_expires_at, saved_at, query_json
      FROM sienge_response_cache_versions
      WHERE tenant = ? AND endpoint = ? AND response_json IS NOT NULL
      ORDER BY saved_at DESC
      LIMIT 200
    `)
    .all(parsed.tenant, parsed.endpoint) as SqliteCacheRow[])
    .filter((row) => queriesCompatible(parsed.queryJson, row.query_json));

  const legacyEndpointRows = endpointRows.length || rows.length ? [] : (getCacheSqlite()
    .prepare(`
      SELECT day, response_json, error_json, error_expires_at, saved_at, query_json
      FROM sienge_response_cache
      WHERE endpoint = ? AND response_json IS NOT NULL
      ORDER BY saved_at DESC
      LIMIT 200
    `)
    .all(parsed.endpoint) as SqliteCacheRow[])
    .filter((row) => queriesCompatible(parsed.queryJson, row.query_json));

  const fallbackRows = rows.length ? rows : endpointRows.length ? endpointRows : legacyEndpointRows;

  for (const row of fallbackRows) {
    const cached = cacheEntryFromRow(row);
    if (cached.value === undefined) continue;
    if (requireNonEmpty && isEmptySiengeResponse(cached.value)) continue;
    onProgress?.({
      stage: "sqlite-cache-latest-hit",
      message: "Último dado salvo encontrado.",
      detail: `${cached.sourceDay || cached.day} - ${cached.savedAt || "sem horário"}`
    });
    writeStructuredTables(key, cached.sourceDay || cached.day, cached.value, onProgress, cached.savedAt);
    return annotateSiengeResponse(cached.value as T, cached.sourceDay || cached.day, cached.savedAt || new Date().toISOString());
  }
  return undefined;
}

function readSqliteCache<T>(key: string, day: string, onProgress?: RequestOptions["onProgress"]) {
  onProgress?.({
    stage: "sqlite-cache-read",
    message: "Lendo dados já salvos.",
    detail: `${sqliteFiles.cache} - consulta salva`
  });
  const row = getCacheSqlite()
    .prepare(`
      SELECT day, response_json, error_json, error_expires_at, saved_at
      FROM sienge_response_cache_versions
      WHERE cache_key = ? AND day = ?
    `)
    .get(key, day) as SqliteCacheRow | undefined
    || getCacheSqlite()
      .prepare("SELECT day, response_json, error_json, error_expires_at, saved_at FROM sienge_response_cache WHERE cache_key = ? AND day = ?")
      .get(key, day) as SqliteCacheRow | undefined;

  if (!row) return undefined;
  onProgress?.({
    stage: "sqlite-cache-hit",
    message: "Dados salvos encontrados.",
    detail: "Reaproveitando a última integração para esta consulta e este dia."
  });
  const cached = cacheEntryFromRow(row);

  dailyCache.set(key, cached);
  if (cached.error && cached.errorExpiresAt && cached.errorExpiresAt > Date.now()) {
    throw new SiengeApiError(cached.error);
  }
  if (cached.value !== undefined) {
    if (isEmptySiengeResponse(cached.value)) {
      const latest = readLatestSqliteCache<T>(key, onProgress, true);
      if (latest !== undefined) return latest;
    }
    writeStructuredTables(key, cached.sourceDay || day, cached.value, onProgress, cached.savedAt);
    return annotateSiengeResponse(cached.value as T, cached.sourceDay || day, cached.savedAt || new Date().toISOString());
  }
  return undefined;
}

function writeSqliteCache(key: string, entry: DailyCacheEntry, onProgress?: RequestOptions["onProgress"]) {
  const parsed = parseCacheKey(key);
  const database = getCacheSqlite();
  const savedAt = entry.savedAt || new Date().toISOString();
  onProgress?.({
    stage: "sqlite-cache-write",
    message: "Salvando dados recebidos.",
    detail: `${sqliteFiles.cache} - ${parsed.endpoint}`
  });
  database.prepare(`
    INSERT INTO sienge_response_cache_versions (
      cache_key, cache_hash, tenant, endpoint, query_json, method, day,
      response_json, error_json, error_expires_at, saved_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cache_key, day) DO UPDATE SET
      cache_hash = excluded.cache_hash,
      tenant = excluded.tenant,
      endpoint = excluded.endpoint,
      query_json = excluded.query_json,
      method = excluded.method,
      response_json = excluded.response_json,
      error_json = excluded.error_json,
      error_expires_at = excluded.error_expires_at,
      saved_at = excluded.saved_at
  `).run(
    key,
    cacheFilePath(key),
    parsed.tenant,
    parsed.endpoint,
    parsed.queryJson,
    "GET",
    entry.day,
    entry.value !== undefined ? JSON.stringify(entry.value) : null,
    entry.error ? JSON.stringify(entry.error) : null,
    entry.errorExpiresAt ?? null,
    savedAt
  );
  database.prepare(`
    INSERT INTO sienge_response_cache (
      cache_key, cache_hash, tenant, endpoint, query_json, method, day,
      response_json, error_json, error_expires_at, saved_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(cache_key) DO UPDATE SET
      cache_hash = excluded.cache_hash,
      tenant = excluded.tenant,
      endpoint = excluded.endpoint,
      query_json = excluded.query_json,
      method = excluded.method,
      day = excluded.day,
      response_json = excluded.response_json,
      error_json = excluded.error_json,
      error_expires_at = excluded.error_expires_at,
      saved_at = excluded.saved_at
  `).run(
    key,
    cacheFilePath(key),
    parsed.tenant,
    parsed.endpoint,
    parsed.queryJson,
    "GET",
    entry.day,
    entry.value !== undefined ? JSON.stringify(entry.value) : null,
    entry.error ? JSON.stringify(entry.error) : null,
    entry.errorExpiresAt ?? null,
    savedAt
  );
  database.prepare(`
    INSERT INTO sienge_update_history (
      tenant, endpoint, responsibility, day, status, saved_at, query_json, summary
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    parsed.tenant,
    parsed.endpoint,
    sqliteResponsibilityForEndpoint(parsed.endpoint),
    entry.day,
    entry.error ? "error" : "success",
    savedAt,
    parsed.queryJson,
    entry.error ? entry.error.title : "Dados atualizados no Sienge"
  );
}

function writeStructuredTables(key: string, day: string, value: unknown, onProgress?: RequestOptions["onProgress"], savedAt = new Date().toISOString()) {
  const parsed = parseCacheKey(key);
  const responsibility = sqliteResponsibilityForEndpoint(parsed.endpoint);
  const database = getSqlite(responsibility);
  const context = {
    tenant: parsed.tenant,
    endpoint: parsed.endpoint,
    queryJson: parsed.queryJson,
    day,
    savedAt
  };
  onProgress?.({
    stage: "sqlite-records-write",
    message: "Organizando dados para as telas.",
    detail: `${sqliteFiles[responsibility]} - ${parsed.endpoint}`
  });
  storeGenericResponseRecords(database, context, value, onProgress);
  if (parsed.endpoint.startsWith("/bulk-data/")) {
    onProgress?.({
      stage: "sqlite-bulk-write",
      message: "Organizando tabelas detalhadas.",
      detail: `${sqliteFiles[responsibility]} - ${parsed.endpoint}`
    });
    storeBulkResponse(database, context, value, onProgress);
  }
}

const statusGuidance: Record<number, Pick<SiengeErrorDetails, "title" | "explanation" | "suggestion">> = {
  400: {
    title: "A consulta enviada ao Sienge é inválida",
    explanation: "O Sienge rejeitou um ou mais filtros ou parâmetros da consulta.",
    suggestion: "Confira o período informado e os campos obrigatórios da consulta."
  },
  401: {
    title: "O Sienge não reconheceu as credenciais",
    explanation: "O usuário, a senha ou o subdomínio não foram aceitos pelo Sienge.",
    suggestion: "Confira SIENGE_TENANT, SIENGE_USERNAME e SIENGE_PASSWORD no arquivo .env e reinicie o servidor."
  },
  403: {
    title: "A credencial não tem permissão para consultar este recurso",
    explanation: "O Sienge reconheceu a autenticação, mas bloqueou o acesso a esta consulta.",
    suggestion: "No Painel de Integrações do Sienge, libere esta área para esse usuário e confirme se o pacote contratado inclui o recurso."
  },
  404: {
    title: "Recurso não encontrado no Sienge",
    explanation: "O recurso ou ambiente configurado não foi encontrado.",
    suggestion: "Confira o SIENGE_TENANT e se o recurso está disponível nesse ambiente."
  },
  429: {
    title: "Limite de consultas do Sienge atingido",
    explanation: "O Sienge bloqueou temporariamente novas chamadas por excesso de requisições.",
    suggestion: "Aguarde alguns minutos e tente novamente."
  }
};

function safeApiMessage(value: unknown): string | undefined {
  if (!value) return undefined;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.replace(/basic\s+[a-z0-9+/=]+/gi, "Basic [removido]").slice(0, 1000);
}

function localDataMissingError(method: string, endpoint: string): SiengeApiError {
  return new SiengeApiError({
    method,
    endpoint,
    title: "Dados ainda não carregados",
    explanation: "Esta tela lê os dados já salvos para abrir rápido e evitar novas chamadas ao Sienge.",
    suggestion: "Abra Configurações e atualize essa área para gravar os dados.",
    occurredAt: new Date().toISOString()
  });
}

export async function siengeRequest<T>(path: string, query: Record<string, QueryValue> = {}, options: RequestOptions = {}): Promise<T> {
  const tenant = process.env.SIENGE_TENANT;
  const username = process.env.SIENGE_USERNAME;
  const password = process.env.SIENGE_PASSWORD;
  const method = options.method || "GET";
  const localOnlyRead = method === "GET" && options.cache !== "refresh" && options.cache !== "no-store";

  if (!tenant || (!localOnlyRead && (!username || !password))) {
    throw new SiengeApiError({
      method,
      endpoint: path,
      title: "Credenciais do Sienge não configuradas",
      explanation: "Uma ou mais variáveis obrigatórias estão ausentes.",
      suggestion: "Preencha SIENGE_TENANT, SIENGE_USERNAME e SIENGE_PASSWORD no arquivo frontend/.env.",
      occurredAt: new Date().toISOString()
    });
  }

  const url = new URL(`https://api.sienge.com.br/${tenant}/public/api${path}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, String(item)));
      return;
    }
    url.searchParams.set(key, String(value));
  });

  const useDailyCache = method === "GET" && options.cache !== "no-store";
  const readDailyCache = useDailyCache && options.cache !== "refresh";
  const day = currentDay();
  const key = cacheKey(tenant, path, query);

  if (localOnlyRead) {
    const mirrorValue = readLocalMirror<T>(key, options.onProgress, true);
    if (mirrorValue !== undefined) return mirrorValue;
    const migratedValue = readLatestSqliteCache<T>(key, options.onProgress, true);
    if (migratedValue !== undefined) {
      writeLocalMirror<T>(key, { day, value: migratedValue, savedAt: new Date().toISOString() }, options.onProgress, false);
      return migratedValue;
    }
    throw localDataMissingError(method, path);
  }

  const cached = readDailyCache ? dailyCache.get(key) : undefined;
  options.onProgress?.({
    stage: "memory-cache-read",
    message: "Verificando cache em memória do servidor.",
    detail: path
  });
  if (cached?.day === day) {
    if (cached.error && cached.errorExpiresAt && cached.errorExpiresAt > Date.now()) throw new SiengeApiError(cached.error);
    if (cached.pending) {
      const value = await cached.pending as T;
      const finished = dailyCache.get(key);
      if (isEmptySiengeResponse(value)) {
        const latest = readLatestSqliteCache<T>(key, options.onProgress, true);
        if (latest !== undefined) return latest;
      }
      return annotateSiengeResponse(value, finished?.sourceDay || day, finished?.savedAt || new Date().toISOString());
    }
    if (cached.value !== undefined) {
      options.onProgress?.({
        stage: "memory-cache-hit",
        message: "Resposta encontrada na memória desta execução.",
        detail: "Sincronizando dados para as telas."
      });
      if (isEmptySiengeResponse(cached.value)) {
        const latest = readLatestSqliteCache<T>(key, options.onProgress, true);
        if (latest !== undefined) return latest;
      }
      writeStructuredTables(key, cached.sourceDay || day, cached.value, options.onProgress, cached.savedAt);
    }
    return annotateSiengeResponse(cached.value as T, cached.sourceDay || day, cached.savedAt || new Date().toISOString());
  }
  if (cached) dailyCache.delete(key);
  if (readDailyCache) {
    const diskValue = readSqliteCache<T>(key, day, options.onProgress);
    if (diskValue !== undefined) return diskValue;
    const latestValue = readLatestSqliteCache<T>(key, options.onProgress, true);
    if (latestValue !== undefined) return latestValue;
  }

  const execute = async () => {
  let response: Response;
  options.onProgress?.({
    stage: "sienge-request",
    message: "Chamando a API do Sienge.",
    detail: `${method} ${path}`
  });
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });
  } catch (error) {
    throw new SiengeApiError({
      method,
      endpoint: path,
      title: "Não foi possível conectar ao Sienge",
      explanation: error instanceof Error ? error.message : "A conexão com a API falhou.",
      suggestion: "Confira a conexão com a internet, o tenant e tente novamente.",
      occurredAt: new Date().toISOString()
    });
  }

  if (!response.ok) {
    options.onProgress?.({
      stage: "sienge-error-body",
      message: "Sienge respondeu com erro; lendo detalhes da resposta.",
      detail: `${response.status} ${response.statusText}`
    });
    const contentType = response.headers.get("content-type") || "";
    let apiResponse: unknown;
    try {
      apiResponse = contentType.includes("json") ? await response.json() : await response.text();
    } catch {
      apiResponse = undefined;
    }
    const guidance = statusGuidance[response.status] || {
      title: `O Sienge respondeu com erro ${response.status}`,
      explanation: "A API não conseguiu concluir a consulta.",
      suggestion: "Use os detalhes técnicos abaixo para verificar a integração ou acionar o suporte do Sienge."
    };
    const rateLimitType = response.status === 429 ? (path.startsWith("/bulk-data/") ? "BULK" : "REST") : undefined;
    throw new SiengeApiError({
      status: response.status,
      statusText: response.statusText,
      method,
      endpoint: path,
      rateLimitType,
      rateLimitDescription: rateLimitType === "BULK"
        ? "Limite BULK excedido: até 20 requisições por minuto, além da cota diária contratada."
        : rateLimitType === "REST"
          ? "Limite REST excedido: até 200 requisições por minuto, além da cota diária contratada."
          : undefined,
      ...guidance,
      apiMessage: safeApiMessage(apiResponse),
      requestId: response.headers.get("x-request-id") || response.headers.get("trace-id") || undefined,
      occurredAt: new Date().toISOString()
    });
  }

  if (response.status === 204 || response.headers.get("content-length") === "0" || !response.headers.get("content-type")?.includes("json")) {
    return undefined as T;
  }
  options.onProgress?.({
    stage: "sienge-json-read",
    message: "Sienge respondeu; lendo JSON retornado.",
    detail: path
  });
  return response.json() as Promise<T>;
  };

  if (!useDailyCache) {
    const result = await execute();
    if (method !== "GET") invalidateSiengeCache();
    return result;
  }

  const pending = execute();
  dailyCache.set(key, { day, pending });
  try {
    const value = await pending;
    if (isEmptySiengeResponse(value)) {
      const latest = readLatestSqliteCache<T>(key, options.onProgress, true);
      if (latest !== undefined) {
        dailyCache.delete(key);
        return latest;
      }
    }
    const savedAt = new Date().toISOString();
    const entry: DailyCacheEntry = { day, value, savedAt };
    const mirroredValue = writeLocalMirror<T>(key, entry, options.onProgress, options.forceReplaceFinalized === true);
    const finalValue = mirroredValue !== undefined ? mirroredValue : value;
    entry.value = finalValue;
    dailyCache.set(key, entry);
    writeSqliteCache(key, entry, options.onProgress);
    writeStructuredTables(key, day, finalValue, options.onProgress, savedAt);
    return annotateSiengeResponse(finalValue, day, savedAt);
  } catch (error) {
    dailyCache.delete(key);
    if (error instanceof SiengeApiError && error.details.status === 429) {
      const entry = { day, error: error.details, errorExpiresAt: Date.now() + 5 * 60 * 1000 };
      dailyCache.set(key, entry);
      writeLocalMirror<T>(key, entry, options.onProgress, false);
      writeSqliteCache(key, entry, options.onProgress);
    }
    const latest = readLatestSqliteCache<T>(key, options.onProgress, true);
    if (latest !== undefined) return latest;
    throw error;
  }
}
