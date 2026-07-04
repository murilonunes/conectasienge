import type { QuotationSummary, QuotationSupplierSummary } from "@/features/quotations/data";
import { formatCurrency, formatOptionalDate } from "@/lib/formatters";
import { suggestedNextAction } from "../helpers";

export function ResumoTab({ quotation, bestSupplier, hasPortalResponses }: { quotation: QuotationSummary; bestSupplier?: QuotationSupplierSummary; hasPortalResponses: boolean }) {
  return (
    <>
      <section className="quotation-detail-stats">
        <div className="card"><strong>{quotation.itemCount}</strong><span>Insumos</span></div>
        <div className="card"><strong>{quotation.supplierCount}</strong><span>Fornecedores</span></div>
        <div className="card"><strong>{quotation.responseCount}</strong><span>Propostas</span></div>
        <div className="card"><strong>{formatCurrency(quotation.totalValue)}</strong><span>Total recebido</span></div>
      </section>

      <section className="grid-main">
        <div className="card panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Melhor proposta</h2>
              <span className="panel-note">Menor valor total recebido para esta cotação até agora</span>
            </div>
          </div>
          {bestSupplier ? (
            <div className="quotation-best-supplier">
              <strong>{bestSupplier.supplierName}</strong>
              <span>{formatCurrency(bestSupplier.totalValue)}</span>
              <small>{bestSupplier.selected ? "Fornecedor selecionado" : "Ainda não selecionado"}</small>
            </div>
          ) : (
            <div className="empty-state">Ainda não há proposta com valor para decisão.</div>
          )}
        </div>
        <div className="card panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Operação</h2>
              <span className="panel-note">Onde esta cotação está e o que falta para fechar a decisão</span>
            </div>
          </div>
          <div className="quotation-next-actions">
            <span><strong>Status</strong>{quotation.status}</span>
            <span><strong>Ação</strong>{suggestedNextAction(quotation)}</span>
            <span><strong>Sienge</strong>{quotation.integratedAt ? formatOptionalDate(quotation.integratedAt) : "Pendente"}</span>
            <span><strong>Mapa</strong>{hasPortalResponses ? "Pronto" : "Aguardando"}</span>
          </div>
        </div>
      </section>
    </>
  );
}
