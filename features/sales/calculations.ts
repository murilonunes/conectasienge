import type { PaymentCondition, SalesContract } from "./types";

export function salesConditionValue(condition: PaymentCondition) {
  return condition.totalValueInterest || condition.totalValue || condition.outstandingBalance || 0;
}

export function isExchangeCondition(condition: PaymentCondition) {
  return String(condition.conditionTypeId || "").toUpperCase() === "PE"
    || /permuta|da[cç][aã]o|bem/i.test(condition.conditionTypeName || "");
}

export function salesContractGrossValue(contract: SalesContract) {
  return contract.totalSellingValue || contract.value || 0;
}

export function salesContractExchangeValue(contract: SalesContract) {
  return (contract.paymentConditions || [])
    .filter(isExchangeCondition)
    .reduce((sum, condition) => sum + salesConditionValue(condition), 0);
}

export function salesContractNetValue(contract: SalesContract) {
  return Math.max(0, salesContractGrossValue(contract) - salesContractExchangeValue(contract));
}

export function salesFinancialConditions(contract: SalesContract) {
  return (contract.paymentConditions || []).filter((condition) => !isExchangeCondition(condition));
}
