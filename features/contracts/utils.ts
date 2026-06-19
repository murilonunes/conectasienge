import type { SupplyContract } from "./types";

export function contractValue(contract: SupplyContract) {
  return Number(contract.totalValue ?? contract.contractValue ?? contract.value ?? 0) || 0;
}

export function measuredValue(contract: SupplyContract) {
  return Number(contract.measuredAmount ?? contract.accumulatedMeasuredValue ?? 0) || 0;
}

export function balanceValue(contract: SupplyContract) {
  const explicit = Number(contract.balanceAmount);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return Math.max(0, contractValue(contract) - measuredValue(contract));
}

export function contractStatus(contract: SupplyContract) {
  return String(contract.situation || contract.status || "Situação não informada");
}

export function isClosedContract(contract: SupplyContract) {
  return /cancel|encer|final|distrat|rescind|baixad|conclu/i.test(contractStatus(contract));
}
