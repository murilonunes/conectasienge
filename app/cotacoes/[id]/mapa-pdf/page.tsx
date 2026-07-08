import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { buildItemComparison, formatDocument, freightSummary, paymentSummary, plural } from "@/components/purchases/quotation-detail/helpers";
import { PrintButton } from "@/components/ui/print-button";
import { loadQuotationDetail } from "@/features/quotations/data";
import { getSessionUserFromCookieValue } from "@/lib/app-users";
import { formatCurrency, formatOptionalDate } from "@/lib/formatters";
import { loadSupplierQuoteResponses } from "@/lib/supplier-quote-portal";

export const dynamic = "force-dynamic";

const scopeLabels: Record<string, string> = {
  selecionados: "Itens selecionados",
  proposta: "Somente itens com proposta"
};

export default async function QuotationMapPdfPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { itens?: string; escopo?: string };
}) {
  const user = getSessionUserFromCookieValue(cookies().get("brasin_session")?.value);
  if (!user?.permissions.includes("screen.cotacoes")) {
    return (
      <main className="map-report">
        <section className="card panel access-denied-panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Acesso não liberado</h2>
              <span className="panel-note">Seu usuário não tem permissão para relatórios de cotação</span>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  const quotation = await loadQuotationDetail(id);
  if (!quotation) notFound();

  const allResponses = loadSupplierQuoteResponses(id);
  const activeResponses = allResponses.filter((response) => !response.supersededByResponseId);
  const fullComparison = buildItemComparison(quotation.items, activeResponses);

  const requestedNumbers = (searchParams?.itens || "")
    .split(",")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  const rows = requestedNumbers.length
    ? fullComparison.filter((row) => requestedNumbers.includes(row.itemNumber))
    : fullComparison;
  const scopeLabel = scopeLabels[searchParams?.escopo || ""] || "Todos os itens";

  const rowsWithBest = rows.filter((row) => row.best);
  const bestBasketTotal = rowsWithBest.reduce((sum, row) => sum + (row.best?.total || 0), 0);
  const coverage = rows.length ? Math.round((rowsWithBest.length / rows.length) * 100) : 0;
  const respondingSuppliers = new Set(activeResponses.map((response) => response.document)).size;
  const supplierColumns = activeResponses.map((response) => {
    const offers = rows.map((row) => row.offers.find((offer) => offer.responseId === response.id));
    const total = offers.reduce((sum, offer) => sum + (offer?.attends ? offer.total : 0), 0);
    const coverageCount = offers.filter((offer) => offer?.attends && offer.hasPrice).length;
    const bestCount = rows.filter((row) => row.best?.responseId === response.id).length;

    return { response, offers, total, coverageCount, bestCount };
  });

  return (
    <main className="map-report">
      <div className="map-report-actions">
        <Link className="button secondary" href={`/cotacoes/${id}`}>Voltar para a cotação</Link>
        <PrintButton />
      </div>

      <header className="map-report-head">
        <div>
          <span>Brasin Empreendimentos - Compras</span>
          <h1>Mapa comparativo de cotação</h1>
          <p>Cotação #{quotation.code} - {scopeLabel} - gerado em {new Date().toLocaleDateString("pt-BR")}, sem consultar o Sienge</p>
        </div>
        <div className="map-report-summary">
          <span><strong>{rows.length}</strong><small>Itens no mapa</small></span>
          <span><strong>{coverage}%</strong><small>Cobertura de preço</small></span>
          <span><strong>{formatCurrency(bestBasketTotal)}</strong><small>Melhor cesta</small></span>
        </div>
      </header>

      <section className="map-report-block map-report-grid">
        <span><strong>Comprador</strong>{quotation.buyerId || "Não informado"}</span>
        <span><strong>Data da cotação</strong>{formatOptionalDate(quotation.date)}</span>
        <span><strong>Prazo de respostas</strong>{formatOptionalDate(quotation.deadline)}</span>
        <span><strong>Fornecedores respondentes</strong>{respondingSuppliers}</span>
      </section>

      <section className="map-report-matrix-block">
        <div className="map-report-section-head">
          <div>
            <span>Comparativo horizontal</span>
            <h2>Itens por linha, fornecedores por coluna</h2>
          </div>
          <small>O destaque verde aparece somente no menor preço unitário de cada item.</small>
        </div>

        {rows.length ? (
          <div className="map-report-matrix-wrap">
            <table className="map-report-matrix">
              <thead>
                <tr>
                  <th className="map-report-item-row-col">Item</th>
                  {supplierColumns.map(({ response }) => (
                    <th className="map-report-supplier-head" key={response.id}>
                      <strong>{response.supplierName}</strong>
                      <small>{formatDocument(response.document)}</small>
                      {response.registrationPending && <em>Cadastro pendente</em>}
                    </th>
                  ))}
                  <th className="map-report-choice-col">Melhor cesta</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.itemNumber}>
                    <td className="map-report-item-row-col">
                      <span>#{row.item?.productId || row.itemNumber}</span>
                      <strong>{row.item?.name || `Item ${row.itemNumber}`}</strong>
                      <small>{row.item?.quantity || 0} {row.item?.unit || "un"} solicitados</small>
                      {row.item?.detail && <small>{row.item.detail}</small>}
                    </td>
                    {supplierColumns.map(({ response }) => {
                      const offer = row.offers.find((current) => current.responseId === response.id);
                      const isBest = row.best?.responseId === response.id;
                      const className = isBest
                        ? "map-report-price-cell best"
                        : offer?.partial
                          ? "map-report-price-cell partial"
                          : "map-report-price-cell";

                      return (
                        <td className={className} key={`${response.id}-${row.itemNumber}`}>
                          {offer?.attends ? (
                            <>
                              <strong>{formatCurrency(offer.unitPrice)}</strong>
                              <div className="map-report-price-details">
                                <small>Total {formatCurrency(offer.total)}</small>
                                <small>{offer.partial ? `Parcial: ${offer.quantity}` : `Qtd. ${offer.quantity}`}</small>
                                <small>{offer.deadlineDays ? plural(offer.deadlineDays, "dia", "dias") : "Prazo geral"}</small>
                              </div>
                            </>
                          ) : (
                            <span>{offer?.hasResponse ? "Não atende" : "Sem resposta"}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="map-report-choice-col">
                      {row.best ? (
                        <strong>{formatCurrency(row.best.unitPrice)}</strong>
                      ) : (
                        <span>Sem preço</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total cotado por fornecedor</td>
                  {supplierColumns.map(({ response, total, coverageCount, bestCount }) => (
                    <td className="map-report-price-cell" key={`total-${response.id}`}>
                      <strong>{formatCurrency(total)}</strong>
                      <div className="map-report-price-details">
                        <small>{coverageCount}/{rows.length} itens com preço</small>
                        <small>{bestCount ? plural(bestCount, "melhor preço", "melhores preços") : "Sem menor preço"}</small>
                        <small>{paymentSummary(response.commercialTerms)}</small>
                        <small>{freightSummary(response.commercialTerms)}</small>
                      </div>
                    </td>
                  ))}
                  <td className="map-report-choice-col total">
                    <strong>{formatCurrency(bestBasketTotal)}</strong>
                    <small>Menor cesta item a item</small>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="map-report-empty">Nenhum item corresponde ao filtro selecionado.</p>
        )}
      </section>

      <footer className="map-report-footer">
        Documento gerado pelo Brasin Financeiro a partir das propostas recebidas no portal do fornecedor para a cotação #{quotation.code}. Este mapa não consulta o Sienge.
      </footer>
    </main>
  );
}
