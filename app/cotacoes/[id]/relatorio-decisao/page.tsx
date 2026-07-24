import { I18nText } from "@/components/i18n/i18n-text";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { formatDocument, freightSummary, paymentSummary, plural } from "@/components/purchases/quotation-detail/helpers";
import { PrintButton } from "@/components/ui/print-button";
import { loadQuotationDetail } from "@/features/quotations/data";
import { getSessionUserFromCookieValue } from "@/lib/app-users";
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
  const user = getSessionUserFromCookieValue(cookies().get("brasin_session")?.value);
  if (!user?.permissions.includes("screen.cotacoes")) {
    return (
      <main className="decision-report">
        <section className="card panel access-denied-panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title"><I18nText text={"Acesso não liberado"} /></h2>
              <span className="panel-note"><I18nText text={"Seu usuário não tem permissão para relatórios de cotação"} /></span>
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
        <Link className="button secondary" href={`/cotacoes/${id}`}><I18nText text={"Voltar para a cotação"} /></Link>
        <PrintButton />
      </div>

      <header className="decision-report-head">
        <div>
          <span><I18nText text={"Brasin Empreendimentos — Compras"} /></span>
          <h1><I18nText text={"Relatório de decisão de cotação"} /></h1>
          <p><I18nText text={"Cotação #"} />{quotation.code} <I18nText text={"— emitido em"} /> {new Date().toLocaleDateString("pt-BR")}</p>
        </div>
        <div className="decision-report-summary">
          <span><strong>{formatCurrency(chosenTotal)}</strong><small><I18nText text={"Total decidido"} /></small></span>
          <span><strong>{itemsWithChoice} <I18nText text={"de"} /> {quotation.items.length}</strong><small><I18nText text={"Itens com vencedor"} /></small></span>
          <span><strong>{responses.length}</strong><small><I18nText text={"Propostas consideradas"} /></small></span>
        </div>
      </header>

      <section className="decision-report-block decision-report-grid">
        <span><strong><I18nText text={"Comprador"} /></strong>{quotation.buyerId}</span>
        <span><strong><I18nText text={"Data da cotação"} /></strong>{formatOptionalDate(quotation.date)}</span>
        <span><strong><I18nText text={"Prazo de respostas"} /></strong>{formatOptionalDate(quotation.deadline)}</span>
        <span><strong><I18nText text={"Decisão salva em"} /></strong>{decidedAt ? formatOptionalDate(decidedAt) : <I18nText text={"Sem decisão salva"} />}</span>
        <span><strong><I18nText text={"Aprovado por"} /></strong>{awards.find((award) => award.createdBy)?.createdBy || <I18nText text={"Não registrado"} />}</span>
        <span><strong><I18nText text={"Modalidade"} /></strong>{quotationAward ? <I18nText text={"Cotação inteira"} /> : itemAwards.size ? <I18nText text={"Por item"} /> : <I18nText text={"Não definida"} />}</span>
      </section>

      <section className="decision-report-block">
        <h2><I18nText text={"Fornecedor(es) vencedor(es) e justificativas"} /></h2>
        {winners.length ? (
          <div className="decision-report-winners">
            {winners.map((award) => (
              <article key={award.responseId}>
                <div>
                  <strong>{award.supplierName}</strong>
                  <small>{formatDocument(award.document)} <I18nText text={"—"} /> {award.scope === "quotation" ? <I18nText text={"cotação inteira"} /> : `${plural(awards.filter((current) => current.scope === "item" && current.responseId === award.responseId).length, "item", "itens")}`}</small>
                </div>
                <p>{award.justification}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="decision-report-empty"><I18nText text={"Nenhuma decisão foi salva para esta cotação até o momento."} /></p>
        )}
      </section>

      <section className="decision-report-block">
        <h2><I18nText text={"Mapa da decisão por item"} /></h2>
        <table className="decision-report-table">
          <thead>
            <tr>
              <th><I18nText text={"Insumo"} /></th>
              <th><I18nText text={"Qtd."} /></th>
              <th><I18nText text={"Fornecedor escolhido"} /></th>
              <th><I18nText text={"Preço unit."} /></th>
              <th><I18nText text={"Total"} /></th>
              <th><I18nText text={"Melhor preço"} /></th>
              <th><I18nText text={"Justificativa"} /></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item, best, chosen }) => (
              <tr key={item.itemNumber}>
                <td><strong>{item.name}</strong><br /><small><I18nText text={"#"} />{item.productId || item.itemNumber} <I18nText text={"—"} /> {item.unit}</small></td>
                <td>{item.quantity}</td>
                <td>{chosen ? chosen.response.supplierName : <I18nText text={"—"} />}</td>
                <td>{chosen ? formatCurrency(chosen.unitPrice) : <I18nText text={"—"} />}</td>
                <td>{chosen ? formatCurrency(chosen.total) : <I18nText text={"—"} />}</td>
                <td>
                  {best ? `${formatCurrency(best.unitPrice)} (${best.response.supplierName})` : <I18nText text={"Sem preço"} />}
                  {chosen && best && chosen.response.id !== best.response.id && <em> <I18nText text={"— escolha difere do menor preço"} /></em>}
                </td>
                <td className="decision-report-justification">{chosen?.justification || <I18nText text={"—"} />}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}><I18nText text={"Total da decisão"} /></td>
              <td>{formatCurrency(chosenTotal)}</td>
              <td colSpan={2}><I18nText text={"Melhor cesta teórica:"} /> {formatCurrency(bestTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="decision-report-block">
        <h2><I18nText text={"Propostas consideradas"} /></h2>
        <table className="decision-report-table">
          <thead>
            <tr>
              <th><I18nText text={"Fornecedor"} /></th>
              <th><I18nText text={"CPF/CNPJ"} /></th>
              <th><I18nText text={"Recebida em"} /></th>
              <th><I18nText text={"Total"} /></th>
              <th><I18nText text={"Pagamento"} /></th>
              <th><I18nText text={"Frete e entrega"} /></th>
            </tr>
          </thead>
          <tbody>
            {responses.map((response) => (
              <tr key={response.id}>
                <td><strong>{response.supplierName}</strong><br /><small><I18nText text={"Resposta #"} />{response.id}</small></td>
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
            {plural(supersededCount, "proposta anterior foi substituída por revisão e ficou fora", "propostas anteriores foram substituídas por revisão e ficaram fora")} <I18nText text={"desta comparação (histórico disponível na aba Respostas)."} />
          </p>
        )}
        {!responses.length && <p className="decision-report-empty"><I18nText text={"Nenhuma proposta ativa recebida pelo portal."} /></p>}
      </section>

      <section className="decision-report-signatures">
        <div><span /><p><I18nText text={"Comprador responsável"} /></p></div>
        <div><span /><p><I18nText text={"Aprovação"} /></p></div>
      </section>

      <footer className="decision-report-footer">
        <I18nText text={"Documento gerado pelo Brasin Financeiro a partir das propostas recebidas no portal do fornecedor e da decisão registrada na cotação #"} />{quotation.code}<I18nText text={"."} />
      </footer>
    </main>
  );
}
