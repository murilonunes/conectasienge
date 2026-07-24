import { I18nText } from "@/components/i18n/i18n-text";
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
        <div className="card"><strong>{quotation.suppliers.length}</strong><span><I18nText text={"Fornecedores"} /></span></div>
        <div className="card"><strong>{negotiationCount}</strong><span><I18nText text={"Negociações"} /></span></div>
        <div className="card"><strong>{selectedCount}</strong><span><I18nText text={"Selecionados"} /></span></div>
        <div className="card"><strong>{formatCurrency(quotedTotal)}</strong><span><I18nText text={"Total cotado"} /></span></div>
      </section>

      <section className="quotation-supplier-grid">
        <article className="card quotation-supplier-card quotation-add-supplier-card">
          <div>
            <span><I18nText text={"Portal do fornecedor"} /></span>
            <h2><I18nText text={"Fornecedor para cotar"} /></h2>
          </div>
          <SiengeSupplierPicker
            value={supplierId}
            onChange={(next, supplier) => onSupplierChange(next, supplier)}
            label="Fornecedor"
            required
            compact
          />
          <p className="quotation-supplier-flow-note">
            <I18nText text={"Escolha o fornecedor e gere o convite do portal aqui. A aba Links fica para acompanhar, copiar novamente, regerar ou revogar."} />
          </p>
          <button className="button" type="button" onClick={onGenerateLink} disabled={!canGenerateLink || loadingAction !== null}>
            <I18nText text={loadingAction === "supplier-link" ? "Gerando..." : "Gerar link"} />
          </button>
          {!canGenerateLink && <small className="table-muted"><I18nText text={"Informe ou busque o ID do fornecedor para liberar o link."} /></small>}
          {linkMessage && !generatedLink && <div className="settings-inline-message">{linkMessage}</div>}
        </article>

        {quotation.suppliers.map((supplier) => (
          <article className="card quotation-supplier-card" key={supplier.supplierId}>
            <div>
              <span><I18nText text={"Fornecedor"} /></span>
              <h2>{supplier.supplierName}</h2>
            </div>
            <strong>{formatCurrency(supplier.totalValue)}</strong>
            <div className="quotation-supplier-meta">
              <span>{plural(supplier.negotiationCount, "negociação", "negociações")}</span>
              <span>{supplier.discount ? `${formatCurrency(supplier.discount)} desconto` : <I18nText text={"Sem desconto"} />}</span>
              <span>{supplier.freight ? `${formatCurrency(supplier.freight)} frete` : <I18nText text={"Sem frete"} />}</span>
            </div>
            {supplier.selected && <i className="badge"><I18nText text={"Selecionado"} /></i>}
          </article>
        ))}

        {!quotation.suppliers.length && (
          <article className="card quotation-supplier-card quotation-supplier-empty">
            <div>
              <span><I18nText text={"Lista"} /></span>
              <h2><I18nText text={"Nenhum fornecedor vinculado"} /></h2>
            </div>
            <p><I18nText text={"Gere um link para iniciar a cotação com fornecedores."} /></p>
          </article>
        )}
      </section>

      {generatedLink && (
        <div className="settings-modal-backdrop quotation-link-modal-backdrop" role="presentation">
          <div className="settings-modal quotation-link-modal" role="dialog" aria-modal="true" aria-labelledby="quotation-link-modal-title">
            <div className="settings-modal-head">
              <div>
                <span><I18nText text={"Portal do fornecedor"} /></span>
                <h2 id="quotation-link-modal-title"><I18nText text={"Link gerado"} /></h2>
                <p><I18nText text={"O convite foi salvo na cotação e já pode ser enviado ao fornecedor."} /></p>
              </div>
              <button type="button" onClick={onDismissGeneratedLink}><I18nText text={"Fechar"} /></button>
            </div>

            {linkMessage && <div className="settings-inline-message">{linkMessage}</div>}

            <div className="quotation-copy-link quotation-link-modal-copy">
              <input readOnly value={generatedLink.url} onFocus={(event) => event.currentTarget.select()} />
              <button className="button" type="button" onClick={() => onCopyLink(generatedLink.url)}>
                <I18nText text={"Copiar"} />
              </button>
              <a className="button secondary" href={generatedLink.url} target="_blank" rel="noreferrer">
                <I18nText text={"Abrir"} />
              </a>
            </div>

            <div className="quotation-link-meta">
              <span><strong><I18nText text={"Fornecedor"} /></strong>{generatedLink.supplierName || <I18nText text={"Não informado"} />}</span>
              <span><strong><I18nText text={"Documento"} /></strong>{generatedLink.document ? formatDocument(generatedLink.document) : <I18nText text={"Não informado"} />}</span>
              <span><strong><I18nText text={"Validade"} /></strong>{generatedLink.expiresAt ? formatOptionalDate(generatedLink.expiresAt) : <I18nText text={"7 dias"} />}</span>
              <span><strong><I18nText text={"Status"} /></strong><I18nText text={"Aguardando resposta"} /></span>
            </div>

            <div className="settings-modal-footer">
              <span><I18nText text={"Depois do envio, acompanhe resposta, validade e revogação pela aba Links."} /></span>
              <button className="button secondary" type="button" onClick={() => { onDismissGeneratedLink(); onGoToTab("links"); }}>
                <I18nText text={"Ver links da cotação"} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
