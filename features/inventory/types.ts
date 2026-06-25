export type InventoryAssetKind = "unit" | "movable" | "fixed";
export type InventorySourceKey = InventoryAssetKind | "price-table" | "real-estate-map" | "stock-reservation" | "stock-inventory";

export type UnitEvaluation = {
  id?: number;
  evaluationDate?: string;
  evaluationPrice?: number;
  saleValueDate?: string;
  saleValuePrice?: number;
};

export type InventoryAsset = {
  kind: InventoryAssetKind;
  id: string;
  patrimonyId?: number;
  unitId?: number;
  enterpriseId?: number;
  contractId?: number;
  indexerId?: number;
  name?: string;
  detail?: string;
  propertyType?: string;
  note?: string;
  observation?: string;
  commercialStock?: string;
  legalStock?: string;
  constructionStock?: string;
  situation?: string;
  preservation?: string;
  costCenter?: number | string;
  legalRegistrationNumber?: string;
  realEstateRegistration?: string;
  propertyRegistration?: string;
  landRegistration?: string;
  previousOswner?: string;
  deliveryDate?: string;
  availableDate?: string;
  incorporationDate?: string;
  incorporationValue?: number;
  depreciationActualValue?: number;
  depreciationLastDate?: string;
  privateArea?: number;
  commonArea?: number;
  terrainArea?: number;
  usableArea?: number;
  idealFraction?: number;
  idealFractionSquareMeter?: number;
  generalSaleValueFraction?: number;
  indexedQuantity?: number;
  terrainValue?: number;
  iptuValue?: number;
  contractNumber?: string;
  evaluation?: UnitEvaluation[];
  specialValues?: { tablePricesID?: number; indexedQuantity?: number }[];
  groupings?: { groupingDescription?: string; valueGroupingDescription?: string }[];
  childUnits?: { name?: string; order?: string; privateArea?: number }[];
  address?: string;
  addressNumber?: string;
  addressComplement?: string;
  neighborhood?: string;
  city?: string;
  postalCode?: string;
  prefix?: string;
  brand?: string;
  model?: string | number;
  barCode?: string;
  plateId?: string;
  serialNumber?: string;
  color?: string;
  initialDepartment?: string;
  actualDepartment?: string;
  accountancyOrigin?: string;
  accountancyIdentity?: string;
  accountancyUsageIndicator?: string;
};

export type InventoryRealEstateMap = {
  enterpriseData?: {
    companyId?: number;
    companyName?: string;
    enterpriseId?: number;
    enterpriseName?: string;
    units?: number;
    monthYear?: string;
  };
  vgvData?: {
    vgv?: number;
    vgvVariation?: number;
    poc?: number;
    variationPoc?: number;
  };
  corporateCost?: {
    stock?: number;
    guarantee?: number;
    commission?: number;
  };
  margin?: {
    grossProfit?: number;
    grossMarginPercentage?: number;
  };
  __siengeIntegrationDay?: string;
  __siengeIntegratedAt?: string;
};

export type InventoryPriceTable = {
  id?: number;
  version?: number;
  companyId?: number;
  enterpriseId?: number;
  name?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  __siengeIntegrationDay?: string;
  __siengeIntegratedAt?: string;
};

export type InventoryStockReservation = {
  id?: number;
  reservationDate?: string;
  status?: string;
  notes?: string;
  sourceCostCenter?: { id?: number; description?: string };
  destinationCostCenter?: { id?: number; description?: string };
  movementType?: { id?: number; description?: string };
  responsible?: { id?: number; name?: string };
  __siengeIntegrationDay?: string;
  __siengeIntegratedAt?: string;
};

export type InventoryStockItem = {
  itemId?: number;
  resourceId?: number;
  resourceDescription?: string;
  detailDescription?: string;
  trademarkDescription?: string;
  quantity?: number;
  unitOfMeasure?: string;
  averagePrice?: number;
  costCenterId?: number;
  __siengeIntegrationDay?: string;
  __siengeIntegratedAt?: string;
};

export type RawInventoryUnit = Omit<InventoryAsset, "kind" | "id" | "unitId"> & {
  id: number;
};

export type RawPatrimonyAsset = Omit<InventoryAsset, "kind" | "id" | "unitId">;

export type InventorySummary = {
  totalValue: number;
  pricedValue: number;
  portfolioValue: number;
  portfolioPricedValue: number;
  portfolioCount: number;
  portfolioPricedCount: number;
  portfolioNoValueCount: number;
  portfolioPrivateArea: number;
  mapStockValue: number;
  mapVgv: number;
  mapGrossProfit: number;
  averageMapMargin: number;
  stockInputValue: number;
  ownCount: number;
  thirdPartyCount: number;
  unitCount: number;
  movableCount: number;
  fixedCount: number;
  saleableUnitCount: number;
  saleableUnitValue: number;
  reservedUnitCount: number;
  reservedUnitValue: number;
  soldOrThirdPartyUnitCount: number;
  unavailableUnitCount: number;
  noValueCount: number;
  pricedCount: number;
  activePriceTableCount: number;
  pendingReservationCount: number;
  stockInputCount: number;
  privateArea: number;
  activeCount: number;
  writtenOffCount: number;
  byKind: { label: string; count: number; value: number }[];
  byStock: { label: string; count: number; value: number }[];
  byOwnership: { label: string; count: number; value: number }[];
  byEnterprise: { label: string; count: number; value: number }[];
  stockItemsTop: { label: string; count: number; value: number }[];
};

export type InventorySourceStat = {
  key: InventorySourceKey;
  label: string;
  endpoint: string;
  apiCount: number;
  loadedCount: number;
  status: "ok" | "empty" | "partial" | "error" | "not_configured";
};
