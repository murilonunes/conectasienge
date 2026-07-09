import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { buildItemComparison, formatDocument, freightSummary, plural } from "@/components/purchases/quotation-detail/helpers";
import { PrintButton } from "@/components/ui/print-button";
import { loadQuotationDetail } from "@/features/quotations/data";
import { getSessionUserFromCookieValue } from "@/lib/app-users";
import { formatCurrency, formatOptionalDate } from "@/lib/formatters";
import type { SupplierQuoteCommercialTerms } from "@/lib/supplier-quote-portal";
import { loadSupplierQuoteResponses } from "@/lib/supplier-quote-portal";

export const dynamic = "force-dynamic";

const scopeLabels: Record<string, string> = {
  selecionados: "Itens selecionados",
  proposta: "Somente itens com proposta"
};

function firstSupplierName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function formatPercentage(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
}

function formatMapTermPayment(terms: SupplierQuoteCommercialTerms) {
  const installments = terms.installments.filter((installment) => installment.percentage > 0);
  if (!installments.length) return "A prazo";
  if (installments.length === 1) return `A prazo (1x em ${installments[0].days}d)`;

  const percentages = installments.map((installment) => installment.percentage);
  const minPercentage = Math.min(...percentages);
  const maxPercentage = Math.max(...percentages);
  if (maxPercentage - minPercentage <= 0.1) {
    return `A prazo (${installments.length}x e 1º em ${installments[0].days}d)`;
  }

  const [entry, ...remaining] = installments;
  const hasEntry = entry.days >= 0
    && entry.days <= 3
    && remaining.length > 0
    && remaining.some((installment) => Math.abs(installment.percentage - entry.percentage) > 0.1);
  if (hasEntry) {
    const remainingText = remaining
      .map((installment) => `${formatPercentage(installment.percentage)}% em ${installment.days}d`)
      .join(" + ");
    return `A prazo (entrada em ${entry.days}d ${formatPercentage(entry.percentage)}%${remainingText ? ` + ${remainingText}` : ""})`;
  }

  const installmentText = installments
    .map((installment) => `${formatPercentage(installment.percentage)}% em ${installment.days}d`)
    .join(" + ");
  return `A prazo (${installmentText})`;
}

function mapPaymentSummary(terms: SupplierQuoteCommercialTerms) {
  if (terms.offersTerm) return formatMapTermPayment(terms);
  if (terms.offersCash) return "À vista";
  return "Não informado";
}

export default async function QuotationMapPdfPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { itens?: string; escopo?: string; orientacao?: string };
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
  const orientation = searchParams?.orientacao === "vertical" ? "vertical" : "horizontal";
  const orientationParams = new URLSearchParams();
  if (searchParams?.itens) orientationParams.set("itens", searchParams.itens);
  if (searchParams?.escopo) orientationParams.set("escopo", searchParams.escopo);
  orientationParams.set("orientacao", orientation === "horizontal" ? "vertical" : "horizontal");
  const orientationHref = `/cotacoes/${id}/mapa-pdf?${orientationParams.toString()}`;

  const rowsWithBest = rows.filter((row) => row.best);
  const bestBasketTotal = rowsWithBest.reduce((sum, row) => sum + (row.best?.total || 0), 0);
  const respondingSuppliers = new Set(activeResponses.map((response) => response.document)).size;
  const supplierColumns = activeResponses.map((response) => {
    const offers = rows.map((row) => row.offers.find((offer) => offer.responseId === response.id));
    const total = offers.reduce((sum, offer) => sum + (offer?.attends ? offer.total : 0), 0);
    const coverageCount = offers.filter((offer) => offer?.attends && offer.hasPrice).length;
    const bestCount = rows.filter((row) => row.best?.responseId === response.id).length;

    return { response, offers, total, coverageCount, bestCount };
  });

  return (
    <>
      <style>{`@page { size: A4 ${orientation === "horizontal" ? "landscape" : "portrait"}; margin: 10mm; }`}</style>
      <main className={`map-report ${orientation === "horizontal" ? "map-report-horizontal" : "map-report-vertical"}`}>
        <div className="map-report-actions">
          <Link className="button secondary" href={`/cotacoes/${id}`}>Voltar para a cotação</Link>
          <Link className="button secondary" href={orientationHref}>
            {orientation === "horizontal" ? "Versão vertical" : "Versão horizontal"}
          </Link>
          <PrintButton />
        </div>

      <header className="map-report-head">
        <div className="map-report-head-brand">
          <span>Brasin Empreendimentos - Compras</span>
          <h1>Mapa comparativo de cotação</h1>
          <p>Cotação #{quotation.code} - {scopeLabel} - gerado em {new Date().toLocaleDateString("pt-BR")}</p>
        </div>

        <div className="map-report-block map-report-grid">
          <span><strong>Comprador</strong>{quotation.buyerId || "Não informado"}</span>
          <span><strong>Data da cotação</strong>{formatOptionalDate(quotation.date)}</span>
          <span><strong>Prazo de resp.</strong>{formatOptionalDate(quotation.deadline, "Não infor.")}</span>
          <span><strong>Forn. respondentes</strong>{respondingSuppliers}</span>
          <span><strong>Itens no mapa</strong>{rows.length}</span>
          <span><strong>Melhor cesta</strong>{formatCurrency(bestBasketTotal)}</span>
        </div>
      </header>

      <section className="map-report-matrix-block">
        <div className="map-report-section-head">
          <div>
            <span>Comparativo horizontal</span>
          </div>
        </div>

        {rows.length ? (
          <div className="map-report-matrix-wrap">
            <table className="map-report-matrix">
              <thead>
                <tr>
                  <th className="map-report-item-row-col">Item</th>
                  <th className="map-report-quantity-col">Quantidade</th>
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
                      <strong>
                        <span className="map-report-item-code">#{row.item?.productId || row.itemNumber}</span>
                        {row.item?.name || `Item ${row.itemNumber}`}
                        {row.item?.detail ? ` - ${row.item.detail}` : ""}
                      </strong>
                    </td>
                    <td className="map-report-quantity-col">
                      <strong>{row.item ? row.item.quantity || 0 : "-"}</strong>
                      <small>{row.item?.unit || "un"}</small>
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
                              <div className="map-report-price-line">
                                <strong>{formatCurrency(offer.unitPrice)}</strong>
                                <small>Total {formatCurrency(offer.total)}</small>
                              </div>
                              {offer.deadlineDays > 0 && (
                                <div className="map-report-price-details">
                                  <small>Prazo {plural(offer.deadlineDays, "dia", "dias")}</small>
                                </div>
                              )}
                            </>
                          ) : (
                            <span>{offer?.hasResponse ? "Não atende" : "Sem resposta"}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="map-report-choice-col">
                      {row.best ? (
                        <strong>{firstSupplierName(row.best.supplierName)}</strong>
                      ) : (
                        <span>Sem preço</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Total cotado por fornecedor</td>
                  {supplierColumns.map(({ response, total }) => (
                    <td className="map-report-price-cell" key={`total-${response.id}`}>
                      <strong>{formatCurrency(total)}</strong>
                    </td>
                  ))}
                  <td className="map-report-choice-col total">
                    <strong>{formatCurrency(bestBasketTotal)}</strong>
                    <small>Menor cesta item a item</small>
                  </td>
                </tr>
                <tr className="map-report-extra-row">
                  <td colSpan={2}>Itens</td>
                  {supplierColumns.map(({ response, coverageCount }) => (
                    <td key={`coverage-${response.id}`}>{coverageCount}/{rows.length} com preço</td>
                  ))}
                  <td></td>
                </tr>
                <tr className="map-report-extra-row">
                  <td colSpan={2}>Melhores</td>
                  {supplierColumns.map(({ response, bestCount }) => (
                    <td key={`best-count-${response.id}`}>{bestCount ? plural(bestCount, "preço", "preços") : "Nenhum"}</td>
                  ))}
                  <td></td>
                </tr>
                <tr className="map-report-extra-row">
                  <td colSpan={2}>Pagamento</td>
                  {supplierColumns.map(({ response }) => (
                    <td key={`payment-${response.id}`}>{mapPaymentSummary(response.commercialTerms)}</td>
                  ))}
                  <td></td>
                </tr>
                <tr className="map-report-extra-row">
                  <td colSpan={2}>Frete</td>
                  {supplierColumns.map(({ response }) => (
                    <td key={`freight-${response.id}`}>{freightSummary(response.commercialTerms)}</td>
                  ))}
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="map-report-empty">Nenhum item corresponde ao filtro selecionado.</p>
        )}
      </section>

      <footer className="map-report-footer">
        Documento gerado pelo Brasin Financeiro a partir das propostas recebidas no portal do fornecedor para a cotação #{quotation.code}.
      </footer>
      </main>
    </>
  );
}
