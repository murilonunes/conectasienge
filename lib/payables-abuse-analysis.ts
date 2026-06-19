export type PayablePaymentForReview = {
  amount?: number;
  grossAmount?: number;
  netAmount?: number;
  paymentDate?: string;
};

export type PayableChargeForReview = {
  amount?: number;
  originalAmount?: number;
  balanceAmount?: number;
  correctedBalanceAmount?: number;
  dueDate?: string;
  payments?: PayablePaymentForReview[];
};

export type PayableChargeReview = {
  originalAmount: number;
  correctedAmount: number;
  correctedIncrease: number;
  paidAmount: number;
  paidIncrease: number;
  referenceDate?: string;
  monthsLate: number;
  allowedIncrease: number;
  correctedExcess: number;
  paidExcess: number;
  hasRisk: boolean;
};

function valueOf(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function paymentAmount(payment: PayablePaymentForReview) {
  return valueOf(payment.netAmount ?? payment.grossAmount ?? payment.amount);
}

function isoDate(value?: string) {
  if (!value) return undefined;
  return value.slice(0, 10);
}

function dateAtNoon(value?: string) {
  const iso = isoDate(value);
  if (!iso) return undefined;
  const date = new Date(`${iso}T12:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function latestPaymentDate(payments: PayablePaymentForReview[]) {
  return payments
    .map((payment) => isoDate(payment.paymentDate))
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
}

function monthsLate(dueDate?: string, referenceDate?: string) {
  const due = dateAtNoon(dueDate);
  const reference = dateAtNoon(referenceDate);
  if (!due || !reference || reference <= due) return 0;
  const days = Math.ceil((reference.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return Math.ceil(days / 30);
}

export function analyzePayableCharge(item: PayableChargeForReview, fallbackReferenceDate?: string): PayableChargeReview {
  const payments = item.payments || [];
  const originalAmount = valueOf(item.originalAmount ?? item.amount);
  const paidAmount = payments.reduce((sum, payment) => sum + paymentAmount(payment), 0);
  const correctedRaw = valueOf(item.correctedBalanceAmount ?? item.balanceAmount);
  const correctedAmount = correctedRaw > 0 ? correctedRaw : paidAmount > 0 ? paidAmount : originalAmount;
  const referenceDate = latestPaymentDate(payments) || fallbackReferenceDate || new Date().toISOString().slice(0, 10);
  const lateMonths = monthsLate(item.dueDate, referenceDate);
  const allowedIncrease = originalAmount > 0 ? originalAmount * (0.02 + lateMonths * 0.01) : 0;
  const correctedIncrease = Math.max(0, correctedAmount - originalAmount);
  const paidIncrease = Math.max(0, paidAmount - originalAmount);
  const correctedExcess = Math.max(0, correctedIncrease - allowedIncrease);
  const paidExcess = Math.max(0, paidIncrease - allowedIncrease);

  return {
    originalAmount,
    correctedAmount,
    correctedIncrease,
    paidAmount,
    paidIncrease,
    referenceDate,
    monthsLate: lateMonths,
    allowedIncrease,
    correctedExcess,
    paidExcess,
    hasRisk: correctedExcess > 0.01 || paidExcess > 0.01
  };
}
