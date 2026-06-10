import type { BankMovement } from "./types";

export function movementAmount(item: BankMovement) {
  return item.bankMovementAmount || 0;
}

export function isReconciled(item: BankMovement) {
  const value = String(item.bankMovementReconcile || "").toLowerCase();
  return value === "s" || value === "sim" || value.includes("concili");
}

export function isLinked(item: BankMovement) {
  return Boolean(item.billId || item.installmentId || item.creditorId || item.clientId);
}

export function movementParty(item: BankMovement) {
  return item.creditorName || item.clientName || item.companyName || "Parte não informada";
}

export function movementDocument(item: BankMovement) {
  return [
    item.documentIdentificationId,
    item.documentIdentificationNumber
  ].filter(Boolean).join("-") || (item.billId ? `Título #${item.billId}` : `Movimento #${item.bankMovementId || "sem código"}`);
}

export function reconciliationStatus(item: BankMovement) {
  if (isReconciled(item)) return "Conciliado";
  if (isLinked(item)) return "Vinculado, não conciliado";
  return "Avulso";
}
