import type { QuotationSummary } from "@/features/quotations/data";
import { formatCurrency } from "@/lib/formatters";
import type { SupplierQuoteResponseSummary } from "@/lib/supplier-quote-portal";
import { exportItemComparison, formatDocument, paymentSummary } from "../helpers";
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
                            <td>{offer.attends && offer.deadlineDays ? `${offer.deadlineDays} dia(s)` : "-"}</td>
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
        ) : (
          <div className="empty-state">Nenhuma resposta itemizada recebida pelo link. Gere links para fornecedores e acompanhe as propostas na aba Respostas.</div>
        )}
      </div>

      <aside className="card quotation-best-price-panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Melhores preços</h2>
            <span className="panel-note">Menor valor unitário por insumo</span>
          </div>
        </div>
        <div className="quotation-best-price-list">
          {itemComparison.filter((row) => row.best).map((row) => (
            <article key={row.itemNumber}>
              <span>{row.item?.name || `Item ${row.itemNumber}`}</span>
              <strong>{formatCurrency(row.best?.unitPrice || 0)}</strong>
              <small>{row.best?.supplierName} - qtd. {row.best?.quantity || 0} - {row.best?.deadlineDays || 0} dia(s)</small>
              {row.best?.notes && <p>{row.best.notes}</p>}
            </article>
          ))}
        </div>
        {!itemComparison.some((row) => row.best) && (
          <div className="empty-state">Ainda não há preços válidos para destacar.</div>
        )}
      </aside>
    </section>
  );
}
