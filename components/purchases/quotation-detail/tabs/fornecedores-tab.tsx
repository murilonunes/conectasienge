import { SiengeSupplierPicker } from "@/components/suppliers/sienge-supplier-picker";
import type { QuotationSummary } from "@/features/quotations/data";
import { formatCurrency, formatOptionalDate } from "@/lib/formatters";
import { formatDocument, plural } from "../helpers";
import type { GeneratedSupplierLink } from "../types";
import type { DetailTab } from "../types";

export function FornecedoresTab({
  quotation,
  supplierId,
  onSupplierChange,
  onGoToTab,
  onGenerateLink,
  generatedLink,
  linkMessage,
  onDismissGeneratedLink,
  onCopyLink,
  loadingAction
}: {
  quotation: QuotationSummary;
  supplierId: string;
  onSupplierChange: (id: string, supplier?: { document?: string; name?: string }) => void;
  onGoToTab: (tab: DetailTab) => void;
  onGenerateLink: () => void;
  generatedLink?: GeneratedSupplierLink;
  linkMessage: string;
  onDismissGeneratedLink: () => void;
  onCopyLink: (url: string) => void;
  loadingAction: string | null;
}) {
  const selectedCount = quotation.suppliers.filter((supplier) => supplier.selected).length;
  const negotiationCount = quotation.suppliers.reduce((sum, supplier) => sum + supplier.negotiationCount, 0);
  const quotedTotal = quotation.suppliers.reduce((sum, supplier) => sum + supplier.totalValue, 0);
  const canGenerateLink = Boolean(supplierId.trim());

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
            <span>Portal do fornecedor</span>
            <h2>Fornecedor para cotar</h2>
          </div>
          <SiengeSupplierPicker
            value={supplierId}
            onChange={(next, supplier) => onSupplierChange(next, supplier)}
            label="Fornecedor"
            required
            compact
          />
          <p className="quotation-supplier-flow-note">
            Escolha o fornecedor e gere o convite do portal aqui. A aba Links fica para acompanhar, copiar novamente, regerar ou revogar.
          </p>
          <button className="button" type="button" onClick={onGenerateLink} disabled={!canGenerateLink || loadingAction !== null}>
            {loadingAction === "supplier-link" ? "Gerando..." : "Gerar link"}
          </button>
          {!canGenerateLink && <small className="table-muted">Informe ou busque o ID do fornecedor para liberar o link.</small>}
          {linkMessage && !generatedLink && <div className="settings-inline-message">{linkMessage}</div>}
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

      {generatedLink && (
        <div className="settings-modal-backdrop quotation-link-modal-backdrop" role="presentation">
          <div className="settings-modal quotation-link-modal" role="dialog" aria-modal="true" aria-labelledby="quotation-link-modal-title">
            <div className="settings-modal-head">
              <div>
                <span>Portal do fornecedor</span>
                <h2 id="quotation-link-modal-title">Link gerado</h2>
                <p>O convite foi salvo na cotação e já pode ser enviado ao fornecedor.</p>
              </div>
              <button type="button" onClick={onDismissGeneratedLink}>Fechar</button>
            </div>

            {linkMessage && <div className="settings-inline-message">{linkMessage}</div>}

            <div className="quotation-copy-link quotation-link-modal-copy">
              <input readOnly value={generatedLink.url} onFocus={(event) => event.currentTarget.select()} />
              <button className="button" type="button" onClick={() => onCopyLink(generatedLink.url)}>
                Copiar
              </button>
              <a className="button secondary" href={generatedLink.url} target="_blank" rel="noreferrer">
                Abrir
              </a>
            </div>

            <div className="quotation-link-meta">
              <span><strong>Fornecedor</strong>{generatedLink.supplierName || "Não informado"}</span>
              <span><strong>Documento</strong>{generatedLink.document ? formatDocument(generatedLink.document) : "Não informado"}</span>
              <span><strong>Validade</strong>{generatedLink.expiresAt ? formatOptionalDate(generatedLink.expiresAt) : "7 dias"}</span>
              <span><strong>Status</strong>Aguardando resposta</span>
            </div>

            <div className="settings-modal-footer">
              <span>Depois do envio, acompanhe resposta, validade e revogação pela aba Links.</span>
              <button className="button secondary" type="button" onClick={() => { onDismissGeneratedLink(); onGoToTab("links"); }}>
                Ver links da cotação
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
