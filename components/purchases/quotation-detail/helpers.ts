import type { QuotationSummary } from "@/features/quotations/data";
import { formatCurrency } from "@/lib/formatters";
import type { SupplierQuoteCommercialTerms, SupplierQuoteEventSummary, SupplierQuoteResponseSummary } from "@/lib/supplier-quote-portal";
import type { SiengeAction } from "./types";

export function csvCell(value: string | number) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadCsv(fileName: string, rows: Array<Array<string | number>>) {
  const csv = `﻿${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportComparison(quotation: QuotationSummary) {
  const rows = [
    ["Cotação", "Fornecedor", "Total", "Desconto", "Frete", "Selecionado", "Última resposta"],
    ...quotation.suppliers.map((supplier) => [
      quotation.code,
      supplier.supplierName,
      supplier.totalValue,
      supplier.discount,
      supplier.freight,
      supplier.selected ? "Sim" : "Não",
      supplier.lastResponse || ""
    ])
  ];
  downloadCsv(`cotacao-${quotation.code}-mapa.csv`, rows);
}

export function suggestedNextAction(quotation: QuotationSummary) {
  if (!quotation.items.length) return "Vincular insumos da solicitação";
  if (!quotation.suppliers.length) return "Adicionar fornecedores";
  if (!quotation.responseCount) return "Aguardar propostas";
  if (!quotation.selectedSupplier) return "Escolher fornecedor vencedor";
  return "Acompanhar pedido de compra";
}

export function numberOrUndefined(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export const siengeActionQuestions: Record<SiengeAction, string> = {
  create: "Criar esta cotação no Sienge agora?",
  "attach-items": "Vincular este item da solicitação de compra à cotação no Sienge agora?",
  "add-supplier": "Incluir este fornecedor no item da cotação no Sienge agora?",
  "add-item": "Criar este insumo direto na cotação no Sienge agora?"
};

export function confirmSiengeWrite(question: string) {
  return window.confirm(`${question}\n\nEsta ação grava direto no Sienge em produção e não pode ser desfeita por aqui.`);
}

export function paymentSummary(terms: SupplierQuoteCommercialTerms) {
  const options: string[] = [];
  if (terms.offersCash) {
    options.push(terms.cashDiscountPercentage > 0 ? `À vista, ${terms.cashDiscountPercentage}% de desconto` : "À vista");
  }
  if (terms.offersTerm) {
    const termSummary = terms.installments
      .filter((installment) => installment.percentage > 0)
      .map((installment) => `${installment.percentage}% em ${installment.days}d`)
      .join(" + ");
    options.push(termSummary || "A prazo");
  }
  return options.join(" | ") || "Não informado";
}

export function freightSummary(terms: SupplierQuoteCommercialTerms) {
  const freight = terms.freightType === "INCLUDED"
    ? "Frete incluso"
    : terms.freightType === "PAID"
      ? `A pagar - ${formatCurrency(terms.freightPrice)}`
      : "Sem frete";
  return terms.deliveryDays > 0 ? `${freight} | Entrega em ${terms.deliveryDays} dia(s)` : freight;
}

export function formatDocument(value: string) {
  const clean = value.replace(/\D/g, "");
  if (clean.length === 11) return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (clean.length === 14) return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return value || "Sem documento";
}

export function registrationText(registration: Record<string, unknown> | undefined, field: string) {
  const value = registration?.[field];
  return typeof value === "string" ? value.trim() : "";
}

export function eventTypeLabel(type: SupplierQuoteEventSummary["type"]) {
  const labels: Record<SupplierQuoteEventSummary["type"], string> = {
    link_sent: "Link enviado",
    link_revoked: "Link revogado",
    response_received: "Resposta recebida",
    supplier_approved: "Fornecedor aprovado",
    integration_error: "Erro de integração",
    sienge_created: "Criação no Sienge"
  };
  return labels[type];
}

export function eventTypeClass(type: SupplierQuoteEventSummary["type"]) {
  if (type === "integration_error" || type === "link_revoked") return "late";
  if (type === "link_sent") return "warn";
  return "";
}

export function exportSupplierResponses(quotation: QuotationSummary, responses: SupplierQuoteResponseSummary[]) {
  const rows = [
    ["Cotação", "Resposta", "Fornecedor", "Documento", "Cadastro pendente", "Pagamento", "Frete", "Observação geral", "Item", "Atende", "Quantidade", "Valor unitário", "Total item", "Prazo dias", "Observação"],
    ...responses.flatMap((response) => response.items.map((item) => {
      const quotationItem = quotation.items.find((current) => current.itemNumber === item.itemNumber);
      const total = item.attends ? (item.unitPrice || 0) * (item.quantity || 0) : 0;
      return [
        quotation.code,
        response.id,
        response.supplierName,
        response.document,
        response.registrationPending ? "Sim" : "Não",
        paymentSummary(response.commercialTerms),
        freightSummary(response.commercialTerms),
        response.commercialTerms.generalNotes || "",
        quotationItem?.name || `Item ${item.itemNumber}`,
        item.attends ? "Sim" : "Não",
        item.quantity || 0,
        item.unitPrice || 0,
        total,
        item.deadlineDays || 0,
        item.notes || ""
      ];
    }))
  ];
  downloadCsv(`cotacao-${quotation.code}-respostas-fornecedores.csv`, rows);
}

export function exportItemComparison(quotation: QuotationSummary, responses: SupplierQuoteResponseSummary[]) {
  const bestByItem = new Map<number, { responseId: number; unitPrice: number }>();

  responses.forEach((response) => {
    response.items.forEach((item) => {
      if (!item.attends || item.unitPrice == null) return;
      const current = bestByItem.get(item.itemNumber);
      if (!current || item.unitPrice < current.unitPrice) {
        bestByItem.set(item.itemNumber, { responseId: response.id, unitPrice: item.unitPrice });
      }
    });
  });

  const rows = [
    ["Cotação", "Item", "Fornecedor", "Documento", "Atende", "Qtd. solicitada", "Qtd. atendida", "Unidade", "Valor unitário", "Total item", "Prazo dias", "Observação", "Melhor preço", "Pagamento", "Frete"],
    ...responses.flatMap((response) => response.items.map((item) => {
      const quotationItem = quotation.items.find((current) => current.itemNumber === item.itemNumber);
      const total = item.attends ? (item.unitPrice || 0) * (item.quantity || 0) : 0;
      const best = bestByItem.get(item.itemNumber);
      return [
        quotation.code,
        quotationItem?.name || `Item ${item.itemNumber}`,
        response.supplierName,
        response.document,
        item.attends ? "Sim" : "Não",
        quotationItem?.quantity || 0,
        item.quantity || 0,
        quotationItem?.unit || "",
        item.unitPrice || 0,
        total,
        item.deadlineDays || 0,
        item.notes || "",
        best?.responseId === response.id ? "Sim" : "Não",
        paymentSummary(response.commercialTerms),
        freightSummary(response.commercialTerms)
      ];
    }))
  ];
  downloadCsv(`cotacao-${quotation.code}-mapa-item-a-item.csv`, rows);
}
