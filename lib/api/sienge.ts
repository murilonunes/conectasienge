import "server-only";
import { createHash } from "crypto";
import { existsSync, mkdirSync } from "fs";
import { rm } from "fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { storeBulkResponse, storeGenericResponseRecords } from "./sienge-bulk-store";

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
  value?: unknown;
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
  `);
  migrateLegacyCache(database);
  return database;
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
  response_json?: string | null;
  error_json?: string | null;
  error_expires_at?: number | null;
};

function readSqliteCache<T>(key: string, day: string, onProgress?: RequestOptions["onProgress"]) {
  onProgress?.({
    stage: "sqlite-cache-read",
    message: "Consultando cache bruto no SQLite.",
    detail: `${sqliteFiles.cache} · tabela sienge_response_cache`
  });
  const row = getCacheSqlite()
    .prepare("SELECT response_json, error_json, error_expires_at FROM sienge_response_cache WHERE cache_key = ? AND day = ?")
    .get(key, day) as SqliteCacheRow | undefined;

  if (!row) return undefined;
  onProgress?.({
    stage: "sqlite-cache-hit",
    message: "Resposta encontrada no SQLite.",
    detail: "Reaproveitando JSON salvo para esta consulta e este dia."
  });
  const cached: DailyCacheEntry = {
    day,
    value: row.response_json ? JSON.parse(row.response_json) : undefined,
    error: row.error_json ? JSON.parse(row.error_json) : undefined,
    errorExpiresAt: row.error_expires_at ?? undefined
  };

  dailyCache.set(key, cached);
  if (cached.error && cached.errorExpiresAt && cached.errorExpiresAt > Date.now()) {
    throw new SiengeApiError(cached.error);
  }
  if (cached.value !== undefined) {
    writeStructuredTables(key, day, cached.value, onProgress);
    return cached.value as T;
  }
  return undefined;
}

function writeSqliteCache(key: string, entry: DailyCacheEntry, onProgress?: RequestOptions["onProgress"]) {
  const parsed = parseCacheKey(key);
  onProgress?.({
    stage: "sqlite-cache-write",
    message: "Gravando resposta bruta no SQLite.",
    detail: `${sqliteFiles.cache} · ${parsed.endpoint}`
  });
  getCacheSqlite().prepare(`
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
    new Date().toISOString()
  );
}

function writeStructuredTables(key: string, day: string, value: unknown, onProgress?: RequestOptions["onProgress"]) {
  const parsed = parseCacheKey(key);
  const responsibility = sqliteResponsibilityForEndpoint(parsed.endpoint);
  const database = getSqlite(responsibility);
  const context = {
    tenant: parsed.tenant,
    endpoint: parsed.endpoint,
    queryJson: parsed.queryJson,
    day,
    savedAt: new Date().toISOString()
  };
  onProgress?.({
    stage: "sqlite-records-write",
    message: "Gravando registros estruturados no SQLite.",
    detail: `${sqliteFiles[responsibility]} · ${parsed.endpoint}`
  });
  storeGenericResponseRecords(database, context, value, onProgress);
  if (parsed.endpoint.startsWith("/bulk-data/")) {
    onProgress?.({
      stage: "sqlite-bulk-write",
      message: "Gravando tabelas específicas de bulk no SQLite.",
      detail: `${sqliteFiles[responsibility]} · ${parsed.endpoint}`
    });
    storeBulkResponse(database, context, value, onProgress);
  }
}

const statusGuidance: Record<number, Pick<SiengeErrorDetails, "title" | "explanation" | "suggestion">> = {
  400: {
    title: "A consulta enviada ao Sienge é inválida",
    explanation: "A API rejeitou um ou mais filtros ou parâmetros da consulta.",
    suggestion: "Confira o período informado e os parâmetros obrigatórios do endpoint."
  },
  401: {
    title: "O Sienge não reconheceu as credenciais",
    explanation: "O usuário, a senha ou o subdomínio não foram aceitos pela API.",
    suggestion: "Confira SIENGE_TENANT, SIENGE_USERNAME e SIENGE_PASSWORD no arquivo .env e reinicie o servidor."
  },
  403: {
    title: "A credencial não tem permissão para consultar este recurso",
    explanation: "O Sienge reconheceu a autenticação, mas bloqueou o acesso ao endpoint de títulos do contas a pagar.",
    suggestion: "No Painel de Integrações do Sienge, libere a API de Contas a Pagar para esse usuário e confirme se o pacote contratado inclui o recurso."
  },
  404: {
    title: "Recurso não encontrado no Sienge",
    explanation: "O endpoint ou tenant configurado não foi encontrado.",
    suggestion: "Confira o SIENGE_TENANT e se o recurso está disponível nesse ambiente."
  },
  429: {
    title: "Limite de consultas do Sienge atingido",
    explanation: "A API bloqueou temporariamente novas chamadas por excesso de requisições.",
    suggestion: "Aguarde alguns minutos e tente novamente."
  }
};

function safeApiMessage(value: unknown): string | undefined {
  if (!value) return undefined;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.replace(/basic\s+[a-z0-9+/=]+/gi, "Basic [removido]").slice(0, 1000);
}

export async function siengeRequest<T>(path: string, query: Record<string, QueryValue> = {}, options: RequestOptions = {}): Promise<T> {
  const tenant = process.env.SIENGE_TENANT;
  const username = process.env.SIENGE_USERNAME;
  const password = process.env.SIENGE_PASSWORD;

  if (!tenant || !username || !password) {
    throw new SiengeApiError({
      method: "GET",
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

  const method = options.method || "GET";
  const useDailyCache = method === "GET" && options.cache !== "no-store";
  const readDailyCache = useDailyCache && options.cache !== "refresh";
  const day = currentDay();
  const key = cacheKey(tenant, path, query);
  const cached = readDailyCache ? dailyCache.get(key) : undefined;
  options.onProgress?.({
    stage: "memory-cache-read",
    message: "Verificando cache em memória do servidor.",
    detail: path
  });
  if (cached?.day === day) {
    if (cached.error && cached.errorExpiresAt && cached.errorExpiresAt > Date.now()) throw new SiengeApiError(cached.error);
    if (cached.pending) return cached.pending as Promise<T>;
    if (cached.value !== undefined) {
      options.onProgress?.({
        stage: "memory-cache-hit",
        message: "Resposta encontrada no cache em memória.",
        detail: "Sincronizando registros estruturados no SQLite."
      });
      writeStructuredTables(key, day, cached.value, options.onProgress);
    }
    return cached.value as T;
  }
  if (cached) dailyCache.delete(key);
  if (readDailyCache) {
    const diskValue = readSqliteCache<T>(key, day, options.onProgress);
    if (diskValue !== undefined) return diskValue;
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
    const entry = { day, value };
    dailyCache.set(key, entry);
    writeSqliteCache(key, entry, options.onProgress);
    writeStructuredTables(key, day, value, options.onProgress);
    return value;
  } catch (error) {
    dailyCache.delete(key);
    if (error instanceof SiengeApiError && error.details.status === 429) {
      const entry = { day, error: error.details, errorExpiresAt: Date.now() + 5 * 60 * 1000 };
      dailyCache.set(key, entry);
      writeSqliteCache(key, entry, options.onProgress);
    }
    throw error;
  }
}
