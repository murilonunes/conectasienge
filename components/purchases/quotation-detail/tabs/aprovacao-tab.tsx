import type { QuotationSummary } from "@/features/quotations/data";
import { formatCurrency, formatOptionalDate } from "@/lib/formatters";
import type { SupplierQuoteAwardSummary, SupplierQuoteResponseSummary } from "@/lib/supplier-quote-portal";
import { formatDocument } from "../helpers";
import type { ApprovalMode, ItemComparisonRow } from "../types";

export function AprovacaoTab({
  supplierResponses,
  itemComparison,
  approvalMode,
  onApprovalModeChange,
  approvalResponseId,
  onApprovalResponseIdChange,
  approvalJustification,
  onApprovalJustificationChange,
  itemAwardSelections,
  onItemAwardChange,
  itemAwardJustifications,
  onItemJustificationChange,
  approvalMessage,
  approvalSaving,
  onSaveAward,
  awards,
  onSendAwardsToSienge,
  loadingAction
}: {
  supplierResponses: SupplierQuoteResponseSummary[];
  itemComparison: ItemComparisonRow[];
  approvalMode: ApprovalMode;
  onApprovalModeChange: (mode: ApprovalMode) => void;
  approvalResponseId: string;
  onApprovalResponseIdChange: (value: string) => void;
  approvalJustification: string;
  onApprovalJustificationChange: (value: string) => void;
  itemAwardSelections: Record<number, string>;
  onItemAwardChange: (itemNumber: number, responseId: string) => void;
  itemAwardJustifications: Record<number, string>;
  onItemJustificationChange: (itemNumber: number, justification: string) => void;
  approvalMessage: string;
  approvalSaving: boolean;
  onSaveAward: () => void;
  awards: SupplierQuoteAwardSummary[];
  onSendAwardsToSienge: (confirm: boolean) => void;
  loadingAction: string | null;
}) {
  return (
    <section className="quotation-approval-layout">
      <div className="card panel quotation-approval-main">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Aprovação do vencedor</h2>
            <span className="panel-note">Escolha por cotação inteira ou por item, sempre com justificativa</span>
          </div>
          <i className="badge">{approvalMode === "quotation" ? "Cotação inteira" : "Por item"}</i>
        </div>

        <div className="quotation-approval-mode">
          <button className={approvalMode === "quotation" ? "active" : ""} type="button" onClick={() => onApprovalModeChange("quotation")}>
            Cotação inteira
          </button>
          <button className={approvalMode === "item" ? "active" : ""} type="button" onClick={() => onApprovalModeChange("item")}>
            Por item
          </button>
        </div>

        {approvalMode === "quotation" ? (
          <div className="quotation-approval-form">
            <label>
              <span>Fornecedor vencedor</span>
              <select className="field" value={approvalResponseId} onChange={(event) => onApprovalResponseIdChange(event.target.value)}>
                <option value="">Selecione</option>
                {supplierResponses.map((response) => (
                  <option value={response.id} key={response.id}>
                    {response.supplierName} - {formatCurrency(response.totalValue)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Justificativa</span>
              <textarea className="field" value={approvalJustification} onChange={(event) => onApprovalJustificationChange(event.target.value)} placeholder="Ex.: menor preço global, atende prazo e quantidade total." />
            </label>
          </div>
        ) : (
          <div className="quotation-approval-items">
            {itemComparison.map((row) => (
              <article key={row.itemNumber}>
                <div>
                  <span>Insumo #{row.item?.productId || row.itemNumber}</span>
                  <strong>{row.item?.name || `Item ${row.itemNumber}`}</strong>
                  <small>{row.item?.quantity || 0} {row.item?.unit || "un"} solicitados</small>
                </div>
                <select className="field" value={itemAwardSelections[row.itemNumber] || String(row.best?.responseId || "")} onChange={(event) => onItemAwardChange(row.itemNumber, event.target.value)}>
                  <option value="">Selecione</option>
                  {row.offers.filter((offer) => offer.attends).map((offer) => (
                    <option value={offer.responseId} key={offer.responseId}>
                      {offer.supplierName} - {formatCurrency(offer.unitPrice)} - qtd. {offer.quantity}
                    </option>
                  ))}
                </select>
                <textarea
                  className="field"
                  value={itemAwardJustifications[row.itemNumber] || ""}
                  onChange={(event) => onItemJustificationChange(row.itemNumber, event.target.value)}
                  placeholder={row.best ? `Sugestão: melhor preço com ${row.best.supplierName}.` : "Justifique a escolha deste item."}
                />
              </article>
            ))}
          </div>
        )}

        {approvalMode === "item" && (
          <label className="quotation-approval-common">
            <span>Justificativa padrão para itens sem texto próprio</span>
            <textarea className="field" value={approvalJustification} onChange={(event) => onApprovalJustificationChange(event.target.value)} placeholder="Ex.: menor preço por item, respeitando quantidade atendida e prazo." />
          </label>
        )}

        {approvalMessage && <div className="settings-inline-message">{approvalMessage}</div>}
        <div className="quotation-operation-actions">
          <button className="button" type="button" disabled={approvalSaving || !supplierResponses.length} onClick={onSaveAward}>
            {approvalSaving ? "Salvando..." : "Salvar aprovação"}
          </button>
          <button className="button secondary" type="button" disabled={!awards.length || loadingAction !== null} onClick={() => onSendAwardsToSienge(false)}>
            Preparar decisão no Sienge
          </button>
          <button className="button sienge-write" type="button" disabled={!awards.length || loadingAction !== null} onClick={() => onSendAwardsToSienge(true)}>
            {loadingAction === "negotiation-confirm" ? "Registrando..." : "Registrar decisão no Sienge"}
          </button>
          {!supplierResponses.length && <span className="table-muted">Receba respostas de fornecedores antes de aprovar.</span>}
        </div>
      </div>

      <aside className="card panel quotation-approval-side">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Decisão salva</h2>
            <span className="panel-note">Registro local da aprovação</span>
          </div>
        </div>
        <div className="quotation-award-list">
          {awards.map((award) => (
            <article key={award.id}>
              <span>{award.scope === "quotation" ? "Cotação inteira" : `Item ${award.itemNumber}`}</span>
              <strong>{award.supplierName}</strong>
              <small>{formatDocument(award.document)} - {formatOptionalDate(award.createdAt)}</small>
              <p>{award.justification}</p>
            </article>
          ))}
        </div>
        {!awards.length && <div className="empty-state">Nenhuma aprovação salva para esta cotação.</div>}
        <div className="advanced-search-hint warn">
          A aprovação fica registrada na base local e pode ser enviada ao Sienge como negociação autorizada, marcando os itens escolhidos de cada fornecedor vencedor. A geração do pedido de compra é concluída dentro do próprio Sienge.
        </div>
      </aside>
    </section>
  );
}
