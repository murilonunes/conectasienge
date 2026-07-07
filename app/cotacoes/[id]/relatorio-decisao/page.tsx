import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDocument, freightSummary, paymentSummary, plural } from "@/components/purchases/quotation-detail/helpers";
import { PrintButton } from "@/components/ui/print-button";
import { loadQuotationDetail } from "@/features/quotations/data";
import { formatCurrency, formatOptionalDate } from "@/lib/formatters";
import { loadSupplierQuoteAwards, loadSupplierQuoteResponses, type SupplierQuoteResponseSummary } from "@/lib/supplier-quote-portal";

export const dynamic = "force-dynamic";

type ChosenOffer = {
  response: SupplierQuoteResponseSummary;
  unitPrice: number;
  quantity: number;
  total: number;
  justification: string;
};

export default async function QuotationDecisionReportPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  const quotation = await loadQuotationDetail(id);
  if (!quotation) notFound();

  const allResponses = loadSupplierQuoteResponses(id);
  const responses = allResponses.filter((response) => !response.supersededByResponseId);
  const supersededCount = allResponses.length - responses.length;
  const awards = loadSupplierQuoteAwards(id);
  const quotationAward = awards.find((award) => award.scope === "quotation");
  const itemAwards = new Map(awards.filter((award) => award.scope === "item" && award.itemNumber).map((award) => [award.itemNumber as number, award]));
  const decidedAt = awards[0]?.createdAt;

  const rows = quotation.items.map((item) => {
    const offers = responses
      .map((response) => {
        const quoted = response.items.find((current) => current.itemNumber === item.itemNumber);
        if (!quoted?.attends || !(Number(quoted.unitPrice) > 0)) return undefined;
        return {
          response,
          unitPrice: Number(quoted.unitPrice) || 0,
          quantity: Number(quoted.quantity) || 0,
          total: (Number(quoted.unitPrice) || 0) * (Number(quoted.quantity) || 0)
        };
      })
      .filter((offer): offer is NonNullable<typeof offer> => Boolean(offer));
    const best = [...offers].sort((left, right) => left.unitPrice - right.unitPrice)[0];

    const itemAward = itemAwards.get(item.itemNumber);
    const winnerAward = itemAward || quotationAward;
    const chosenOffer = winnerAward ? offers.find((offer) => offer.response.id === winnerAward.responseId) : undefined;
    const chosen: ChosenOffer | undefined = chosenOffer
      ? { ...chosenOffer, justification: winnerAward?.justification || "" }
      : undefined;

    return { item, offers, best, chosen };
  });

  const chosenTotal = rows.reduce((sum, row) => sum + (row.chosen?.total || 0), 0);
  const bestTotal = rows.reduce((sum, row) => sum + (row.best?.total || 0), 0);
  const itemsWithChoice = rows.filter((row) => row.chosen).length;
  const winners = Array.from(new Map(awards.map((award) => [award.responseId, award])).values());

  return (
    <main className="decision-report">
      <div className="decision-report-actions">
        <Link className="button secondary" href={`/cotacoes/${id}`}>Voltar para a cotação</Link>
        <PrintButton />
      </div>

      <header className="decision-report-head">
        <div>
          <span>Brasin Empreendimentos — Compras</span>
          <h1>Relatório de decisão de cotação</h1>
          <p>Cotação #{quotation.code} — emitido em {new Date().toLocaleDateString("pt-BR")}</p>
        </div>
        <div className="decision-report-summary">
          <span><strong>{formatCurrency(chosenTotal)}</strong><small>Total decidido</small></span>
          <span><strong>{itemsWithChoice} de {quotation.items.length}</strong><small>Itens com vencedor</small></span>
          <span><strong>{responses.length}</strong><small>Propostas consideradas</small></span>
        </div>
      </header>

      <section className="decision-report-block decision-report-grid">
        <span><strong>Comprador</strong>{quotation.buyerId}</span>
        <span><strong>Data da cotação</strong>{formatOptionalDate(quotation.date)}</span>
        <span><strong>Prazo de respostas</strong>{formatOptionalDate(quotation.deadline)}</span>
        <span><strong>Decisão salva em</strong>{decidedAt ? formatOptionalDate(decidedAt) : "Sem decisão salva"}</span>
        <span><strong>Modalidade</strong>{quotationAward ? "Cotação inteira" : itemAwards.size ? "Por item" : "Não definida"}</span>
        <span><strong>Melhor cesta teórica</strong>{formatCurrency(bestTotal)}</span>
      </section>

      <section className="decision-report-block">
        <h2>Fornecedor(es) vencedor(es) e justificativas</h2>
        {winners.length ? (
          <div className="decision-report-winners">
            {winners.map((award) => (
              <article key={award.responseId}>
                <div>
                  <strong>{award.supplierName}</strong>
                  <small>{formatDocument(award.document)} — {award.scope === "quotation" ? "cotação inteira" : `${plural(awards.filter((current) => current.scope === "item" && current.responseId === award.responseId).length, "item", "itens")}`}</small>
                </div>
                <p>{award.justification}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="decision-report-empty">Nenhuma decisão foi salva para esta cotação até o momento.</p>
        )}
      </section>

      <section className="decision-report-block">
        <h2>Mapa da decisão por item</h2>
        <table className="decision-report-table">
          <thead>
            <tr>
              <th>Insumo</th>
              <th>Qtd.</th>
              <th>Fornecedor escolhido</th>
              <th>Preço unit.</th>
              <th>Total</th>
              <th>Melhor preço</th>
              <th>Justificativa</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item, best, chosen }) => (
              <tr key={item.itemNumber}>
                <td><strong>{item.name}</strong><br /><small>#{item.productId || item.itemNumber} — {item.unit}</small></td>
                <td>{item.quantity}</td>
                <td>{chosen ? chosen.response.supplierName : "—"}</td>
                <td>{chosen ? formatCurrency(chosen.unitPrice) : "—"}</td>
                <td>{chosen ? formatCurrency(chosen.total) : "—"}</td>
                <td>
                  {best ? `${formatCurrency(best.unitPrice)} (${best.response.supplierName})` : "Sem preço"}
                  {chosen && best && chosen.response.id !== best.response.id && <em> — escolha difere do menor preço</em>}
                </td>
                <td className="decision-report-justification">{chosen?.justification || "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Total da decisão</td>
              <td>{formatCurrency(chosenTotal)}</td>
              <td colSpan={2}>Melhor cesta teórica: {formatCurrency(bestTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="decision-report-block">
        <h2>Propostas consideradas</h2>
        <table className="decision-report-table">
          <thead>
            <tr>
              <th>Fornecedor</th>
              <th>CPF/CNPJ</th>
              <th>Recebida em</th>
              <th>Total</th>
              <th>Pagamento</th>
              <th>Frete e entrega</th>
            </tr>
          </thead>
          <tbody>
            {responses.map((response) => (
              <tr key={response.id}>
                <td><strong>{response.supplierName}</strong><br /><small>Resposta #{response.id}</small></td>
                <td>{formatDocument(response.document)}</td>
                <td>{formatOptionalDate(response.createdAt)}</td>
                <td>{formatCurrency(response.totalValue)}</td>
                <td>{paymentSummary(response.commercialTerms)}</td>
                <td>{freightSummary(response.commercialTerms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {supersededCount > 0 && (
          <p className="decision-report-note">
            {plural(supersededCount, "proposta anterior foi substituída por revisão e ficou fora", "propostas anteriores foram substituídas por revisão e ficaram fora")} desta comparação (histórico disponível na aba Respostas).
          </p>
        )}
        {!responses.length && <p className="decision-report-empty">Nenhuma proposta ativa recebida pelo portal.</p>}
      </section>

      <section className="decision-report-signatures">
        <div><span /><p>Comprador responsável</p></div>
        <div><span /><p>Aprovação</p></div>
      </section>

      <footer className="decision-report-footer">
        Documento gerado pelo Brasin Financeiro a partir das propostas recebidas no portal do fornecedor e da decisão registrada na cotação #{quotation.code}.
      </footer>
    </main>
  );
}
