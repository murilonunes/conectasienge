import "server-only";

import { existsSync, readFileSync, statSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import type { SiengeErrorDetails } from "@/lib/api/sienge";

export type TraceableResource = {
  key: string;
  tableId: string;
  resourceId: string;
  description: string;
  auxiliaryCode?: string;
  synonym?: string;
  active: boolean;
  movementCount: number;
};

export type ResourceRequestTrace = {
  requestId: string;
  itemNumber: string;
  date?: string;
  quantity: number;
  description: string;
  detail?: string;
  notes?: string;
  requester?: string;
  buildingId?: string;
  consistency?: string;
  authorized?: string;
  orderIds: string[];
};

export type ResourceOrderTrace = {
  orderId: string;
  itemNumber: string;
  date?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  description: string;
  detail?: string;
  supplierId?: string;
  supplierName?: string;
  buildingId?: string;
  consistency?: string;
  authorized?: string;
  requestIds: string[];
  invoiceIds: string[];
};

export type ResourceInvoiceTrace = {
  invoiceId: string;
  itemNumber: string;
  number?: string;
  series?: string;
  documentId?: string;
  issueDate?: string;
  movementDate?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  description: string;
  detail?: string;
  supplierId?: string;
  supplierName?: string;
  buildingId?: string;
  consistency?: string;
  orderIds: string[];
};

export type ResourceTraceabilityResult = {
  query: string;
  matches: TraceableResource[];
  totalMatches: number;
  selected?: TraceableResource;
  requests: ResourceRequestTrace[];
  orders: ResourceOrderTrace[];
  invoices: ResourceInvoiceTrace[];
  sourceFileName?: string;
  sourceUpdatedAt?: string;
  error?: SiengeErrorDetails;
};

type CatalogRow = {
  cdtabela: string;
  cdinsumo: string;
  deinsumo: string;
  cdauxiliar: string;
  desinonimo: string;
  flativo: string;
};

const dataDir = path.join(process.cwd(), ".sienge-data");
const dumpDatabasePath = path.join(dataDir, "sienge-dump.sqlite");
const dumpStatusPath = path.join(dataDir, "dump-import-status.json");
const requiredTables = [
  "ecstinsumo",
  "eadcitemsol",
  "eadcsolicitacao",
  "eadcitemsolatend",
  "eadcitempedido",
  "eadcpedidocompra",
  "eadcpedidocompranf",
  "eadcitemnotafiscal",
  "eadcnotafiscal",
  "ecadcredor"
];

function localDataError(title: string, explanation: string): SiengeErrorDetails {
  return {
    method: "GET",
    endpoint: "sienge-dump.sqlite",
    title,
    explanation,
    suggestion: "Importe um dump atualizado do Sienge em Configurações.",
    occurredAt: new Date().toISOString()
  };
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

function resourceFromRow(row: CatalogRow, movementCount = 0): TraceableResource {
  return {
    key: `${row.cdtabela}:${row.cdinsumo}`,
    tableId: row.cdtabela,
    resourceId: row.cdinsumo,
    description: row.deinsumo || `Insumo ${row.cdinsumo}`,
    auxiliaryCode: row.cdauxiliar || undefined,
    synonym: row.desinonimo || undefined,
    active: row.flativo === "S",
    movementCount
  };
}

function splitIds(value?: string | null) {
  return Array.from(new Set(String(value || "").split(",").map((item) => item.trim()).filter(Boolean)));
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sourceInfo() {
  if (existsSync(dumpStatusPath)) {
    try {
      const status = JSON.parse(readFileSync(dumpStatusPath, "utf8")) as { sourceFileName?: string; finishedAt?: string; updatedAt?: string };
      return {
        sourceFileName: status.sourceFileName,
        sourceUpdatedAt: status.finishedAt || status.updatedAt
      };
    } catch {
      // The SQLite timestamp remains a reliable fallback when the status file is invalid.
    }
  }
  return { sourceUpdatedAt: statSync(dumpDatabasePath).mtime.toISOString() };
}

function emptyResult(query: string, error?: SiengeErrorDetails): ResourceTraceabilityResult {
  return { query, matches: [], totalMatches: 0, requests: [], orders: [], invoices: [], ...(error ? { error } : {}) };
}

export async function loadResourceTraceability(queryInput = "", selectedKeyInput = ""): Promise<ResourceTraceabilityResult> {
  const query = String(queryInput || "").trim().slice(0, 120);
  const selectedKey = String(selectedKeyInput || "").trim();

  if (!existsSync(dumpDatabasePath)) {
    return emptyResult(query, localDataError("Histórico detalhado não disponível", "O dump convertido do Sienge ainda não foi importado."));
  }

  const database = new DatabaseSync(dumpDatabasePath);
  database.exec("PRAGMA busy_timeout = 8000;");
  try {
    const availableTables = new Set(
      (database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((row) => row.name)
    );
    const missingTables = requiredTables.filter((table) => !availableTables.has(table));
    if (missingTables.length) {
      return emptyResult(query, localDataError("Dump incompatível com a rastreabilidade", `Tabelas necessárias não encontradas: ${missingTables.join(", ")}.`));
    }

    const catalogRows = database.prepare(`
      SELECT cdtabela, cdinsumo, deinsumo, cdauxiliar, desinonimo, flativo
      FROM ecstinsumo
    `).all() as CatalogRow[];
    const movementRows = database.prepare(`
      SELECT cdtabela, cdinsumo, SUM(movementCount) AS movementCount
      FROM (
        SELECT cdtabela, cdinsumo, COUNT(*) AS movementCount FROM eadcitemsol GROUP BY cdtabela, cdinsumo
        UNION ALL
        SELECT cdtabela, cdinsumo, COUNT(*) AS movementCount FROM eadcitempedido GROUP BY cdtabela, cdinsumo
        UNION ALL
        SELECT cdtabela, cdinsumo, COUNT(*) AS movementCount FROM eadcitemnotafiscal GROUP BY cdtabela, cdinsumo
      ) movements
      GROUP BY cdtabela, cdinsumo
    `).all() as Array<{ cdtabela: string; cdinsumo: string; movementCount: number }>;
    const movementCountByKey = new Map(
      movementRows.map((row) => [`${row.cdtabela}:${row.cdinsumo}`, numberValue(row.movementCount)])
    );
    const resources = catalogRows.map((row) => resourceFromRow(row, movementCountByKey.get(`${row.cdtabela}:${row.cdinsumo}`) || 0));
    const normalizedQuery = normalizeSearch(query);
    const queryTokens = normalizedQuery.split(" ").filter(Boolean);
    const rankedMatches = normalizedQuery
      ? resources
          .map((resource) => {
            const code = normalizeSearch(resource.resourceId);
            const auxiliary = normalizeSearch(resource.auxiliaryCode || "");
            const description = normalizeSearch(resource.description);
            const haystack = normalizeSearch([resource.resourceId, resource.auxiliaryCode, resource.description, resource.synonym].filter(Boolean).join(" "));
            if (!queryTokens.every((token) => haystack.includes(token))) return undefined;
            const score = code === normalizedQuery
              ? 0
              : auxiliary === normalizedQuery
                ? 1
                : description === normalizedQuery
                  ? 2
                  : description.startsWith(normalizedQuery)
                    ? 3
                    : 4;
            return { resource, score };
          })
          .filter((item): item is { resource: TraceableResource; score: number } => Boolean(item))
          .sort((left, right) => left.score - right.score || right.resource.movementCount - left.resource.movementCount || Number(right.resource.active) - Number(left.resource.active) || left.resource.description.localeCompare(right.resource.description, "pt-BR"))
      : [];
    const matches = rankedMatches.slice(0, 30).map((item) => item.resource);
    const resourceByKey = new Map(resources.map((resource) => [resource.key, resource]));
    const selected = resourceByKey.get(selectedKey) || matches[0];
    const source = sourceInfo();

    if (!selected) {
      return { query, matches, totalMatches: rankedMatches.length, requests: [], orders: [], invoices: [], ...source };
    }

    type RequestRow = Omit<ResourceRequestTrace, "quantity" | "orderIds"> & { quantity: unknown; orderIds?: string | null };
    const requestRows = database.prepare(`
      SELECT
        s.nusolicitacao AS requestId,
        i.nuitemsol AS itemNumber,
        NULLIF(s.dtsolicitacao, '') AS date,
        i.qtitemsol AS quantity,
        COALESCE(NULLIF(i.deitemsol, ''), NULLIF(?, ''), 'Insumo sem descrição') AS description,
        NULLIF(i.dedetalhe, '') AS detail,
        COALESCE(NULLIF(i.deobservacao, ''), NULLIF(s.deobservacao, '')) AS notes,
        NULLIF(s.cdusuario, '') AS requester,
        NULLIF(s.cdobra, '') AS buildingId,
        NULLIF(s.tpregconsistente, '') AS consistency,
        NULLIF(i.flautorizacao, '') AS authorized,
        GROUP_CONCAT(DISTINCT NULLIF(a.nupedidocompra, '')) AS orderIds
      FROM eadcitemsol i
      INNER JOIN eadcsolicitacao s ON s.nusolicitacao = i.nusolicitacao
      LEFT JOIN eadcitemsolatend a ON a.nusolicitacao = i.nusolicitacao AND a.nuitemsol = i.nuitemsol
      WHERE i.cdtabela = ? AND i.cdinsumo = ?
      GROUP BY s.nusolicitacao, i.nuitemsol
      ORDER BY s.dtsolicitacao DESC, CAST(s.nusolicitacao AS INTEGER) DESC
    `).all(selected.description, selected.tableId, selected.resourceId) as RequestRow[];
    const requests = requestRows.map((row) => ({ ...row, quantity: numberValue(row.quantity), orderIds: splitIds(row.orderIds) }));

    type OrderRow = Omit<ResourceOrderTrace, "quantity" | "unitPrice" | "total" | "requestIds" | "invoiceIds"> & {
      quantity: unknown;
      unitPrice: unknown;
      total: unknown;
      requestIds?: string | null;
      invoiceIds?: string | null;
    };
    const orderRows = database.prepare(`
      SELECT
        p.nupedidocompra AS orderId,
        i.nuitempedido AS itemNumber,
        NULLIF(p.dtpedido, '') AS date,
        i.qtpedido AS quantity,
        COALESCE(NULLIF(i.vlprecoliquido, ''), NULLIF(i.vlprecounitario, ''), 0) AS unitPrice,
        CAST(COALESCE(NULLIF(i.qtpedido, ''), 0) AS REAL) * CAST(COALESCE(NULLIF(i.vlprecoliquido, ''), NULLIF(i.vlprecounitario, ''), 0) AS REAL) AS total,
        COALESCE(NULLIF(i.deitempedido, ''), NULLIF(?, ''), 'Insumo sem descrição') AS description,
        NULLIF(i.dedetalhe, '') AS detail,
        NULLIF(p.cdfornecedor, '') AS supplierId,
        COALESCE(NULLIF(c.nmfantasia, ''), NULLIF(c.nmcredor, '')) AS supplierName,
        NULLIF(p.cdobra, '') AS buildingId,
        NULLIF(p.tpregconsistente, '') AS consistency,
        NULLIF(p.flautorizacao, '') AS authorized,
        GROUP_CONCAT(DISTINCT NULLIF(a.nusolicitacao, '')) AS requestIds,
        GROUP_CONCAT(DISTINCT NULLIF(pn.nuseqnotafiscal, '')) AS invoiceIds
      FROM eadcitempedido i
      INNER JOIN eadcpedidocompra p ON p.nupedidocompra = i.nupedidocompra
      LEFT JOIN ecadcredor c ON c.cdcredor = p.cdfornecedor
      LEFT JOIN eadcitemsolatend a ON a.nupedidocompra = i.nupedidocompra AND a.nuitempedido = i.nuitempedido
      LEFT JOIN eadcpedidocompranf pn ON pn.nupedidocompra = i.nupedidocompra
      WHERE i.cdtabela = ? AND i.cdinsumo = ?
      GROUP BY p.nupedidocompra, i.nuitempedido
      ORDER BY p.dtpedido DESC, CAST(p.nupedidocompra AS INTEGER) DESC
    `).all(selected.description, selected.tableId, selected.resourceId) as OrderRow[];
    const orders = orderRows.map((row) => ({
      ...row,
      quantity: numberValue(row.quantity),
      unitPrice: numberValue(row.unitPrice),
      total: numberValue(row.total),
      requestIds: splitIds(row.requestIds),
      invoiceIds: splitIds(row.invoiceIds)
    }));

    type InvoiceRow = Omit<ResourceInvoiceTrace, "quantity" | "unitPrice" | "total" | "orderIds"> & {
      quantity: unknown;
      unitPrice: unknown;
      total: unknown;
      orderIds?: string | null;
    };
    const invoiceRows = database.prepare(`
      SELECT
        n.nuseqnotafiscal AS invoiceId,
        i.nuitemnotafiscal AS itemNumber,
        NULLIF(n.nunotafiscal, '') AS number,
        NULLIF(n.tpserie, '') AS series,
        NULLIF(n.cddocumento, '') AS documentId,
        NULLIF(n.dtemissao, '') AS issueDate,
        NULLIF(n.dtmovimento, '') AS movementDate,
        i.qtentregue AS quantity,
        COALESCE(NULLIF(i.vlprecoliquido, ''), NULLIF(i.vlprecounitario, ''), 0) AS unitPrice,
        COALESCE(NULLIF(i.vlsubtotal, ''), CAST(COALESCE(NULLIF(i.qtentregue, ''), 0) AS REAL) * CAST(COALESCE(NULLIF(i.vlprecoliquido, ''), NULLIF(i.vlprecounitario, ''), 0) AS REAL)) AS total,
        COALESCE(NULLIF(i.deitemnotafiscal, ''), NULLIF(?, ''), 'Insumo sem descrição') AS description,
        NULLIF(i.dedetalhe, '') AS detail,
        NULLIF(n.cdfornecedor, '') AS supplierId,
        COALESCE(NULLIF(c.nmfantasia, ''), NULLIF(c.nmcredor, '')) AS supplierName,
        NULLIF(i.cdobra, '') AS buildingId,
        NULLIF(n.tpregconsistente, '') AS consistency,
        GROUP_CONCAT(DISTINCT NULLIF(pn.nupedidocompra, '')) AS orderIds
      FROM eadcitemnotafiscal i
      INNER JOIN eadcnotafiscal n ON n.nuseqnotafiscal = i.nuseqnotafiscal
      LEFT JOIN ecadcredor c ON c.cdcredor = n.cdfornecedor
      LEFT JOIN eadcpedidocompranf pn ON pn.nuseqnotafiscal = n.nuseqnotafiscal
      WHERE i.cdtabela = ? AND i.cdinsumo = ?
      GROUP BY n.nuseqnotafiscal, i.nuitemnotafiscal
      ORDER BY n.dtemissao DESC, CAST(n.nuseqnotafiscal AS INTEGER) DESC
    `).all(selected.description, selected.tableId, selected.resourceId) as InvoiceRow[];
    const invoices = invoiceRows.map((row) => ({
      ...row,
      quantity: numberValue(row.quantity),
      unitPrice: numberValue(row.unitPrice),
      total: numberValue(row.total),
      orderIds: splitIds(row.orderIds)
    }));

    return {
      query,
      matches,
      totalMatches: rankedMatches.length,
      selected,
      requests,
      orders,
      invoices,
      ...source
    };
  } finally {
    database.close();
  }
}
