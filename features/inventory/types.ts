export type InventoryAssetKind = "unit" | "movable" | "fixed";

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

export type RawInventoryUnit = Omit<InventoryAsset, "kind" | "id" | "unitId"> & {
  id: number;
};

export type RawPatrimonyAsset = Omit<InventoryAsset, "kind" | "id" | "unitId">;

export type InventorySummary = {
  totalValue: number;
  ownCount: number;
  thirdPartyCount: number;
  unitCount: number;
  movableCount: number;
  fixedCount: number;
  activeCount: number;
  writtenOffCount: number;
  byKind: { label: string; count: number; value: number }[];
};

export type InventorySourceStat = {
  key: InventoryAssetKind;
  label: string;
  endpoint: string;
  apiCount: number;
  loadedCount: number;
  status: "ok" | "empty" | "partial" | "error";
};
