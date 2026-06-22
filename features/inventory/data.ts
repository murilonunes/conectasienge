import "server-only";
import { existsSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { estoqueApi } from "@/lib/api/financeiro";
import { SiengeApiError, type SiengeErrorDetails, type SiengePage } from "@/lib/api/sienge";
import type { InventoryAsset, InventorySourceStat, InventorySummary, RawInventoryUnit, RawPatrimonyAsset } from "./types";
import { assetKindLabel, assetValue, ownershipLabel, situationLabel } from "./utils";

export type InventoryResult = {
  assets: InventoryAsset[];
  totalCount: number;
  rawTotalCount: number;
  sourceStats: InventorySourceStat[];
  warning?: string;
  error?: SiengeErrorDetails;
};

const LIMIT = 200;
const dataDir = path.join(process.cwd(), ".sienge-data");
const inventoryDatabasePath = path.join(dataDir, "inventory-assets.sqlite");
const SOURCE_DEFINITIONS: Array<{ key: InventorySourceStat["key"]; label: string; endpoint: string }> = [
  { key: "unit", label: "unidades imobiliárias", endpoint: "/v1/units" },
  { key: "movable", label: "bens móveis", endpoint: "/v1/patrimony/movable" },
  { key: "fixed", label: "bens imóveis", endpoint: "/v1/patrimony/fixed" }
];

type SqlRow = {
  raw_json: string;
  source_day?: string;
  saved_at?: string;
};

async function loadAllPages<T>(loadPage: (offset: number) => Promise<SiengePage<T>>) {
  const firstPage = await loadPage(0);
  const totalCount = firstPage.resultSetMetadata?.count ?? firstPage.results.length;
  const remainingPages = Math.max(0, Math.ceil(totalCount / LIMIT) - 1);
  const additionalPages = await Promise.all(Array.from({ length: remainingPages }, (_, index) => loadPage((index + 1) * LIMIT)));

  return {
    totalCount,
    results: [
      ...(firstPage.results || []),
      ...additionalPages.flatMap((page) => page.results || [])
    ]
  };
}

function normalizeUnit(unit: RawInventoryUnit): InventoryAsset {
  return {
    ...unit,
    id: `unit-${unit.id}`,
    unitId: unit.id,
    kind: "unit"
  };
}

function normalizePatrimony(asset: RawPatrimonyAsset, kind: "movable" | "fixed", index: number): InventoryAsset {
  return {
    ...asset,
    id: `${kind}-${asset.patrimonyId || index}`,
    kind
  };
}

function openDatabase() {
  const database = new DatabaseSync(inventoryDatabasePath);
  database.exec("PRAGMA busy_timeout = 8000;");
  return database;
}

function tableExists(database: DatabaseSync, table: string) {
  return Boolean(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function localDataError(title: string, explanation: string): SiengeErrorDetails {
  return {
    method: "GET",
    endpoint: "/v1/units",
    title,
    explanation,
    suggestion: "Atualize Estoque em Configurações para preencher os dados.",
    occurredAt: new Date().toISOString()
  };
}

function emptySourceStats(status: InventorySourceStat["status"]) {
  return SOURCE_DEFINITIONS.map((source) => ({
    key: source.key,
    label: source.label,
    endpoint: source.endpoint,
    apiCount: 0,
    loadedCount: 0,
    status
  }));
}

function annotate<T>(row: SqlRow): T | undefined {
  try {
    return {
      ...(JSON.parse(row.raw_json) as T & object),
      __siengeIntegrationDay: row.source_day,
      __siengeIntegratedAt: row.saved_at
    } as T;
  } catch {
    return undefined;
  }
}

function readEndpoint<T>(database: DatabaseSync, endpoint: string) {
  const rows = database.prepare(`
    SELECT raw_json, source_day, saved_at
    FROM sienge_records
    WHERE endpoint = ?
    ORDER BY saved_at DESC
  `).all(endpoint) as SqlRow[];

  return rows.map(annotate<T>).filter((item): item is T => Boolean(item));
}

function localSourceStat(source: (typeof SOURCE_DEFINITIONS)[number], loadedCount: number): InventorySourceStat {
  return {
    key: source.key,
    label: source.label,
    endpoint: source.endpoint,
    apiCount: loadedCount,
    loadedCount,
    status: loadedCount === 0 ? "empty" : "ok"
  };
}

function readLocalInventory(): InventoryResult {
  if (!existsSync(inventoryDatabasePath)) {
    return {
      assets: [],
      totalCount: 0,
      rawTotalCount: 0,
      sourceStats: emptySourceStats("error"),
      error: localDataError("Estoque sem dados carregados", "Os dados de estoque ainda não foram atualizados.")
    };
  }

  const database = openDatabase();
  try {
    if (!tableExists(database, "sienge_records")) {
      return {
        assets: [],
        totalCount: 0,
        rawTotalCount: 0,
        sourceStats: emptySourceStats("error"),
        error: localDataError("Estoque ainda não disponível", "Ainda não há bens ou unidades salvos para exibição.")
      };
    }

    const units = readEndpoint<RawInventoryUnit>(database, SOURCE_DEFINITIONS[0].endpoint).map(normalizeUnit);
    const movable = readEndpoint<RawPatrimonyAsset>(database, SOURCE_DEFINITIONS[1].endpoint).map((asset, index) => normalizePatrimony(asset, "movable", index));
    const fixed = readEndpoint<RawPatrimonyAsset>(database, SOURCE_DEFINITIONS[2].endpoint).map((asset, index) => normalizePatrimony(asset, "fixed", index));
    const assets = [...units, ...movable, ...fixed].sort((left, right) => {
      const leftValue = left.patrimonyId || left.unitId || 0;
      const rightValue = right.patrimonyId || right.unitId || 0;
      return rightValue - leftValue || assetKindLabel(left.kind).localeCompare(assetKindLabel(right.kind));
    });
    const sourceStats = [
      localSourceStat(SOURCE_DEFINITIONS[0], units.length),
      localSourceStat(SOURCE_DEFINITIONS[1], movable.length),
      localSourceStat(SOURCE_DEFINITIONS[2], fixed.length)
    ];

    return {
      assets,
      totalCount: assets.length,
      rawTotalCount: assets.length,
      sourceStats,
      ...(assets.length === 0 ? {
        error: localDataError("Estoque sem dados", "Nenhuma unidade ou bem foi encontrado na base local.")
      } : {})
    };
  } finally {
    database.close();
  }
}

function inventoryError(error: unknown, endpoint: string, label: string): SiengeErrorDetails {
  if (error instanceof SiengeApiError) {
    const isPermissionError = error.details.status === 403;
    return {
      ...error.details,
      endpoint,
      explanation: isPermissionError
        ? `O Sienge reconheceu a autenticação, mas bloqueou o acesso a ${label}.`
        : error.details.explanation,
      suggestion: isPermissionError
        ? `No Painel de Integrações do Sienge, libere ${label} para esta credencial.`
        : error.details.suggestion
    };
  }

  return {
    method: "GET",
    endpoint,
    title: "Não foi possível consultar bens em estoque",
    explanation: error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
    suggestion: `Verifique a permissão de ${label} no Sienge.`,
    occurredAt: new Date().toISOString()
  };
}

async function loadUnits(forceRefresh = false, forceReplaceFinalized = false) {
  const page = await loadAllPages<RawInventoryUnit>((offset) =>
    estoqueApi.units<RawInventoryUnit>({ limit: LIMIT, offset, additionalData: "ALL" }, forceRefresh, forceReplaceFinalized)
  );
  return {
    totalCount: page.totalCount,
    assets: page.results.map(normalizeUnit)
  };
}

async function loadMovable(forceRefresh = false, forceReplaceFinalized = false) {
  const page = await loadAllPages<RawPatrimonyAsset>((offset) =>
    estoqueApi.movable<RawPatrimonyAsset>({ limit: LIMIT, offset }, forceRefresh, forceReplaceFinalized)
  );
  return {
    totalCount: page.totalCount,
    assets: page.results.map((asset, index) => normalizePatrimony(asset, "movable", index))
  };
}

async function loadFixed(forceRefresh = false, forceReplaceFinalized = false) {
  const page = await loadAllPages<RawPatrimonyAsset>((offset) =>
    estoqueApi.fixed<RawPatrimonyAsset>({ limit: LIMIT, offset }, forceRefresh, forceReplaceFinalized)
  );
  return {
    totalCount: page.totalCount,
    assets: page.results.map((asset, index) => normalizePatrimony(asset, "fixed", index))
  };
}

function sourceStat(source: PromiseSettledResult<{ totalCount: number; assets: InventoryAsset[] }>, key: InventorySourceStat["key"], label: string, endpoint: string): InventorySourceStat {
  if (source.status === "rejected") {
    return { key, label, endpoint, apiCount: 0, loadedCount: 0, status: "error" };
  }

  const loadedCount = source.value.assets.length;
  return {
    key,
    label,
    endpoint,
    apiCount: source.value.totalCount,
    loadedCount,
    status: source.value.totalCount === 0 ? "empty" : loadedCount === source.value.totalCount ? "ok" : "partial"
  };
}

export async function loadInventoryAssets(forceRefresh = false, forceReplaceFinalized = false): Promise<InventoryResult> {
  if (!forceRefresh) return readLocalInventory();

  const sources = await Promise.allSettled([
    loadUnits(forceRefresh, forceReplaceFinalized),
    loadMovable(forceRefresh, forceReplaceFinalized),
    loadFixed(forceRefresh, forceReplaceFinalized)
  ]);

  const labels = ["unidades imobiliárias", "bens móveis", "bens imóveis"];
  const endpoints = ["/v1/units", "/v1/patrimony/movable", "/v1/patrimony/fixed"];
  const loaded = sources.flatMap((source) => source.status === "fulfilled" ? source.value.assets : []);
  const rawTotalCount = sources.reduce((sum, source) => sum + (source.status === "fulfilled" ? source.value.totalCount : 0), 0);
  const sourceStats = [
    sourceStat(sources[0], "unit", labels[0], endpoints[0]),
    sourceStat(sources[1], "movable", labels[1], endpoints[1]),
    sourceStat(sources[2], "fixed", labels[2], endpoints[2])
  ];
  const failures = sources
    .map((source, index) => source.status === "rejected" ? inventoryError(source.reason, endpoints[index], labels[index]) : undefined)
    .filter((item): item is SiengeErrorDetails => Boolean(item));

  if (!loaded.length && failures.length) {
    return { assets: [], totalCount: 0, rawTotalCount: 0, sourceStats, error: failures[0] };
  }

  const warning = failures.length
    ? `Algumas consultas de estoque não carregaram. Verifique as permissões e tente atualizar novamente.`
    : undefined;

  const assets = loaded.sort((left, right) => {
    const leftValue = left.patrimonyId || left.unitId || 0;
    const rightValue = right.patrimonyId || right.unitId || 0;
    return rightValue - leftValue || assetKindLabel(left.kind).localeCompare(assetKindLabel(right.kind));
  });

  return { assets, totalCount: assets.length, rawTotalCount, sourceStats, warning };
}

export function analyzeInventory(assets: InventoryAsset[]): InventorySummary {
  const groups = new Map<string, { label: string; count: number; value: number }>();

  assets.forEach((asset) => {
    const label = assetKindLabel(asset.kind);
    const value = assetValue(asset).value;
    const current = groups.get(label) || { label, count: 0, value: 0 };
    current.count += 1;
    current.value += value;
    groups.set(label, current);
  });

  return {
    totalValue: assets.reduce((sum, asset) => sum + assetValue(asset).value, 0),
    ownCount: assets.filter((asset) => ownershipLabel(asset) === "Próprio").length,
    thirdPartyCount: assets.filter((asset) => ownershipLabel(asset) === "Terceiro").length,
    unitCount: assets.filter((asset) => asset.kind === "unit").length,
    movableCount: assets.filter((asset) => asset.kind === "movable").length,
    fixedCount: assets.filter((asset) => asset.kind === "fixed").length,
    activeCount: assets.filter((asset) => situationLabel(asset) === "Ativo" || situationLabel(asset) === "Disponível").length,
    writtenOffCount: assets.filter((asset) => situationLabel(asset) === "Baixado").length,
    byKind: Array.from(groups.values()).sort((left, right) => right.count - left.count)
  };
}
