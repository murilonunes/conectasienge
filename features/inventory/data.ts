import "server-only";
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
        ? `No Painel de Integrações do Sienge, libere o endpoint ${endpoint} para esta credencial.`
        : error.details.suggestion
    };
  }

  return {
    method: "GET",
    endpoint,
    title: "Não foi possível consultar bens em estoque",
    explanation: error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
    suggestion: `Verifique a permissão do endpoint ${endpoint} no Sienge.`,
    occurredAt: new Date().toISOString()
  };
}

async function loadUnits(forceRefresh = false) {
  const page = await loadAllPages<RawInventoryUnit>((offset) =>
    estoqueApi.units<RawInventoryUnit>({ limit: LIMIT, offset, additionalData: "ALL" }, forceRefresh)
  );
  return {
    totalCount: page.totalCount,
    assets: page.results.map(normalizeUnit)
  };
}

async function loadMovable(forceRefresh = false) {
  const page = await loadAllPages<RawPatrimonyAsset>((offset) =>
    estoqueApi.movable<RawPatrimonyAsset>({ limit: LIMIT, offset }, forceRefresh)
  );
  return {
    totalCount: page.totalCount,
    assets: page.results.map((asset, index) => normalizePatrimony(asset, "movable", index))
  };
}

async function loadFixed(forceRefresh = false) {
  const page = await loadAllPages<RawPatrimonyAsset>((offset) =>
    estoqueApi.fixed<RawPatrimonyAsset>({ limit: LIMIT, offset }, forceRefresh)
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

export async function loadInventoryAssets(forceRefresh = false): Promise<InventoryResult> {
  const sources = await Promise.allSettled([
    loadUnits(forceRefresh),
    loadMovable(forceRefresh),
    loadFixed(forceRefresh)
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
    ? `Algumas consultas não carregaram: ${failures.map((failure) => `${failure.endpoint} (${failure.status || "erro"})`).join(", ")}.`
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
