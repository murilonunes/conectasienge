import type { PurchaseRequestForQuotation, QuotationStatus, QuotationSummary } from "@/features/quotations/data";

export const statusOrder: QuotationStatus[] = [
  "Registrada",
  "Em negociação",
  "Pronta para decisão",
  "Negociação fechada",
  "Sem fornecedores"
];

export function statusClass(status: QuotationStatus) {
  if (status === "Sem fornecedores") return "pending";
  if (status === "Pronta para decisão") return "late";
  return "";
}

export function statusNote(status: QuotationStatus) {
  if (status === "Sem fornecedores") return "Fornecedor";
  if (status === "Registrada") return "Nova";
  if (status === "Em negociação") return "Negociação";
  if (status === "Pronta para decisão") return "Decisão";
  return "Fechada";
}

export function requestPayload(request: PurchaseRequestForQuotation) {
  return {
    source: "purchase-request",
    purchaseRequestId: request.purchaseRequestId,
    items: request.items.map((item) => ({
      purchaseRequestId: request.purchaseRequestId,
      purchaseRequestItemNumber: item.itemNumber,
      deliveryRequirementNumber: 1
    }))
  };
}

export function quotationRequestLabel(requestIds: number[]) {
  return requestIds.length ? requestIds.map((requestId) => `SC-${requestId}`).join(", ") : "Não identificada";
}

export const quotationCsvColumns = [
  { header: "Cotação", value: (item: unknown) => (item as QuotationSummary).code },
  { header: "Solicitação de origem", value: (item: unknown) => quotationRequestLabel((item as QuotationSummary).purchaseRequestIds) },
  { header: "Status", value: (item: unknown) => (item as QuotationSummary).status },
  { header: "Comprador", value: (item: unknown) => (item as QuotationSummary).buyerId },
  { header: "Data", value: (item: unknown) => (item as QuotationSummary).date },
  { header: "Prazo", value: (item: unknown) => (item as QuotationSummary).deadline },
  { header: "Insumos", value: (item: unknown) => (item as QuotationSummary).itemCount },
  { header: "Fornecedores", value: (item: unknown) => (item as QuotationSummary).supplierCount },
  { header: "Propostas", value: (item: unknown) => (item as QuotationSummary).responseCount },
  { header: "Valor total", value: (item: unknown) => (item as QuotationSummary).totalValue },
  { header: "Fornecedor selecionado", value: (item: unknown) => (item as QuotationSummary).selectedSupplier }
];
