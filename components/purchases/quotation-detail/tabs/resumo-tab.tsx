import { I18nText } from "@/components/i18n/i18n-text";
import type { QuotationSummary, QuotationSupplierSummary } from "@/features/quotations/data";
import { formatCurrency, formatOptionalDate } from "@/lib/formatters";
import { suggestedNextAction } from "../helpers";

export function ResumoTab({ quotation, bestSupplier, hasPortalResponses }: { quotation: QuotationSummary; bestSupplier?: QuotationSupplierSummary; hasPortalResponses: boolean }) {
  return (
    <>
      <section className="quotation-detail-stats">
        <div className="card"><strong>{quotation.itemCount}</strong><span><I18nText text={"Insumos"} /></span></div>
        <div className="card"><strong>{quotation.supplierCount}</strong><span><I18nText text={"Fornecedores"} /></span></div>
        <div className="card"><strong>{quotation.responseCount}</strong><span><I18nText text={"Propostas"} /></span></div>
        <div className="card"><strong>{formatCurrency(quotation.totalValue)}</strong><span><I18nText text={"Total recebido"} /></span></div>
      </section>

      <section className="grid-main">
        <div className="card panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title"><I18nText text={"Melhor proposta"} /></h2>
              <span className="panel-note"><I18nText text={"Menor valor total recebido para esta cotação até agora"} /></span>
            </div>
          </div>
          {bestSupplier ? (
            <div className="quotation-best-supplier">
              <strong>{bestSupplier.supplierName}</strong>
              <span>{formatCurrency(bestSupplier.totalValue)}</span>
              <small><I18nText text={bestSupplier.selected ? "Fornecedor selecionado" : "Ainda não selecionado"} /></small>
            </div>
          ) : (
            <div className="empty-state"><I18nText text={"Ainda não há proposta com valor para decisão."} /></div>
          )}
        </div>
        <div className="card panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title"><I18nText text={"Operação"} /></h2>
              <span className="panel-note"><I18nText text={"Onde esta cotação está e o que falta para fechar a decisão"} /></span>
            </div>
          </div>
          <div className="quotation-next-actions">
            <span><strong><I18nText text={"Status"} /></strong><I18nText text={quotation.status} /></span>
            <span><strong><I18nText text={"Ação"} /></strong><I18nText text={suggestedNextAction(quotation)} /></span>
            <span><strong><I18nText text={"Sienge"} /></strong>{quotation.integratedAt ? formatOptionalDate(quotation.integratedAt) : <I18nText text={"Pendente"} />}</span>
            <span><strong><I18nText text={"Mapa"} /></strong><I18nText text={hasPortalResponses ? "Pronto" : "Aguardando"} /></span>
          </div>
        </div>
      </section>
    </>
  );
}
