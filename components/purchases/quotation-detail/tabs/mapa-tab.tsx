import type { QuotationSummary } from "@/features/quotations/data";
import { formatCurrency } from "@/lib/formatters";
import type { SupplierQuoteResponseSummary } from "@/lib/supplier-quote-portal";
import { exportItemComparison, formatDocument, paymentSummary, plural } from "../helpers";
import type { ItemComparisonRow } from "../types";

export function MapaTab({
  quotation,
  supplierResponses,
  itemComparison,
  loadingAction,
  onExportPdf
}: {
  quotation: QuotationSummary;
  supplierResponses: SupplierQuoteResponseSummary[];
  itemComparison: ItemComparisonRow[];
  loadingAction: string | null;
  onExportPdf: () => void;
}) {
  const rowsWithBest = itemComparison.filter((row) => row.best);
  const rowsWithoutPrice = itemComparison.filter((row) => !row.best);
  const partialBestRows = rowsWithBest.filter((row) => row.best?.partial);
  const bestBasketTotal = rowsWithBest.reduce((sum, row) => sum + (row.best?.total || 0), 0);
  const supplierAnalyses = supplierResponses.map((response) => {
    const offers = itemComparison
      .map((row) => row.offers.find((offer) => offer.responseId === response.id))
      .filter((offer): offer is NonNullable<typeof offer> => Boolean(offer));
    const attendedOffers = offers.filter((offer) => offer.attends);
    const partialOffers = attendedOffers.filter((offer) => offer.partial);
    const bestOffers = rowsWithBest.filter((row) => row.best?.responseId === response.id);
    const deadlines = attendedOffers.map((offer) => offer.deadlineDays).filter((days) => days > 0);
    const averageDeadline = deadlines.length ? Math.round(deadlines.reduce((sum, days) => sum + days, 0) / deadlines.length) : response.commercialTerms.deliveryDays;

    return {
      response,
      partialCount: partialOffers.length,
      bestCount: bestOffers.length,
      bestTotal: bestOffers.reduce((sum, row) => sum + (row.best?.total || 0), 0),
      quotedTotal: attendedOffers.reduce((sum, offer) => sum + offer.total, 0),
      coverage: itemComparison.length ? Math.round((attendedOffers.length / itemComparison.length) * 100) : 0,
      averageDeadline
    };
  }).sort((left, right) => right.bestCount - left.bestCount || left.bestTotal - right.bestTotal || right.coverage - left.coverage);
  const leader = supplierAnalyses.find((analysis) => analysis.bestCount > 0);
  const fastest = [...supplierAnalyses]
    .filter((analysis) => analysis.coverage > 0 && analysis.averageDeadline > 0)
    .sort((left, right) => left.averageDeadline - right.averageDeadline || right.coverage - left.coverage)[0];
  const savingsRows = rowsWithBest
    .map((row) => {
      const second = row.offers
        .filter((offer) => offer.attends && offer.hasPrice && offer.responseId !== row.best?.responseId)
        .sort((left, right) => left.unitPrice - right.unitPrice)[0];
      const requestedQuantity = row.item?.quantity || row.best?.quantity || 0;
      const unitGap = second && row.best ? second.unitPrice - row.best.unitPrice : 0;
      return { row, saving: unitGap > 0 ? unitGap * requestedQuantity : 0 };
    })
    .filter((item) => item.saving > 0)
    .sort((left, right) => right.saving - left.saving)
    .slice(0, 3);
  const decisionStatus = rowsWithoutPrice.length
    ? "Há itens sem preço para fechar antes da decisão."
    : partialBestRows.length
      ? "A melhor cesta tem itens parciais; confira quantidade antes de aprovar."
      : "A melhor cesta cobre todos os itens com preço informado.";

  return (
    <section className="quotation-map-layout">
      <div className="card quotation-comparison quotation-item-map">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Mapa item a item</h2>
            <span className="panel-note">Preço, prazo, quantidade atendida e observação por insumo</span>
          </div>
          <div className="quotation-operation-actions">
            <button className="button secondary" type="button" onClick={() => exportItemComparison(quotation, supplierResponses)} disabled={!supplierResponses.length}>
              Exportar CSV
            </button>
            <button className="button secondary" type="button" onClick={onExportPdf} disabled={loadingAction !== null}>
              {loadingAction === "comparison-map" ? "Gerando..." : "Mapa do Sienge (PDF)"}
            </button>
          </div>
        </div>

        {supplierResponses.length ? (
          <>
            <div className="quotation-map-intelligence">
              <article>
                <span>Melhor cesta</span>
                <strong>{formatCurrency(bestBasketTotal)}</strong>
                <small>{rowsWithBest.length} de {itemComparison.length} itens com preço</small>
              </article>
              <article>
                <span>Cobertura</span>
                <strong>{itemComparison.length ? Math.round((rowsWithBest.length / itemComparison.length) * 100) : 0}%</strong>
                <small>{rowsWithoutPrice.length ? `${rowsWithoutPrice.length} sem preço` : "Todos precificados"}</small>
              </article>
              <article className={partialBestRows.length ? "warn" : ""}>
                <span>Parciais na melhor cesta</span>
                <strong>{partialBestRows.length}</strong>
                <small>{partialBestRows.length ? "Conferir quantidade" : "Sem restrição parcial"}</small>
              </article>
              <article>
                <span>Mais competitivo</span>
                <strong>{leader?.response.supplierName || "-"}</strong>
                <small>{leader ? plural(leader.bestCount, "melhor item", "melhores itens") : "Sem líder definido"}</small>
              </article>
            </div>

            <div className="quotation-map-analysis-grid">
              <article className="quotation-map-analysis-card">
                <div>
                  <span>Leitura principal</span>
                  <h3>{decisionStatus}</h3>
                </div>
                <div className="quotation-map-findings">
                  <span><strong>Menor custo por item</strong>{leader ? `${leader.response.supplierName} lidera ${plural(leader.bestCount, "item", "itens")}, somando ${formatCurrency(leader.bestTotal)} na cesta vencedora.` : "Ainda não há líder por preço."}</span>
                  <span><strong>Prazo</strong>{fastest ? `${fastest.response.supplierName} tem melhor prazo médio informado: ${plural(fastest.averageDeadline || 0, "dia", "dias")}.` : "Sem prazo informado nas propostas."}</span>
                  <span><strong>Risco de fechamento</strong>{rowsWithoutPrice.length || partialBestRows.length ? `${plural(rowsWithoutPrice.length, "item sem preço", "itens sem preço")} e ${plural(partialBestRows.length, "parcial", "parciais")} na melhor cesta.` : "Sem bloqueio aparente por preço ou quantidade parcial."}</span>
                </div>
              </article>

              <article className="quotation-map-analysis-card">
                <div>
                  <span>Maiores economias</span>
                  <h3>Onde a diferença de preço pesa mais</h3>
                </div>
                <div className="quotation-map-saving-list">
                  {savingsRows.map(({ row, saving }) => (
                    <span key={row.itemNumber}>
                      <strong>{row.item?.name || `Item ${row.itemNumber}`}</strong>
                      {formatCurrency(saving)}
                    </span>
                  ))}
                  {!savingsRows.length && <span><strong>Sem diferença relevante</strong>Nenhum segundo preço para comparar.</span>}
                </div>
              </article>
            </div>

            <div className="quotation-supplier-analysis">
              {supplierAnalyses.map((analysis) => (
                <article key={analysis.response.id}>
                  <div>
                    <span>{analysis.coverage}% cobertura</span>
                    <strong>{analysis.response.supplierName}</strong>
                  </div>
                  <div>
                    <small>{plural(analysis.bestCount, "melhor", "melhores")}</small>
                    <small>{plural(analysis.partialCount, "parcial", "parciais")}</small>
                    <small>{plural(analysis.averageDeadline || 0, "dia", "dias")}</small>
                    <small>{formatCurrency(analysis.quotedTotal)}</small>
                  </div>
                </article>
              ))}
            </div>

            <div className="quotation-item-comparison-list">
              {itemComparison.map((row) => (
                <article className="quotation-item-comparison-card" key={row.itemNumber}>
                  <div className="quotation-item-comparison-head">
                    <div>
                      <span>Insumo #{row.item?.productId || row.itemNumber}</span>
                      <h3>{row.item?.name || `Item ${row.itemNumber}`}</h3>
                      <small>{row.item?.quantity || 0} {row.item?.unit || "un"} solicitados - {row.item?.detail || "Sem detalhe"}</small>
                    </div>
                    {row.best ? (
                      <div>
                        <strong>{formatCurrency(row.best.unitPrice)}</strong>
                        <small>{row.best.supplierName}</small>
                      </div>
                    ) : (
                      <i className="badge muted">Sem preço</i>
                    )}
                  </div>

                  <div className="quotation-item-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Fornecedor</th>
                          <th>Status</th>
                          <th>Preço unit.</th>
                          <th>Qtd. atendida</th>
                          <th>Total</th>
                          <th>Prazo</th>
                          <th>Pagamento</th>
                          <th>Observação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {row.offers.map((offer) => {
                          const isBest = row.best?.responseId === offer.responseId;
                          const sourceResponse = supplierResponses.find((current) => current.id === offer.responseId);
                          const statusLabel = offer.attends
                            ? offer.partial
                              ? isBest ? "Melhor parcial" : "Parcial"
                              : isBest ? "Melhor preço" : "Atende"
                            : offer.hasResponse ? "Não atende" : "Sem resposta";
                          return (
                            <tr className={[isBest ? "best-row" : "", offer.attends && offer.partial ? "partial-row" : ""].filter(Boolean).join(" ")} key={`${row.itemNumber}-${offer.responseId}`}>
                              <td>
                                <strong>{offer.supplierName}</strong><br />
                                <span className="table-muted">{formatDocument(offer.document)}</span>
                              </td>
                              <td>
                                <i className={`badge ${offer.attends ? offer.partial ? "warn" : "" : "muted"}`}>
                                  {statusLabel}
                                </i>
                              </td>
                              <td>{offer.attends ? formatCurrency(offer.unitPrice) : "-"}</td>
                              <td>{offer.attends ? offer.quantity : "-"}</td>
                              <td>{offer.attends ? formatCurrency(offer.total) : "-"}</td>
                              <td>{offer.attends && offer.deadlineDays ? plural(offer.deadlineDays, "dia", "dias") : "-"}</td>
                              <td>{offer.attends && sourceResponse ? paymentSummary(sourceResponse.commercialTerms) : "-"}</td>
                              <td>{offer.notes || "Sem observação"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">Nenhuma resposta itemizada recebida pelo link. Gere links para fornecedores e acompanhe as propostas na aba Respostas.</div>
        )}
      </div>

      <aside className="card quotation-best-price-panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Decisão por item</h2>
            <span className="panel-note">Melhor preço unitário por insumo</span>
          </div>
        </div>
        <div className="quotation-best-price-list">
          {rowsWithBest.map((row) => (
            <article key={row.itemNumber}>
              <span>{row.item?.name || `Item ${row.itemNumber}`}</span>
              <strong>{formatCurrency(row.best?.unitPrice || 0)}</strong>
              <small>{row.best?.supplierName} - qtd. {row.best?.quantity || 0} - {plural(row.best?.deadlineDays || 0, "dia", "dias")}</small>
              {row.best?.partial && <p>Atendimento parcial</p>}
              {row.best?.notes && <p>{row.best.notes}</p>}
            </article>
          ))}
        </div>
        {!rowsWithBest.length && (
          <div className="empty-state">Ainda não há preços válidos para destacar.</div>
        )}
      </aside>
    </section>
  );
}
