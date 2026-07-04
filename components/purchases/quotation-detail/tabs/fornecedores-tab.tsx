import { SiengeSupplierPicker } from "@/components/suppliers/sienge-supplier-picker";
import type { QuotationSummary } from "@/features/quotations/data";
import { formatCurrency } from "@/lib/formatters";
import { plural } from "../helpers";
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
  const selectedCount = quotation.suppliers.filter((supplier) => supplier.selected).length;
  const negotiationCount = quotation.suppliers.reduce((sum, supplier) => sum + supplier.negotiationCount, 0);
  const quotedTotal = quotation.suppliers.reduce((sum, supplier) => sum + supplier.totalValue, 0);

  return (
    <>
      <section className="quotation-detail-stats">
        <div className="card"><strong>{quotation.suppliers.length}</strong><span>Fornecedores</span></div>
        <div className="card"><strong>{negotiationCount}</strong><span>Negociações</span></div>
        <div className="card"><strong>{selectedCount}</strong><span>Selecionados</span></div>
        <div className="card"><strong>{formatCurrency(quotedTotal)}</strong><span>Total cotado</span></div>
      </section>

      <section className="quotation-supplier-grid">
        <article className="card quotation-supplier-card quotation-add-supplier-card">
          <div>
            <span>Novo link</span>
            <h2>Fornecedor para cotar</h2>
          </div>
          <SiengeSupplierPicker
            value={supplierId}
            onChange={(next, supplier) => onSupplierChange(next, supplier)}
            compact
          />
          <button className="button" type="button" onClick={() => { onGoToTab("sienge"); onGenerateLink(); }} disabled={loadingAction !== null}>
            {loadingAction === "supplier-link" ? "Gerando..." : "Gerar link"}
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
              <span>{plural(supplier.negotiationCount, "negociação", "negociações")}</span>
              <span>{supplier.discount ? `${formatCurrency(supplier.discount)} desconto` : "Sem desconto"}</span>
              <span>{supplier.freight ? `${formatCurrency(supplier.freight)} frete` : "Sem frete"}</span>
            </div>
            {supplier.selected && <i className="badge">Selecionado</i>}
          </article>
        ))}

        {!quotation.suppliers.length && (
          <article className="card quotation-supplier-card quotation-supplier-empty">
            <div>
              <span>Lista</span>
              <h2>Nenhum fornecedor vinculado</h2>
            </div>
            <p>Gere um link para iniciar a cotação com fornecedores.</p>
          </article>
        )}
      </section>
    </>
  );
}
