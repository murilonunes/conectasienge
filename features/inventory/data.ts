import "server-only";
import { existsSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { estoqueApi } from "@/lib/api/financeiro";
import { SiengeApiError, type SiengeErrorDetails, type SiengePage } from "@/lib/api/sienge";
import { getAppSettings, getSiengeIntegrationRange } from "@/lib/settings";
import type {
  InventoryAsset,
  InventoryPriceTable,
  InventoryRealEstateMap,
  InventorySourceKey,
  InventorySourceStat,
  InventoryStockItem,
  InventoryStockReservation,
  InventorySummary,
  RawInventoryUnit,
  RawPatrimonyAsset
} from "./types";
import { assetKindLabel, assetValue, ownershipLabel, situationLabel, stockLabel } from "./utils";

export type InventoryResult = {
  assets: InventoryAsset[];
  realEstateMap: InventoryRealEstateMap[];
  priceTables: InventoryPriceTable[];
  stockReservations: InventoryStockReservation[];
  stockItems: InventoryStockItem[];
  totalCount: number;
  rawTotalCount: number;
  sourceStats: InventorySourceStat[];
  warning?: string;
  error?: SiengeErrorDetails;
};

const LIMIT = 200;
const dataDir = path.join(process.cwd(), ".sienge-data");
const inventoryDatabasePath = path.join(dataDir, "inventory-assets.sqlite");
const SOURCE_DEFINITIONS: Array<{ key: InventorySourceKey; label: string; endpoint: string; requiresCostCenter?: boolean }> = [
  { key: "unit", label: "unidades imobiliárias", endpoint: "/v1/units" },
  { key: "movable", label: "bens móveis", endpoint: "/v1/patrimony/movable" },
  { key: "fixed", label: "bens imóveis", endpoint: "/v1/patrimony/fixed" },
  { key: "price-table", label: "tabelas de preço", endpoint: "/v1/price-tables" },
  { key: "real-estate-map", label: "mapa imobiliário", endpoint: "/v1/real-estate-map", requiresCostCenter: true },
  { key: "stock-reservation", label: "reservas de insumos", endpoint: "/v1/stock-reservations" },
  { key: "stock-inventory", label: "insumos em estoque", endpoint: "/v1/stock-inventories/{costCenterId}/items", requiresCostCenter: true }
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

function emptyInventoryResult(sourceStats: InventorySourceStat[], error?: SiengeErrorDetails): InventoryResult {
  return {
    assets: [],
    realEstateMap: [],
    priceTables: [],
    stockReservations: [],
    stockItems: [],
    totalCount: 0,
    rawTotalCount: 0,
    sourceStats,
    ...(error ? { error } : {})
  };
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

function readEndpointsByPrefix<T>(database: DatabaseSync, endpointPrefix: string) {
  const rows = database.prepare(`
    SELECT raw_json, source_day, saved_at
    FROM sienge_records
    WHERE endpoint LIKE ?
    ORDER BY saved_at DESC
  `).all(`${endpointPrefix}%`) as SqlRow[];

  return rows.map(annotate<T>).filter((item): item is T => Boolean(item));
}

function localSourceStat(source: (typeof SOURCE_DEFINITIONS)[number], loadedCount: number, configured = true): InventorySourceStat {
  return {
    key: source.key,
    label: source.label,
    endpoint: source.endpoint,
    apiCount: loadedCount,
    loadedCount,
    status: !configured ? "not_configured" : loadedCount === 0 ? "empty" : "ok"
  };
}

function readLocalInventory(): InventoryResult {
  if (!existsSync(inventoryDatabasePath)) {
    return emptyInventoryResult(
      emptySourceStats("error"),
      localDataError("Estoque sem dados carregados", "Os dados de estoque ainda não foram atualizados.")
    );
  }

  const database = openDatabase();
  try {
    if (!tableExists(database, "sienge_records")) {
      return emptyInventoryResult(
        emptySourceStats("error"),
        localDataError("Estoque ainda não disponível", "Ainda não há bens ou unidades salvos para exibição.")
      );
    }

    const hasCostCenters = configuredCostCenters().length > 0;
    const units = readEndpoint<RawInventoryUnit>(database, SOURCE_DEFINITIONS[0].endpoint).map(normalizeUnit);
    const movable = readEndpoint<RawPatrimonyAsset>(database, SOURCE_DEFINITIONS[1].endpoint).map((asset, index) => normalizePatrimony(asset, "movable", index));
    const fixed = readEndpoint<RawPatrimonyAsset>(database, SOURCE_DEFINITIONS[2].endpoint).map((asset, index) => normalizePatrimony(asset, "fixed", index));
    const priceTables = readEndpoint<InventoryPriceTable>(database, "/v1/price-tables");
    const realEstateMap = readEndpoint<InventoryRealEstateMap>(database, "/v1/real-estate-map");
    const stockReservations = readEndpoint<InventoryStockReservation>(database, "/v1/stock-reservations");
    const stockItems = readEndpointsByPrefix<InventoryStockItem>(database, "/v1/stock-inventories/");
    const assets = [...units, ...movable, ...fixed].sort((left, right) => {
      const leftValue = left.patrimonyId || left.unitId || 0;
      const rightValue = right.patrimonyId || right.unitId || 0;
      return rightValue - leftValue || assetKindLabel(left.kind).localeCompare(assetKindLabel(right.kind));
    });
    const sourceStats = [
      localSourceStat(SOURCE_DEFINITIONS[0], units.length),
      localSourceStat(SOURCE_DEFINITIONS[1], movable.length),
      localSourceStat(SOURCE_DEFINITIONS[2], fixed.length),
      localSourceStat(SOURCE_DEFINITIONS[3], priceTables.length),
      localSourceStat(SOURCE_DEFINITIONS[4], realEstateMap.length, hasCostCenters || realEstateMap.length > 0),
      localSourceStat(SOURCE_DEFINITIONS[5], stockReservations.length),
      localSourceStat(SOURCE_DEFINITIONS[6], stockItems.length, hasCostCenters || stockItems.length > 0)
    ];

    return {
      assets,
      realEstateMap,
      priceTables,
      stockReservations,
      stockItems,
      totalCount: assets.length,
      rawTotalCount: assets.length + realEstateMap.length + priceTables.length + stockReservations.length + stockItems.length,
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

async function loadPriceTables(forceRefresh = false, forceReplaceFinalized = false) {
  const page = await loadAllPages<InventoryPriceTable>((offset) =>
    estoqueApi.priceTables<InventoryPriceTable>({ limit: LIMIT, offset }, forceRefresh, forceReplaceFinalized)
  );
  return { totalCount: page.totalCount, items: page.results };
}

async function loadStockReservations(forceRefresh = false, forceReplaceFinalized = false) {
  const page = await loadAllPages<InventoryStockReservation>((offset) =>
    estoqueApi.stockReservations<InventoryStockReservation>({ limit: LIMIT, offset }, forceRefresh, forceReplaceFinalized)
  );
  return { totalCount: page.totalCount, items: page.results };
}

async function loadRealEstateMap(costCenterIds: number[], forceRefresh = false, forceReplaceFinalized = false) {
  const range = getSiengeIntegrationRange();
  const page = await loadAllPages<InventoryRealEstateMap>((offset) =>
    estoqueApi.realEstateMap<InventoryRealEstateMap>({
      limit: LIMIT,
      offset,
      costCentersId: costCenterIds,
      startDate: range.startDate,
      endDate: range.endDate
    }, forceRefresh, forceReplaceFinalized)
  );
  return { totalCount: page.totalCount, items: page.results };
}

async function loadStockInventoryItems(costCenterIds: number[], forceRefresh = false, forceReplaceFinalized = false) {
  const pages = await Promise.all(costCenterIds.map(async (costCenterId) => {
    const page = await loadAllPages<InventoryStockItem>((offset) =>
      estoqueApi.stockInventoryItems<InventoryStockItem>(costCenterId, { limit: LIMIT, offset }, forceRefresh, forceReplaceFinalized)
    );
    return {
      totalCount: page.totalCount,
      items: page.results.map((item) => ({ ...item, costCenterId }))
    };
  }));
  return {
    totalCount: pages.reduce((sum, page) => sum + page.totalCount, 0),
    items: pages.flatMap((page) => page.items)
  };
}

function configuredCostCenters() {
  return getAppSettings().inventoryCostCenterIds
    .split(/[,\s;]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function sourceStat(
  source: PromiseSettledResult<{ totalCount: number; assets?: InventoryAsset[]; items?: unknown[] }> | undefined,
  key: InventorySourceStat["key"],
  label: string,
  endpoint: string,
  configured = true
): InventorySourceStat {
  if (!configured) {
    return { key, label, endpoint, apiCount: 0, loadedCount: 0, status: "not_configured" };
  }
  if (!source) {
    return { key, label, endpoint, apiCount: 0, loadedCount: 0, status: "empty" };
  }
  if (source.status === "rejected") {
    return { key, label, endpoint, apiCount: 0, loadedCount: 0, status: "error" };
  }

  const loadedCount = (source.value.assets || source.value.items || []).length;
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

  const costCenterIds = configuredCostCenters();
  const hasCostCenters = costCenterIds.length > 0;
  const sources = await Promise.allSettled([
    loadUnits(forceRefresh, forceReplaceFinalized),
    loadMovable(forceRefresh, forceReplaceFinalized),
    loadFixed(forceRefresh, forceReplaceFinalized),
    loadPriceTables(forceRefresh, forceReplaceFinalized),
    hasCostCenters ? loadRealEstateMap(costCenterIds, forceRefresh, forceReplaceFinalized) : Promise.resolve({ totalCount: 0, items: [] as InventoryRealEstateMap[] }),
    loadStockReservations(forceRefresh, forceReplaceFinalized),
    hasCostCenters ? loadStockInventoryItems(costCenterIds, forceRefresh, forceReplaceFinalized) : Promise.resolve({ totalCount: 0, items: [] as InventoryStockItem[] })
  ]);

  const labels = SOURCE_DEFINITIONS.map((source) => source.label);
  const endpoints = SOURCE_DEFINITIONS.map((source) => source.endpoint);
  const units = sources[0].status === "fulfilled" ? sources[0].value.assets : [];
  const movable = sources[1].status === "fulfilled" ? sources[1].value.assets : [];
  const fixed = sources[2].status === "fulfilled" ? sources[2].value.assets : [];
  const loaded = [...units, ...movable, ...fixed];
  const priceTables = sources[3].status === "fulfilled" ? sources[3].value.items as InventoryPriceTable[] : [];
  const realEstateMap = sources[4].status === "fulfilled" ? sources[4].value.items as InventoryRealEstateMap[] : [];
  const stockReservations = sources[5].status === "fulfilled" ? sources[5].value.items as InventoryStockReservation[] : [];
  const stockItems = sources[6].status === "fulfilled" ? sources[6].value.items as InventoryStockItem[] : [];
  const rawTotalCount = sources.reduce((sum, source) => sum + (source.status === "fulfilled" ? source.value.totalCount : 0), 0);
  const sourceStats = [
    sourceStat(sources[0], "unit", labels[0], endpoints[0]),
    sourceStat(sources[1], "movable", labels[1], endpoints[1]),
    sourceStat(sources[2], "fixed", labels[2], endpoints[2]),
    sourceStat(sources[3], "price-table", labels[3], endpoints[3]),
    sourceStat(sources[4], "real-estate-map", labels[4], endpoints[4], hasCostCenters),
    sourceStat(sources[5], "stock-reservation", labels[5], endpoints[5]),
    sourceStat(sources[6], "stock-inventory", labels[6], endpoints[6], hasCostCenters)
  ];
  const failures = sources
    .map((source, index) => {
      if (source.status !== "rejected") return undefined;
      if ((index === 4 || index === 6) && !hasCostCenters) return undefined;
      return inventoryError(source.reason, endpoints[index], labels[index]);
    })
    .filter((item): item is SiengeErrorDetails => Boolean(item));

  if (!loaded.length && failures.length) {
    return emptyInventoryResult(sourceStats, failures[0]);
  }

  const warning = failures.length
    ? `Algumas consultas de estoque não carregaram. Verifique as permissões e tente atualizar novamente.`
    : undefined;

  const assets = loaded.sort((left, right) => {
    const leftValue = left.patrimonyId || left.unitId || 0;
    const rightValue = right.patrimonyId || right.unitId || 0;
    return rightValue - leftValue || assetKindLabel(left.kind).localeCompare(assetKindLabel(right.kind));
  });

  return { assets, realEstateMap, priceTables, stockReservations, stockItems, totalCount: assets.length, rawTotalCount, sourceStats, warning };
}

function money(value: unknown) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function addChartItem(groups: Map<string, { label: string; count: number; value: number }>, label: string, value: number) {
  const current = groups.get(label) || { label, count: 0, value: 0 };
  current.count += 1;
  current.value += value;
  groups.set(label, current);
}

function sortedGroups(groups: Map<string, { label: string; count: number; value: number }>, limit?: number) {
  const items = Array.from(groups.values()).sort((left, right) => right.value - left.value || right.count - left.count);
  return limit ? items.slice(0, limit) : items;
}

function isSaleableUnit(asset: InventoryAsset) {
  return asset.kind === "unit" && asset.commercialStock === "D";
}

function isReservedUnit(asset: InventoryAsset) {
  return asset.kind === "unit" && ["C", "P", "O", "R"].includes(asset.commercialStock || "");
}

function isSoldOrThirdPartyUnit(asset: InventoryAsset) {
  return asset.kind === "unit" && ["V", "G", "T", "L"].includes(asset.commercialStock || "");
}

function isInitialPortfolioAsset(asset: InventoryAsset) {
  return asset.kind !== "unit" || !isSoldOrThirdPartyUnit(asset);
}

function stockItemValue(item: InventoryStockItem) {
  return money(item.quantity) * money(item.averagePrice);
}

export function analyzeInventory(
  assets: InventoryAsset[],
  extras?: {
    realEstateMap?: InventoryRealEstateMap[];
    priceTables?: InventoryPriceTable[];
    stockReservations?: InventoryStockReservation[];
    stockItems?: InventoryStockItem[];
  }
): InventorySummary {
  const groups = new Map<string, { label: string; count: number; value: number }>();
  const stockGroups = new Map<string, { label: string; count: number; value: number }>();
  const ownershipGroups = new Map<string, { label: string; count: number; value: number }>();
  const enterpriseGroups = new Map<string, { label: string; count: number; value: number }>();
  const stockItemGroups = new Map<string, { label: string; count: number; value: number }>();
  const priceTables = extras?.priceTables || [];
  const realEstateMap = extras?.realEstateMap || [];
  const stockReservations = extras?.stockReservations || [];
  const stockItems = extras?.stockItems || [];

  assets.forEach((asset) => {
    const label = assetKindLabel(asset.kind);
    const value = assetValue(asset).value;
    addChartItem(groups, label, value);
    addChartItem(ownershipGroups, ownershipLabel(asset), value);
    if (asset.kind === "unit") {
      addChartItem(stockGroups, stockLabel(asset.commercialStock), value);
      addChartItem(enterpriseGroups, asset.enterpriseId ? `Empreendimento ${asset.enterpriseId}` : "Empreendimento não informado", value);
    }
  });

  stockItems.forEach((item) => {
    const label = item.resourceDescription || item.detailDescription || `Insumo ${item.resourceId || item.itemId || "-"}`;
    addChartItem(stockItemGroups, label, stockItemValue(item));
  });

  const saleableUnits = assets.filter(isSaleableUnit);
  const reservedUnits = assets.filter(isReservedUnit);
  const soldOrThirdPartyUnits = assets.filter(isSoldOrThirdPartyUnit);
  const pricedAssets = assets.filter((asset) => assetValue(asset).value > 0);
  const portfolioAssets = assets.filter(isInitialPortfolioAsset);
  const portfolioPricedAssets = portfolioAssets.filter((asset) => assetValue(asset).value > 0);
  const mapStockValue = realEstateMap.reduce((sum, item) => sum + money(item.corporateCost?.stock), 0);
  const mapVgv = realEstateMap.reduce((sum, item) => sum + money(item.vgvData?.vgv), 0);
  const mapGrossProfit = realEstateMap.reduce((sum, item) => sum + money(item.margin?.grossProfit), 0);
  const marginBase = realEstateMap.filter((item) => Number.isFinite(Number(item.margin?.grossMarginPercentage)));

  return {
    totalValue: assets.reduce((sum, asset) => sum + assetValue(asset).value, 0),
    pricedValue: pricedAssets.reduce((sum, asset) => sum + assetValue(asset).value, 0),
    portfolioValue: portfolioAssets.reduce((sum, asset) => sum + assetValue(asset).value, 0),
    portfolioPricedValue: portfolioPricedAssets.reduce((sum, asset) => sum + assetValue(asset).value, 0),
    portfolioCount: portfolioAssets.length,
    portfolioPricedCount: portfolioPricedAssets.length,
    portfolioNoValueCount: portfolioAssets.filter((asset) => assetValue(asset).value <= 0).length,
    portfolioPrivateArea: portfolioAssets.reduce((sum, asset) => sum + money(asset.privateArea), 0),
    mapStockValue,
    mapVgv,
    mapGrossProfit,
    averageMapMargin: marginBase.length
      ? marginBase.reduce((sum, item) => sum + money(item.margin?.grossMarginPercentage), 0) / marginBase.length
      : 0,
    stockInputValue: stockItems.reduce((sum, item) => sum + stockItemValue(item), 0),
    ownCount: assets.filter((asset) => ownershipLabel(asset) === "Próprio").length,
    thirdPartyCount: assets.filter((asset) => ownershipLabel(asset) === "Terceiro").length,
    unitCount: assets.filter((asset) => asset.kind === "unit").length,
    movableCount: assets.filter((asset) => asset.kind === "movable").length,
    fixedCount: assets.filter((asset) => asset.kind === "fixed").length,
    saleableUnitCount: saleableUnits.length,
    saleableUnitValue: saleableUnits.reduce((sum, asset) => sum + assetValue(asset).value, 0),
    reservedUnitCount: reservedUnits.length,
    reservedUnitValue: reservedUnits.reduce((sum, asset) => sum + assetValue(asset).value, 0),
    soldOrThirdPartyUnitCount: soldOrThirdPartyUnits.length,
    unavailableUnitCount: assets.filter((asset) => asset.kind === "unit" && !isSaleableUnit(asset)).length,
    noValueCount: assets.filter((asset) => assetValue(asset).value <= 0).length,
    pricedCount: pricedAssets.length,
    activePriceTableCount: priceTables.filter((table) => /ativ|active/i.test(table.status || "")).length,
    pendingReservationCount: stockReservations.filter((reservation) => /pend|pending/i.test(reservation.status || "")).length,
    stockInputCount: stockItems.length,
    privateArea: assets.reduce((sum, asset) => sum + money(asset.privateArea), 0),
    activeCount: assets.filter((asset) => situationLabel(asset) === "Ativo" || situationLabel(asset) === "Disponível").length,
    writtenOffCount: assets.filter((asset) => situationLabel(asset) === "Baixado").length,
    byKind: Array.from(groups.values()).sort((left, right) => right.count - left.count),
    byStock: sortedGroups(stockGroups),
    byOwnership: sortedGroups(ownershipGroups),
    byEnterprise: sortedGroups(enterpriseGroups, 8),
    stockItemsTop: sortedGroups(stockItemGroups, 8)
  };
}
