import "server-only";
import { existsSync, readdirSync, statSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";

type CacheRow = {
  endpoint: string;
  day: string;
  saved_at: string;
  has_response: number;
  has_error: number;
};

export type ScreenUpdateHistory = {
  key: string;
  label: string;
  description: string;
  lastUpdatedAt?: string;
  lastAttemptAt?: string;
  lastDay?: string;
  status: "updated" | "warning" | "empty";
  successCount: number;
  errorCount: number;
  totalQueries: number;
  endpoints: string[];
};

export type LocalDatabaseFile = {
  name: string;
  sizeBytes: number;
  sizeLabel: string;
  updatedAt: string;
};

const dataDir = path.join(process.cwd(), ".sienge-data");
const cacheDatabasePath = path.join(dataDir, "00-cache.sqlite");

const screenDefinitions = [
  {
    key: "dashboard",
    label: "Dashboard inicial",
    description: "Visão geral combinando financeiro, vendas, compras e estoque.",
    endpoints: [] as string[]
  },
  {
    key: "payables",
    label: "Contas a pagar",
    description: "Títulos, agenda de pagamentos, parcelas e busca avançada.",
    endpoints: ["/v1/bills", "/bulk-data/v1/outcome"]
  },
  {
    key: "receivables",
    label: "Contas a receber",
    description: "Previsão de recebimentos e parcelas em aberto.",
    endpoints: ["/v1/accounts-receivable", "/bulk-data/v1/income"]
  },
  {
    key: "sales",
    label: "Portal comercial",
    description: "Contratos de vendas e gráficos por mês.",
    endpoints: ["/v1/sales-contracts"]
  },
  {
    key: "inventory",
    label: "Estoque e patrimônio",
    description: "Unidades imobiliárias, bens móveis e bens imóveis.",
    endpoints: ["/v1/units", "/v1/patrimony"]
  },
  {
    key: "reconciliation",
    label: "Conciliação",
    description: "Movimentos bancários, extratos e leitura de conciliação.",
    endpoints: ["/bulk-data/v1/bank-movement", "/v1/accounts-statements"]
  },
  {
    key: "purchases",
    label: "Compras",
    description: "Solicitações, cotações, pedidos e notas de compra.",
    endpoints: ["/v1/purchase-", "/bulk-data/v1/purchase-quotations"]
  },
  {
    key: "contracts",
    label: "Contratos",
    description: "Contratos de fornecimento e leituras contratuais.",
    endpoints: ["/v1/supply-contracts/all"]
  },
  {
    key: "parties",
    label: "Cadastros auxiliares",
    description: "Credores, clientes e dados usados para complementar telas.",
    endpoints: ["/v1/creditors", "/v1/customers", "/bulk-data/v1/customer"]
  }
];

function endpointMatches(endpoint: string, prefixes: string[]) {
  if (prefixes.length === 0) return true;
  return prefixes.some((prefix) => endpoint.startsWith(prefix));
}

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function readCacheRows(): CacheRow[] {
  if (!existsSync(dataDir)) return [];
  const mirrorRows = readdirSync(dataDir)
    .filter((name) => name.endsWith(".sqlite"))
    .flatMap((name) => {
      const database = new DatabaseSync(path.join(dataDir, name));
      try {
        const mirrorTable = database
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sienge_api_mirror_history'")
          .get();
        if (!mirrorTable) return [];
        return database.prepare(`
          SELECT
            endpoint,
            source_day AS day,
            saved_at,
            CASE WHEN status = 'success' THEN 1 ELSE 0 END AS has_response,
            CASE WHEN status <> 'success' THEN 1 ELSE 0 END AS has_error
          FROM sienge_api_mirror_history
          ORDER BY saved_at DESC
        `).all() as CacheRow[];
      } finally {
        database.close();
      }
    });

  if (mirrorRows.length > 0) {
    return mirrorRows.sort((left, right) => right.saved_at.localeCompare(left.saved_at));
  }

  if (!existsSync(cacheDatabasePath)) return [];
  const database = new DatabaseSync(cacheDatabasePath);
  try {
    const historyTable = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sienge_update_history'")
      .get();
    if (historyTable) {
      const historyRows = database.prepare(`
        SELECT
          endpoint,
          day,
          saved_at,
          CASE WHEN status = 'success' THEN 1 ELSE 0 END AS has_response,
          CASE WHEN status <> 'success' THEN 1 ELSE 0 END AS has_error
        FROM sienge_update_history
        ORDER BY saved_at DESC
      `).all() as CacheRow[];
      if (historyRows.length > 0) return historyRows;
    }

    const table = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sienge_response_cache'")
      .get();
    if (!table) return [];
    return database.prepare(`
      SELECT
        endpoint,
        day,
        saved_at,
        CASE WHEN response_json IS NOT NULL THEN 1 ELSE 0 END AS has_response,
        CASE WHEN error_json IS NOT NULL THEN 1 ELSE 0 END AS has_error
      FROM sienge_response_cache
      ORDER BY saved_at DESC
    `).all() as CacheRow[];
  } finally {
    database.close();
  }
}

export function getSiengeScreenUpdateHistory(): ScreenUpdateHistory[] {
  const rows = readCacheRows();

  return screenDefinitions.map((screen) => {
    const matchingRows = rows.filter((row) => endpointMatches(row.endpoint, screen.endpoints));
    const successfulRows = matchingRows.filter((row) => row.has_response);
    const errorRows = matchingRows.filter((row) => row.has_error);
    const lastSuccess = successfulRows[0];
    const lastAttempt = matchingRows[0];
    const endpoints = Array.from(new Set(matchingRows.map((row) => row.endpoint))).sort();

    return {
      key: screen.key,
      label: screen.label,
      description: screen.description,
      lastUpdatedAt: lastSuccess?.saved_at,
      lastAttemptAt: lastAttempt?.saved_at,
      lastDay: lastSuccess?.day || lastAttempt?.day,
      status: lastSuccess ? "updated" : errorRows.length ? "warning" : "empty",
      successCount: successfulRows.length,
      errorCount: errorRows.length,
      totalQueries: matchingRows.length,
      endpoints
    };
  });
}

export function getLocalDatabaseFiles(): LocalDatabaseFile[] {
  if (!existsSync(dataDir)) return [];
  return readdirSync(dataDir)
    .filter((name) => name.endsWith(".sqlite"))
    .map((name) => {
      const stats = statSync(path.join(dataDir, name));
      return {
        name,
        sizeBytes: stats.size,
        sizeLabel: formatSize(stats.size),
        updatedAt: stats.mtime.toISOString()
      };
    })
    .sort((left, right) => right.sizeBytes - left.sizeBytes);
}
