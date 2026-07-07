import { formatCurrency, formatOptionalDate } from "@/lib/formatters";
import type { SupplierQuoteAwardSummary, SupplierQuoteResponseSummary } from "@/lib/supplier-quote-portal";
import { formatDocument, plural } from "../helpers";
import type { ApprovalMode, ItemComparisonOffer, ItemComparisonRow } from "../types";

type SupplierDecisionMetrics = {
  response: SupplierQuoteResponseSummary;
  bestCount: number;
  partialCount: number;
  total: number;
  coverage: number;
};

function offerExists(offer: ItemComparisonOffer | undefined): offer is ItemComparisonOffer {
  return Boolean(offer);
}

function averageDeadline(offers: ItemComparisonOffer[]) {
  const deadlines = offers.map((offer) => offer.deadlineDays).filter((days) => days > 0);
  return deadlines.length ? Math.round(deadlines.reduce((sum, days) => sum + days, 0) / deadlines.length) : 0;
}

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
  loadingAction,
  reportHref
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
  reportHref: string;
}) {
  const rowsWithBest = itemComparison.filter((row) => row.best);
  const rowsWithoutPrice = itemComparison.filter((row) => !row.best);
  const partialBestRows = rowsWithBest.filter((row) => row.best?.partial);
  const bestBasketTotal = rowsWithBest.reduce((sum, row) => sum + (row.best?.total || 0), 0);
  const savedItemAwards = awards.filter((award) => award.scope === "item").length;
  const hasQuotationAward = awards.some((award) => award.scope === "quotation");
  const savedCoverage = approvalMode === "quotation"
    ? hasQuotationAward ? 100 : 0
    : itemComparison.length ? Math.round((savedItemAwards / itemComparison.length) * 100) : 0;

  const supplierMetrics: SupplierDecisionMetrics[] = supplierResponses
    .map((response) => {
      const offers = itemComparison
        .map((row) => row.offers.find((offer) => offer.responseId === response.id))
        .filter(offerExists);
      const attendedOffers = offers.filter((offer) => offer.attends);
      const bestCount = rowsWithBest.filter((row) => row.best?.responseId === response.id).length;

      return {
        response,
        bestCount,
        partialCount: attendedOffers.filter((offer) => offer.partial).length,
        total: attendedOffers.reduce((sum, offer) => sum + offer.total, 0),
        coverage: itemComparison.length ? Math.round((attendedOffers.length / itemComparison.length) * 100) : 0
      };
    })
    .sort((left, right) => right.bestCount - left.bestCount || right.coverage - left.coverage || left.total - right.total);
  const recommendedSupplier = supplierMetrics[0];
  const selectedResponse = supplierResponses.find((response) => String(response.id) === approvalResponseId);
  const selectedOffers = selectedResponse
    ? itemComparison
        .map((row) => row.offers.find((offer) => offer.responseId === selectedResponse.id))
        .filter(offerExists)
    : [];
  const selectedAttendedOffers = selectedOffers.filter((offer) => offer.attends);
  const selectedBestCount = rowsWithBest.filter((row) => row.best?.responseId === selectedResponse?.id).length;
  const selectedPartialCount = selectedAttendedOffers.filter((offer) => offer.partial).length;
  const selectedCoverage = itemComparison.length ? Math.round((selectedAttendedOffers.length / itemComparison.length) * 100) : 0;
  const selectedAverageDeadline = averageDeadline(selectedAttendedOffers);
  const approvalReadiness = !supplierResponses.length
    ? "Aguardando propostas"
    : rowsWithoutPrice.length
      ? "Revisar itens sem preço"
      : partialBestRows.length
        ? "Validar parciais"
        : "Pronto para aprovar";
  const readinessDetail = !supplierResponses.length
    ? "Receba respostas dos fornecedores antes de registrar a decisão."
    : rowsWithoutPrice.length
      ? `${plural(rowsWithoutPrice.length, "item ainda não tem", "itens ainda não têm")} preço válido.`
      : partialBestRows.length
        ? `${plural(partialBestRows.length, "melhor preço atende", "melhores preços atendem")} quantidade parcial.`
        : "A melhor cesta tem preço para todos os itens comparados.";

  return (
    <section className="quotation-approval-layout">
      <div className="card panel quotation-approval-main">
        <div className="panel-head quotation-approval-hero">
          <div>
            <span>Central de decisão</span>
            <h2 className="panel-title">Aprovação do vencedor</h2>
            <p>Compare recomendação, risco e cobertura antes de salvar a escolha final.</p>
          </div>
          <i className={`badge ${rowsWithoutPrice.length || partialBestRows.length ? "warn" : ""}`}>{approvalReadiness}</i>
        </div>

        <div className="quotation-approval-command">
          <article>
            <span>Melhor cesta</span>
            <strong>{formatCurrency(bestBasketTotal)}</strong>
            <small>{rowsWithBest.length} de {plural(itemComparison.length, "item", "itens")} com vencedor sugerido</small>
          </article>
          <article className={rowsWithoutPrice.length ? "warn" : ""}>
            <span>Pendências</span>
            <strong>{rowsWithoutPrice.length + partialBestRows.length}</strong>
            <small>{readinessDetail}</small>
          </article>
          <article>
            <span>Recomendação</span>
            <strong>{recommendedSupplier?.response.supplierName || "-"}</strong>
            <small>{recommendedSupplier ? `${plural(recommendedSupplier.bestCount, "melhor item", "melhores itens")}, ${recommendedSupplier.coverage}% cobertura` : "Sem resposta elegível"}</small>
          </article>
          <article>
            <span>Salvo</span>
            <strong>{savedCoverage}%</strong>
            <small>{awards.length ? `${plural(awards.length, "decisão registrada", "decisões registradas")}` : "Nenhuma decisão salva"}</small>
          </article>
        </div>

        <div className="quotation-approval-mode">
          <button className={approvalMode === "quotation" ? "active" : ""} type="button" onClick={() => onApprovalModeChange("quotation")}>
            <strong>Cotação inteira</strong>
            <small>Um fornecedor vence tudo</small>
          </button>
          <button className={approvalMode === "item" ? "active" : ""} type="button" onClick={() => onApprovalModeChange("item")}>
            <strong>Por item</strong>
            <small>Melhor decisão por insumo</small>
          </button>
        </div>

        {approvalMode === "quotation" ? (
          <div className="quotation-approval-board">
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
                <span>Justificativa executiva</span>
                <textarea className="field" value={approvalJustification} onChange={(event) => onApprovalJustificationChange(event.target.value)} placeholder="Ex.: menor preço global, atende prazo, cobertura e quantidade total." />
              </label>
            </div>

            <div className="quotation-approval-selected">
              <div>
                <span>Fornecedor em análise</span>
                <h3>{selectedResponse?.supplierName || "Selecione um fornecedor"}</h3>
                <small>{selectedResponse ? formatDocument(selectedResponse.document) : "Os indicadores aparecem aqui ao escolher o vencedor."}</small>
              </div>
              <div className="quotation-approval-selected-grid">
                <span><strong>{selectedCoverage}%</strong><small>Cobertura</small></span>
                <span><strong>{selectedBestCount}</strong><small>Melhores itens</small></span>
                <span><strong>{selectedPartialCount}</strong><small>Parciais</small></span>
                <span><strong>{selectedAverageDeadline || "-"}</strong><small>Prazo médio</small></span>
              </div>
              <p>{selectedResponse ? `${selectedResponse.supplierName} soma ${formatCurrency(selectedResponse.totalValue)} na proposta enviada. Compare com a melhor cesta de ${formatCurrency(bestBasketTotal)} antes de confirmar.` : "Escolha o fornecedor para avaliar aderência, prazo e risco de compra integral."}</p>
            </div>
          </div>
        ) : (
          <div className="quotation-approval-items">
            {itemComparison.map((row) => {
              const selectedResponseId = itemAwardSelections[row.itemNumber] || String(row.best?.responseId || "");
              const selectedOffer = row.offers.find((offer) => String(offer.responseId) === selectedResponseId);
              const validOffers = row.offers.filter((offer) => offer.attends);
              return (
                <article className={row.best?.partial ? "partial" : !row.best ? "muted" : ""} key={row.itemNumber}>
                  <div className="quotation-approval-item-main">
                    <span>Insumo #{row.item?.productId || row.itemNumber}</span>
                    <strong>{row.item?.name || `Item ${row.itemNumber}`}</strong>
                    <small>{row.item?.quantity || 0} {row.item?.unit || "un"} solicitados</small>
                    <p>{row.best ? `Sugestão: ${row.best.supplierName} por ${formatCurrency(row.best.unitPrice)}.` : "Sem preço válido para recomendação automática."}</p>
                  </div>
                  <div className="quotation-approval-item-score">
                    <span>{plural(validOffers.length, "oferta", "ofertas")}</span>
                    <strong>{selectedOffer?.attends ? formatCurrency(selectedOffer.unitPrice) : "-"}</strong>
                    <small>{selectedOffer?.attends ? `${plural(selectedOffer.quantity, "atendido", "atendidos")} - ${plural(selectedOffer.deadlineDays || 0, "dia", "dias")}` : "Escolha uma proposta"}</small>
                    {selectedOffer?.partial && <i className="badge warn">Parcial</i>}
                  </div>
                  <select className="field" value={selectedResponseId} onChange={(event) => onItemAwardChange(row.itemNumber, event.target.value)}>
                    <option value="">Selecione</option>
                    {validOffers.map((offer) => (
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
              );
            })}
          </div>
        )}

        {approvalMode === "item" && (
          <label className="quotation-approval-common">
            <span>Justificativa padrão para itens sem texto próprio</span>
            <textarea className="field" value={approvalJustification} onChange={(event) => onApprovalJustificationChange(event.target.value)} placeholder="Ex.: menor preço por item, respeitando quantidade atendida e prazo." />
          </label>
        )}

        {approvalMessage && <div className="settings-inline-message">{approvalMessage}</div>}
        <div className="quotation-operation-actions quotation-approval-actions">
          <button className="button" type="button" disabled={approvalSaving || !supplierResponses.length} onClick={onSaveAward}>
            {approvalSaving ? "Salvando..." : "Salvar aprovação"}
          </button>
          <button className="button secondary" type="button" disabled={!awards.length || loadingAction !== null} onClick={() => onSendAwardsToSienge(false)}>
            Preparar decisão no Sienge
          </button>
          <button className="button sienge-write" type="button" disabled={!awards.length || loadingAction !== null} onClick={() => onSendAwardsToSienge(true)}>
            {loadingAction === "negotiation-confirm" ? "Registrando..." : "Registrar decisão no Sienge"}
          </button>
          {awards.length > 0 && (
            <a className="button secondary" href={reportHref} target="_blank" rel="noreferrer">
              Relatório de decisão (PDF)
            </a>
          )}
          {!supplierResponses.length && <span className="table-muted">Receba respostas de fornecedores antes de aprovar.</span>}
        </div>
      </div>

      <aside className="card panel quotation-approval-side">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Decisão salva</h2>
            <span className="panel-note">Controle local da aprovação</span>
          </div>
        </div>
        <div className="quotation-approval-status">
          <span><strong>{awards.length}</strong><small>{awards.length === 1 ? "Registro" : "Registros"}</small></span>
          <span><strong>{savedCoverage}%</strong><small>Cobertura salva</small></span>
          <span><strong>{loadingAction ? "Em envio" : awards.length ? "Pronto" : "Pendente"}</strong><small>Sienge</small></span>
        </div>
        <div className="quotation-approval-checklist">
          <span className={supplierResponses.length ? "done" : ""}>Propostas recebidas</span>
          <span className={rowsWithoutPrice.length ? "" : "done"}>Itens com preço analisado</span>
          <span className={approvalJustification.trim() ? "done" : ""}>Justificativa preenchida</span>
          <span className={awards.length ? "done" : ""}>Decisão salva</span>
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
