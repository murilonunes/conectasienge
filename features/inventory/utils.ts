import type { InventoryAsset, InventoryAssetKind, UnitEvaluation } from "./types";

const STOCK_LABELS: Record<string, string> = {
  C: "Reservada",
  D: "Disponível",
  R: "Reserva técnica",
  E: "Permuta",
  M: "Mútuo",
  P: "Proposta",
  V: "Vendida",
  L: "Locada",
  T: "Transferida",
  G: "Vendido/terceiros",
  O: "Pré-contrato"
};

const KIND_LABELS: Record<InventoryAssetKind, string> = {
  unit: "Unidade imobiliária",
  movable: "Bem móvel",
  fixed: "Bem imóvel"
};

export function assetKindLabel(kind: InventoryAssetKind) {
  return KIND_LABELS[kind];
}

export function stockLabel(code?: string) {
  return code ? STOCK_LABELS[code] || code : "Não informado";
}

export function situationLabel(asset: InventoryAsset) {
  if (asset.kind === "unit") return stockLabel(asset.commercialStock);
  if (asset.situation === "A") return "Ativo";
  if (asset.situation === "B") return "Baixado";
  return asset.situation || "Não informado";
}

export function ownershipLabel(asset: InventoryAsset) {
  const evidence = [
    asset.previousOswner,
    asset.accountancyOrigin,
    asset.accountancyUsageIndicator,
    asset.commercialStock === "G" ? "terceiro" : undefined
  ].filter(Boolean).join(" ").toLowerCase();

  if (evidence.includes("terceir")) return "Terceiro";
  return "Próprio";
}

export function entryDate(asset: InventoryAsset) {
  return asset.incorporationDate || asset.availableDate || asset.deliveryDate;
}

function latestEvaluation(evaluations?: UnitEvaluation[]) {
  return [...(evaluations || [])].sort((left, right) => {
    const leftTime = new Date(left.saleValueDate || left.evaluationDate || "").getTime() || 0;
    const rightTime = new Date(right.saleValueDate || right.evaluationDate || "").getTime() || 0;
    return rightTime - leftTime;
  })[0];
}

export function assetValue(asset: InventoryAsset) {
  if (asset.incorporationValue) return { value: asset.incorporationValue, source: "Valor de incorporação" };
  if (asset.depreciationActualValue) return { value: asset.depreciationActualValue, source: "Valor contábil atual" };

  const evaluation = latestEvaluation(asset.evaluation);
  if (evaluation?.saleValuePrice) return { value: evaluation.saleValuePrice, source: "Valor de venda sugerido" };
  if (evaluation?.evaluationPrice) return { value: evaluation.evaluationPrice, source: "Valor avaliado" };
  if (asset.generalSaleValueFraction) return { value: asset.generalSaleValueFraction, source: "Fração VGV" };
  if (asset.specialValues?.[0]?.indexedQuantity) return { value: asset.specialValues[0].indexedQuantity, source: "Valor especial/indexado" };
  if (asset.terrainValue) return { value: asset.terrainValue, source: "Valor do terreno" };

  return { value: 0, source: "Valor não informado" };
}

export function assetTitle(asset: InventoryAsset) {
  if (asset.name) return asset.name;
  if (asset.detail) return asset.detail;
  if (asset.brand || asset.model) return [asset.brand, asset.model].filter(Boolean).join(" ");
  if (asset.prefix) return asset.prefix;
  if (asset.patrimonyId) return `Patrimônio #${asset.patrimonyId}`;
  return asset.id;
}

export function assetSubtitle(asset: InventoryAsset) {
  if (asset.kind === "unit") {
    return `${asset.propertyType || "Tipo não informado"} - Empreendimento #${asset.enterpriseId || "-"}`;
  }

  const pieces = [
    asset.patrimonyId ? `Patrimônio #${asset.patrimonyId}` : undefined,
    asset.costCenter ? `Centro ${asset.costCenter}` : undefined,
    asset.preservation
  ].filter(Boolean);
  return pieces.join(" - ") || "Detalhes não informados";
}

export function assetLocation(asset: InventoryAsset) {
  if (asset.kind === "fixed") {
    const address = [asset.address, asset.addressNumber, asset.neighborhood, asset.city].filter(Boolean).join(", ");
    return address || asset.propertyRegistration || asset.landRegistration || "Local não informado";
  }

  if (asset.kind === "movable") {
    return asset.actualDepartment || asset.initialDepartment || asset.plateId || asset.barCode || "Local não informado";
  }

  return asset.realEstateRegistration || asset.legalRegistrationNumber || asset.contractNumber || "Matrícula não informada";
}
