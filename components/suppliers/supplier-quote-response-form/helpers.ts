import type { QuotationItemSummary } from "@/features/quotations/data";
import { formatCurrency } from "@/lib/formatters";
import type { FreightType, InstallmentRow, ResponseItem } from "./types";

export function defaultInstallments(): InstallmentRow[] {
  return [];
}

export function initialItems(items: QuotationItemSummary[]): ResponseItem[] {
  return items.map((item) => ({
    itemNumber: item.itemNumber,
    attends: false,
    partial: false,
    unitPrice: "",
    quantity: String(item.quantity || ""),
    deadlineDays: "",
    notes: ""
  }));
}

export function formatDocument(value: string) {
  const clean = value.replace(/\D/g, "");
  if (clean.length === 11) return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (clean.length === 14) return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return value;
}

export function itemTotal(item: ResponseItem) {
  if (!item.attends) return 0;
  return Number(item.unitPrice || 0) * Number(item.quantity || 0);
}

export function termSummaryText(installments: InstallmentRow[]) {
  const parts = installments
    .filter((installment) => Number(installment.percentage) > 0)
    .map((installment) => `${Number(installment.percentage) || 0}% em ${Number(installment.days) || 0} dia(s)`);
  return parts.length ? parts.join(" + ") : "A prazo";
}

export function cashSummaryText(cashDiscountPercentage: string) {
  const discount = Number(cashDiscountPercentage) || 0;
  return discount > 0 ? `À vista com ${discount}% de desconto` : "À vista";
}

export function freightSummaryText(freightType: FreightType, freightPrice: string, deliveryDays?: string | number) {
  const freightText = freightType === "INCLUDED"
    ? "Frete incluso"
    : freightType === "PAID"
      ? `A pagar - ${formatCurrency(Number(freightPrice) || 0)}`
      : freightType === "NONE"
        ? "Sem frete"
        : "Não informado";
  const days = Number(deliveryDays || 0);
  return days > 0 ? `${freightText} | Entrega em ${days} dia(s)` : freightText;
}
