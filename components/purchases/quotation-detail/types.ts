import type { QuotationItemSummary } from "@/features/quotations/data";
import type { SupplierQuoteResponseSummary } from "@/lib/supplier-quote-portal";

export type DetailTab = "resumo" | "sienge" | "insumos" | "fornecedores" | "links" | "respostas" | "mapa" | "aprovacao" | "cadastros" | "historico";

export type SiengeAction = "create" | "attach-items" | "add-supplier" | "add-item";

export type NegotiationDispatch = {
  response: SupplierQuoteResponseSummary;
  selectedItems?: number[];
  authorize?: boolean;
};

export type ApprovalMode = "quotation" | "item";

export type GeneratedSupplierLink = {
  url: string;
  supplierName?: string;
  document?: string;
  expiresAt?: string;
};

export type ItemComparisonOffer = {
  responseId: number;
  supplierName: string;
  document: string;
  registrationPending: boolean;
  hasResponse: boolean;
  attends: boolean;
  partial: boolean;
  hasPrice: boolean;
  unitPrice: number;
  quantity: number;
  deadlineDays: number;
  total: number;
  notes: string;
};

export type ItemComparisonRow = {
  itemNumber: number;
  item?: QuotationItemSummary;
  offers: ItemComparisonOffer[];
  best?: ItemComparisonOffer;
};

export type DetailTabGroup = "Visão" | "Operação" | "Fornecedor" | "Decisão";

export const tabs: Array<{ key: DetailTab; label: string; group: DetailTabGroup }> = [
  { key: "resumo", label: "Resumo", group: "Visão" },
  { key: "insumos", label: "Insumos", group: "Visão" },
  { key: "sienge", label: "Sienge", group: "Operação" },
  { key: "fornecedores", label: "Fornecedores", group: "Fornecedor" },
  { key: "links", label: "Links", group: "Fornecedor" },
  { key: "respostas", label: "Respostas", group: "Fornecedor" },
  { key: "cadastros", label: "Cadastros", group: "Fornecedor" },
  { key: "mapa", label: "Mapa", group: "Decisão" },
  { key: "aprovacao", label: "Aprovar", group: "Decisão" },
  { key: "historico", label: "Histórico", group: "Decisão" }
];
