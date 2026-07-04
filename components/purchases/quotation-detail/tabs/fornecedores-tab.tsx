import { SiengeSupplierPicker } from "@/components/suppliers/sienge-supplier-picker";
import type { QuotationSummary } from "@/features/quotations/data";
import { formatCurrency } from "@/lib/formatters";
import type { DetailTab } from "../types";

export function FornecedoresTab({
  quotation,
  supplierId,
  onSupplierChange,
  onGoToTab,
  onGenerateLink,
  loadingAction
}: {
  quotation: QuotationSummary;
  supplierId: string;
  onSupplierChange: (id: string, supplier?: { document?: string; name?: string }) => void;
  onGoToTab: (tab: DetailTab) => void;
  onGenerateLink: () => void;
  loadingAction: string | null;
}) {
  return (
    <section className="quotation-supplier-grid">
      <article className="card quotation-supplier-card quotation-add-supplier-card">
        <div>
          <span>Novo fornecedor</span>
          <h2>Enviar link de cotação</h2>
        </div>
        <SiengeSupplierPicker
          value={supplierId}
          onChange={(next, supplier) => onSupplierChange(next, supplier)}
          compact
        />
        <button className="button" type="button" onClick={() => { onGoToTab("sienge"); onGenerateLink(); }} disabled={loadingAction !== null}>
          Gerar link
        </button>
      </article>
      {quotation.suppliers.map((supplier) => (
        <article className="card quotation-supplier-card" key={supplier.supplierId}>
          <div>
            <span>Fornecedor</span>
            <h2>{supplier.supplierName}</h2>
          </div>
          <strong>{formatCurrency(supplier.totalValue)}</strong>
          <div className="quotation-supplier-meta">
            <span>{supplier.negotiationCount} negociação(ões)</span>
            <span>{supplier.discount ? `${formatCurrency(supplier.discount)} desconto` : "Sem desconto"}</span>
            <span>{supplier.freight ? `${formatCurrency(supplier.freight)} frete` : "Sem frete"}</span>
          </div>
          {supplier.selected && <i className="badge">Selecionado</i>}
        </article>
      ))}
    </section>
  );
}
