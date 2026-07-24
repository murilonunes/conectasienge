import { I18nText } from "@/components/i18n/i18n-text";
import type { QuotationSummary } from "@/features/quotations/data";
import { formatCurrency } from "@/lib/formatters";
import type { SupplierQuoteResponseSummary } from "@/lib/supplier-quote-portal";
import { exportItemComparison, formatDocument, paymentSummary, plural } from "../helpers";
import type { ItemComparisonRow } from "../types";
import { MapaPdfModal } from "./mapa-pdf-modal";

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
            <h2 className="panel-title"><I18nText text={"Mapa item a item"} /></h2>
            <span className="panel-note"><I18nText text={"Preço, prazo, quantidade atendida e observação por insumo"} /></span>
          </div>
          <div className="quotation-operation-actions">
            <button className="button secondary" type="button" onClick={() => exportItemComparison(quotation, supplierResponses)} disabled={!supplierResponses.length}>
              <I18nText text={"Exportar CSV"} />
            </button>
            <button className="button secondary" type="button" onClick={onExportPdf} disabled={loadingAction !== null}>
              <I18nText text={loadingAction === "comparison-map" ? "Gerando..." : "Mapa do Sienge (PDF)"} />
            </button>
            <MapaPdfModal quotationId={quotation.id} items={itemComparison} />
          </div>
        </div>

        {supplierResponses.length ? (
          <>
            <div className="quotation-map-intelligence">
              <article>
                <span><I18nText text={"Melhor cesta"} /></span>
                <strong>{formatCurrency(bestBasketTotal)}</strong>
                <small>{rowsWithBest.length} <I18nText text={"de"} /> {itemComparison.length} <I18nText text={"itens com preço"} /></small>
              </article>
              <article>
                <span><I18nText text={"Cobertura"} /></span>
                <strong>{itemComparison.length ? Math.round((rowsWithBest.length / itemComparison.length) * 100) : 0}<I18nText text={"%"} /></strong>
                <small>{rowsWithoutPrice.length ? `${rowsWithoutPrice.length} sem preço` : <I18nText text={"Todos precificados"} />}</small>
              </article>
              <article className={partialBestRows.length ? "warn" : ""}>
                <span><I18nText text={"Parciais na melhor cesta"} /></span>
                <strong>{partialBestRows.length}</strong>
                <small><I18nText text={partialBestRows.length ? "Conferir quantidade" : "Sem restrição parcial"} /></small>
              </article>
              <article>
                <span><I18nText text={"Mais competitivo"} /></span>
                <strong>{leader?.response.supplierName || <I18nText text={"-"} />}</strong>
                <small>{leader ? plural(leader.bestCount, "melhor item", "melhores itens") : <I18nText text={"Sem líder definido"} />}</small>
              </article>
            </div>

            <div className="quotation-map-analysis-grid">
              <article className="quotation-map-analysis-card">
                <div>
                  <span><I18nText text={"Leitura principal"} /></span>
                  <h3>{decisionStatus}</h3>
                </div>
                <div className="quotation-map-findings">
                  <span><strong><I18nText text={"Menor custo por item"} /></strong>{leader ? `${leader.response.supplierName} lidera ${plural(leader.bestCount, "item", "itens")}, somando ${formatCurrency(leader.bestTotal)} na cesta vencedora.` : <I18nText text={"Ainda não há líder por preço."} />}</span>
                  <span><strong><I18nText text={"Prazo"} /></strong>{fastest ? `${fastest.response.supplierName} tem melhor prazo médio informado: ${plural(fastest.averageDeadline || 0, "dia", "dias")}.` : <I18nText text={"Sem prazo informado nas propostas."} />}</span>
                  <span><strong><I18nText text={"Risco de fechamento"} /></strong>{rowsWithoutPrice.length || partialBestRows.length ? `${plural(rowsWithoutPrice.length, "item sem preço", "itens sem preço")} e ${plural(partialBestRows.length, "parcial", "parciais")} na melhor cesta.` : <I18nText text={"Sem bloqueio aparente por preço ou quantidade parcial."} />}</span>
                </div>
              </article>

              <article className="quotation-map-analysis-card">
                <div>
                  <span><I18nText text={"Maiores economias"} /></span>
                  <h3><I18nText text={"Onde a diferença de preço pesa mais"} /></h3>
                </div>
                <div className="quotation-map-saving-list">
                  {savingsRows.map(({ row, saving }) => (
                    <span key={row.itemNumber}>
                      <strong>{row.item?.name || `Item ${row.itemNumber}`}</strong>
                      {formatCurrency(saving)}
                    </span>
                  ))}
                  {!savingsRows.length && <span><strong><I18nText text={"Sem diferença relevante"} /></strong><I18nText text={"Nenhum segundo preço para comparar."} /></span>}
                </div>
              </article>
            </div>

            <div className="quotation-supplier-analysis">
              {supplierAnalyses.map((analysis) => (
                <article key={analysis.response.id}>
                  <div>
                    <span>{analysis.coverage}<I18nText text={"% cobertura"} /></span>
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
                      <span><I18nText text={"Insumo #"} />{row.item?.productId || row.itemNumber}</span>
                      <h3>{row.item?.name || `Item ${row.itemNumber}`}</h3>
                      <small>{row.item?.quantity || 0} {row.item?.unit || <I18nText text={"un"} />} <I18nText text={"solicitados -"} /> {row.item?.detail || <I18nText text={"Sem detalhe"} />}</small>
                    </div>
                    {row.best ? (
                      <div>
                        <strong>{formatCurrency(row.best.unitPrice)}</strong>
                        <small>{row.best.supplierName}</small>
                      </div>
                    ) : (
                      <i className="badge muted"><I18nText text={"Sem preço"} /></i>
                    )}
                  </div>

                  <div className="quotation-item-table">
                    <table>
                      <thead>
                        <tr>
                          <th><I18nText text={"Fornecedor"} /></th>
                          <th><I18nText text={"Status"} /></th>
                          <th><I18nText text={"Preço unit."} /></th>
                          <th><I18nText text={"Qtd. atendida"} /></th>
                          <th><I18nText text={"Total"} /></th>
                          <th><I18nText text={"Prazo"} /></th>
                          <th><I18nText text={"Pagamento"} /></th>
                          <th><I18nText text={"Observação"} /></th>
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
                              <td>{offer.attends ? formatCurrency(offer.unitPrice) : <I18nText text={"-"} />}</td>
                              <td>{offer.attends ? offer.quantity : <I18nText text={"-"} />}</td>
                              <td>{offer.attends ? formatCurrency(offer.total) : <I18nText text={"-"} />}</td>
                              <td>{offer.attends && offer.deadlineDays ? plural(offer.deadlineDays, "dia", "dias") : <I18nText text={"-"} />}</td>
                              <td>{offer.attends && sourceResponse ? paymentSummary(sourceResponse.commercialTerms) : <I18nText text={"-"} />}</td>
                              <td>{offer.notes || <I18nText text={"Sem observação"} />}</td>
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
          <div className="empty-state"><I18nText text={"Nenhuma resposta itemizada recebida pelo link. Gere links para fornecedores e acompanhe as propostas na aba Respostas."} /></div>
        )}
      </div>

      <aside className="card quotation-best-price-panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title"><I18nText text={"Decisão por item"} /></h2>
            <span className="panel-note"><I18nText text={"Melhor preço unitário por insumo"} /></span>
          </div>
        </div>
        <div className="quotation-best-price-list">
          {rowsWithBest.map((row) => (
            <article key={row.itemNumber}>
              <span>{row.item?.name || `Item ${row.itemNumber}`}</span>
              <strong>{formatCurrency(row.best?.unitPrice || 0)}</strong>
              <small>{row.best?.supplierName} <I18nText text={"- qtd."} /> {row.best?.quantity || 0} <I18nText text={"-"} /> {plural(row.best?.deadlineDays || 0, "dia", "dias")}</small>
              {row.best?.partial && <p><I18nText text={"Atendimento parcial"} /></p>}
              {row.best?.notes && <p>{row.best.notes}</p>}
            </article>
          ))}
        </div>
        {!rowsWithBest.length && (
          <div className="empty-state"><I18nText text={"Ainda não há preços válidos para destacar."} /></div>
        )}
      </aside>
    </section>
  );
}
