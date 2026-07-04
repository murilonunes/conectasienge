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

export const tabs: Array<{ key: DetailTab; label: string }> = [
  { key: "resumo", label: "Resumo" },
  { key: "sienge", label: "Sienge" },
  { key: "insumos", label: "Insumos" },
  { key: "fornecedores", label: "Fornecedores" },
  { key: "links", label: "Links" },
  { key: "respostas", label: "Respostas" },
  { key: "mapa", label: "Mapa" },
  { key: "aprovacao", label: "Aprovar" },
  { key: "cadastros", label: "Cadastros" },
  { key: "historico", label: "Histórico" }
];
