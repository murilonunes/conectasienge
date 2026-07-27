import { I18nText } from "@/components/i18n/i18n-text";
import Link from "next/link";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { RankingChart } from "@/components/charts/ranking-chart";
import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { loadDreGerencial, loadDreYearOptions, normalizeDreYear, type DreFutureGroup, type DreMonthlyItem } from "@/features/dre/data";
import { formatCompactCurrency, formatCurrency } from "@/lib/formatters";

export const dynamic = "force-dynamic";

type DreGerencialPageProps = {
  searchParams?: {
    ano?: string | string[];
    visao?: string | string[];
  };
};

type DreGerencialData = Awaited<ReturnType<typeof loadDreGerencial>>;

function formatPercent(value: number) {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function IntegrationSummary({ integrations }: { integrations: DreGerencialData["integrations"] }) {
  return (
    <section className="card dre-integration-panel">
      {integrations.map((item) => (
        <div key={item.label}>
          <span><I18nText text={item.label} /></span>
          <strong>{item.count} <I18nText text={"registros"} /></strong>
          <small>
            {item.lastIntegrationDay
              ? `Integrado em ${item.lastIntegrationDay}`
              : item.lastSavedAt
                ? `Salvo em ${item.lastSavedAt.slice(0, 10)}`
                : <I18nText text={"Ainda sem integração salva"} />}
          </small>
        </div>
      ))}
    </section>
  );
}

function normalizeView(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "futuro" ? "futuro" : "historico";
}

function ResultTrend({ monthly }: { monthly: DreMonthlyItem[] }) {
  const max = Math.max(...monthly.map((item) => Math.abs(item.competenceResult)), 1);
  const recent = monthly.slice(-18);

  return (
    <section className="card panel dre-result-panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title"><I18nText text={"Resultado por mês"} /></h2>
          <span className="panel-note"><I18nText text={"Receita POC líquida menos custos e despesas lançados"} /></span>
        </div>
      </div>
      {recent.length ? (
        <div className="dre-result-bars">
          {recent.map((item) => {
            const positive = item.competenceResult >= 0;
            return (
              <div key={item.key} title={`${item.label}: ${formatCurrency(item.competenceResult)}`}>
                <span><I18nText text={formatCompactCurrency(item.competenceResult)} /></span>
                <div className="dre-result-track">
                  <i
                    className={positive ? "positive" : "negative"}
                    style={{ height: `${Math.max(5, (Math.abs(item.competenceResult) / max) * 100)}%` }}
                  />
                </div>
                <strong><I18nText text={item.label} /></strong>
              </div>
            );
          })}
        </div>
      ) : <div className="chart-empty"><I18nText text={"Sem dados suficientes para montar a evolução."} /></div>}
    </section>
  );
}

function MonthlyTable({ monthly }: { monthly: DreMonthlyItem[] }) {
  const rows = monthly.slice().reverse();

  return (
    <section className="card table-card dre-monthly-table">
      <div className="table-head">
        <h2 className="panel-title"><I18nText text={"DRE POC mês a mês"} /></h2>
        <span className="panel-note"><I18nText text={"Valores consolidados por competência e por caixa"} /></span>
      </div>
      {rows.length ? (
        <table>
          <thead>
            <tr>
              <th><I18nText text={"Mês"} /></th>
              <th><I18nText text={"Vendas contratadas"} /></th>
              <th><I18nText text={"Receita POC líquida"} /></th>
              <th><I18nText text={"Custos/despesas"} /></th>
              <th><I18nText text={"Resultado"} /></th>
              <th><I18nText text={"Recebido"} /></th>
              <th><I18nText text={"Pago"} /></th>
              <th><I18nText text={"Caixa"} /></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.key}>
                <td><strong><I18nText text={item.label} /></strong></td>
                <td>{formatCurrency(item.contractedRevenue)}</td>
                <td>{formatCurrency(item.netRevenue)}</td>
                <td>{formatCurrency(item.costs)}</td>
                <td className={item.competenceResult < 0 ? "negative-cell" : "positive-cell"}>{formatCurrency(item.competenceResult)}</td>
                <td>{formatCurrency(item.received)}</td>
                <td>{formatCurrency(item.paid)}</td>
                <td className={item.cashResult < 0 ? "negative-cell" : "positive-cell"}>{formatCurrency(item.cashResult)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <div className="empty-state"><I18nText text={"Nenhum mês com dados salvos para este ano."} /></div>}
    </section>
  );
}

function FutureGroups({ groups }: { groups: DreFutureGroup[] }) {
  return (
    <section className="card table-card dre-monthly-table">
      <div className="table-head">
        <h2 className="panel-title"><I18nText text={"Futuro financeiro da carteira POC"} /></h2>
        <span className="panel-note"><I18nText text={"Parcelas abertas a receber e a pagar, agrupadas pelo vencimento a partir de hoje"} /></span>
      </div>
      <table>
        <thead>
          <tr>
            <th><I18nText text={"Faixa"} /></th>
            <th><I18nText text={"A receber aberto"} /></th>
            <th><I18nText text={"Parcelas a receber"} /></th>
            <th><I18nText text={"A pagar aberto"} /></th>
            <th><I18nText text={"Parcelas a pagar"} /></th>
            <th><I18nText text={"Saldo de caixa"} /></th>
          </tr>
        </thead>
        <tbody>
          {groups.map((item) => (
            <tr key={item.key}>
              <td><strong><I18nText text={item.label} /></strong></td>
              <td>{formatCurrency(item.receivableOpen)}</td>
              <td>{item.receivableCount}</td>
              <td>{formatCurrency(item.payableOpen)}</td>
              <td>{item.payableCount}</td>
              <td className={item.netCash < 0 ? "negative-cell" : "positive-cell"}>{formatCurrency(item.netCash)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function FuturePocView({ dre }: { dre: DreGerencialData }) {
  const hasFutureMargin = dre.futureRemainingPocRevenue - dre.futureOpenPayables >= 0;
  const matchedShare = dre.futureContractedRevenue ? (dre.futurePocMatchedRevenue / dre.futureContractedRevenue) * 100 : 0;

  return (
    <>
      <section className={`card dashboard-executive dre-executive ${hasFutureMargin ? "" : "warning"}`}>
        <div className="dashboard-executive-main">
          <span><I18nText text={hasFutureMargin ? "Potencial POC futuro positivo" : "Potencial POC futuro pressionado"} /></span>
          <h2><I18nText text={formatCompactCurrency(dre.futureRemainingPocRevenue)} /></h2>
          <p>
            <I18nText text={"Receita POC ainda a reconhecer pela carteira ativa, considerando o percentual de avanço salvo hoje. Essa leitura não cria cronograma de medição; ela mostra o estoque de resultado ainda não reconhecido."} />
          </p>
        </div>
        <div className="dashboard-executive-grid">
          <div>
            <span><I18nText text={"POC já reconhecido"} /></span>
            <strong><I18nText text={formatCompactCurrency(dre.futureCurrentPocRevenue)} /></strong>
            <small>{formatPercent(dre.futurePocCoverage)} <I18nText text={"da carteira ativa já está reconhecida pela base atual."} /></small>
          </div>
          <div>
            <span><I18nText text={"Saldo futuro de caixa"} /></span>
            <strong className={dre.futureCashResult < 0 ? "negative" : ""}><I18nText text={formatCompactCurrency(dre.futureCashResult)} /></strong>
            <small>{formatCompactCurrency(dre.futureOpenReceivables)} <I18nText text={"a receber e"} /> {formatCompactCurrency(dre.futureOpenPayables)} <I18nText text={"a pagar."} /></small>
          </div>
          <div>
            <span><I18nText text={"Sem vínculo POC"} /></span>
            <strong className={dre.futurePocUnmatchedCount > 0 ? "negative" : ""}>{formatCompactCurrency(dre.futurePocUnmatchedRevenue)}</strong>
            <small>{dre.futurePocUnmatchedCount} <I18nText text={"contrato(s) ativos sem obra/contrato de fornecimento vinculado."} /></small>
          </div>
        </div>
      </section>

      <div className="stats dre-stats">
        <StatCard label="Carteira ativa" value={formatCompactCurrency(dre.futureContractedRevenue)} delta={`${dre.futurePocContractCount} contratos ativos analisados`} icon="CA" />
        <StatCard label="A reconhecer POC" value={formatCompactCurrency(dre.futureRemainingPocRevenue)} delta={`${dre.futurePocMatchedCount} contratos com vínculo de obra`} icon="PR" />
        <StatCard label="Cobertura POC" value={formatPercent(matchedShare)} delta="Parcela da carteira com vínculo para cálculo do avanço" warn={matchedShare < 90} icon="%" />
        <StatCard label="Contratos completos" value={String(dre.futurePocCompletedCount)} delta="Sem saldo POC estimado a reconhecer" icon="OK" />
        <StatCard label="A receber futuro" value={formatCompactCurrency(dre.futureOpenReceivables)} delta={`${dre.futureOpenReceivablesCount} parcelas abertas`} icon="AR" />
        <StatCard label="A pagar futuro" value={formatCompactCurrency(dre.futureOpenPayables)} delta={`${dre.futureOpenPayablesCount} parcelas abertas`} warn={dre.futureOpenPayables > dre.futureOpenReceivables} icon="AP" />
      </div>

      <FutureGroups groups={dre.futureGroups} />

      <div className="grid-main equal-grid">
        <RankingChart title="POC a reconhecer por empreendimento" note="Receita potencial ainda não reconhecida pela medição atual" data={dre.futurePocByEnterprise} countLabel="contrato" />
        <RankingChart title="Recebíveis futuros por cliente" note="Maiores saldos abertos a receber" data={dre.futureReceivablesByClient} countLabel="parcela" />
      </div>

      <div className="grid-main equal-grid">
        <RankingChart title="Compromissos futuros por fornecedor" note="Maiores saldos abertos a pagar" data={dre.futurePayablesByCreditor} countLabel="parcela" />
        <section className="card panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title"><I18nText text={"Leitura da visão futura"} /></h2>
              <span className="panel-note"><I18nText text={"A projeção usa a base salva, sem consultar o Sienge na abertura"} /></span>
            </div>
          </div>
          <div className="dashboard-period-list">
            <div>
              <span><I18nText text={"Data base"} /></span>
              <strong>{dre.baseDate}</strong>
              <small><span><I18nText text={"Referência"} /></span><span><I18nText text={"Vencimentos futuros partem desta data."} /></span></small>
            </div>
            <div>
              <span><I18nText text={"Receita remanescente"} /></span>
              <strong><I18nText text={formatCompactCurrency(dre.futureRemainingPocRevenue)} /></strong>
              <small><span><I18nText text={"POC"} /></span><span><I18nText text={"Carteira vendida menos POC reconhecido pela última medição."} /></span></small>
            </div>
            <div>
              <span><I18nText text={"Sem cronograma mensal"} /></span>
              <strong><I18nText text={"Estimativa"} /></strong>
              <small><span><I18nText text={"Limite"} /></span><span><I18nText text={"Falta histórico de medições futuras por obra/unidade."} /></span></small>
            </div>
          </div>
        </section>
      </div>

      <section className="card methodology dre-methodology">
        <strong><I18nText text={"Como ler o futuro da DRE POC"} /></strong>
        <p>
          <I18nText text={"A visão futura parte da carteira ativa de vendas e calcula o que ainda falta reconhecer no POC usando o avanço atual dos contratos de fornecimento. O caixa futuro vem das parcelas abertas de contas a receber e contas a pagar. Como ainda não há cronograma mensal de medições futuras, a receita POC futura aparece como backlog por empreendimento, não como previsão mensal contábil."} />
        </p>
      </section>
    </>
  );
}

export default async function DreGerencialPage({ searchParams }: DreGerencialPageProps) {
  const availableYears = loadDreYearOptions();
  const selectedYear = normalizeDreYear(searchParams?.ano, availableYears);
  const selectedView = normalizeView(searchParams?.visao);
  const requestedYearParam = Array.isArray(searchParams?.ano) ? searchParams?.ano[0] : searchParams?.ano;
  const requestedYear = Number(requestedYearParam);
  const yearWasAdjusted = Boolean(requestedYearParam && Number.isInteger(requestedYear) && requestedYear !== selectedYear);
  const dre = await loadDreGerencial(selectedYear);
  const hasProfit = dre.netResult >= 0;
  const cashPositive = dre.cashResult >= 0;

  return (
    <>
      <PageHeading
        eyebrow={selectedView === "futuro" ? "Resultado futuro" : "Resultado histórico"}
        title="DRE POC estimada"
        subtitle={selectedView === "futuro"
          ? "Visão futura da carteira POC: receita ainda a reconhecer, caixa aberto e compromissos por vencimento."
          : "Análise gerencial anual: estima receita por avanço da obra, compara custos e separa o caixa realizado."}
        action="Atualizar dados"
        actionHref="/configuracoes"
      />

      <section className="reports-filter card">
        <div>
          <span><I18nText text={"Exercício"} /></span>
          <strong>{selectedYear}</strong>
          <small>{dre.range.start} <I18nText text={"até"} /> {dre.range.end}</small>
        </div>
        <div className="dashboard-view-controls">
          <div className="dashboard-direction-options" aria-label="Visão da DRE POC" data-i18n-aria-label={"Visão da DRE POC"}>
            <Link href={`/dre-gerencial?ano=${selectedYear}&visao=historico`} className={selectedView === "historico" ? "active" : ""}><I18nText text={"Histórico"} /></Link>
            <Link href={`/dre-gerencial?ano=${selectedYear}&visao=futuro`} className={selectedView === "futuro" ? "active" : ""}><I18nText text={"Futuro"} /></Link>
          </div>
          <div className="dashboard-view-options compact" aria-label="Ano da DRE" data-i18n-aria-label={"Ano da DRE"}>
            {availableYears.map((year) => (
              <Link
                key={year}
                href={`/dre-gerencial?ano=${year}&visao=${selectedView}`}
                className={year === selectedYear ? "active" : ""}
              >
                {year}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {yearWasAdjusted && (
        <section className="card data-notice">
          <strong><I18nText text={"Ano ajustado"} /></strong>
          <span>
            <I18nText text={"O exercício"} /> {requestedYear} <I18nText text={"não tem vendas ou contratos salvos para calcular POC. A tela foi aberta em"} /> {selectedYear}<I18nText text={", que possui base comercial local."} />
          </span>
        </section>
      )}

      {dre.unavailable.length > 0 && (
        <section className="card data-notice">
          <strong><I18nText text={"Visão parcial"} /></strong>
          <span><I18nText text={"Algumas áreas ainda não têm dados salvos:"} /> {dre.unavailable.join(", ")}<I18nText text={". Atualize essas áreas em Configurações para completar a DRE."} /></span>
        </section>
      )}

      <section className="card data-notice">
        <strong><I18nText text={"Estimativa gerencial"} /></strong>
        <span>
          <I18nText text={"Esta visão ainda não substitui a apuração contábil do POC por unidade vendida. Ela usa os dados salvos para estimar receita por avanço de obra e destacar o que precisa ser validado."} />
        </span>
      </section>

      {dre.pocSourceContractCount === 0 && (
        <section className="card data-notice">
          <strong><I18nText text={"POC sem base de medição"} /></strong>
          <span>
            <I18nText text={"A tela precisa dos contratos de fornecimento com valor contratado e valor medido para reconhecer receita por avanço da obra. Atualize Contratos em Configurações; até lá, a Receita POC fica zerada para não transformar venda contratada em receita."} />
          </span>
        </section>
      )}

      {selectedView === "futuro" ? <FuturePocView dre={dre} /> : <>
      <section className={`card dashboard-executive dre-executive ${hasProfit ? "" : "warning"}`}>
        <div className="dashboard-executive-main">
          <span><I18nText text={hasProfit ? "Lucro POC estimado" : "Prejuízo POC estimado"} /></span>
          <h2><I18nText text={formatCompactCurrency(dre.netResult)} /></h2>
          <p>
            <I18nText text={"Receita POC líquida de"} /> {formatCompactCurrency(dre.netRevenue)} <I18nText text={"menos"} /> {formatCompactCurrency(dre.costAmount)}
            <I18nText text={" "} /><I18nText text={"em custos e despesas lançados. POC médio ponderado de"} /> {formatPercent(dre.averagePoc * 100)}<I18nText text={"."} />
          </p>
        </div>
        <div className="dashboard-executive-grid">
          <div>
            <span><I18nText text={"Caixa realizado"} /></span>
            <strong className={dre.cashResult < 0 ? "negative" : ""}><I18nText text={formatCompactCurrency(dre.cashResult)} /></strong>
            <small><I18nText text={cashPositive ? "Entrou mais dinheiro do que saiu." : "Saiu mais dinheiro do que entrou."} /></small>
          </div>
          <div>
            <span><I18nText text={"A receber até o ano"} /></span>
            <strong><I18nText text={formatCompactCurrency(dre.openReceivables)} /></strong>
            <small>{dre.openReceivablesCount} <I18nText text={"parcelas abertas com vencimento até"} /> {selectedYear}</small>
          </div>
          <div>
            <span><I18nText text={"A pagar até o ano"} /></span>
            <strong className={dre.openPayables > 0 ? "negative" : ""}>{formatCompactCurrency(dre.openPayables)}</strong>
            <small>{dre.openPayablesCount} <I18nText text={"parcelas abertas com vencimento até"} /> {selectedYear}</small>
          </div>
        </div>
      </section>

      <div className="stats dre-stats">
        <StatCard label="Receita POC" value={formatCompactCurrency(dre.pocRevenue)} delta={`${dre.pocMatchedCount} contratos vinculados ao avanço`} icon="R$" />
        <StatCard label="Vendas contratadas" value={formatCompactCurrency(dre.contractedRevenue)} delta={`${dre.contractCount} contratos no ano`} icon="V" />
        <StatCard label="Margem POC estimada" value={formatPercent(dre.margin)} delta="Resultado POC sobre receita líquida" warn={dre.margin < 0} icon="%" />
        <StatCard label="POC médio" value={formatPercent(dre.averagePoc * 100)} delta={`${dre.pocUnmatchedCount} contratos sem vínculo de obra`} warn={dre.pocUnmatchedCount > 0} icon="%" />
        <StatCard label="Base de avanço" value={formatPercent(dre.pocSourceAveragePercent * 100)} delta={`${dre.pocSourceContractCount} contratos medidos`} warn={dre.pocSourceContractCount === 0} icon="B" />
        <StatCard label="Cancelamentos POC" value={formatCompactCurrency(dre.cancellations)} delta={`${dre.cancelledContractCount} contratos cancelados/distratados`} warn={dre.cancellations > 0} icon="-" />
        <StatCard label="Custos e despesas" value={formatCompactCurrency(dre.costAmount)} delta={`${dre.costCount} parcelas lançadas`} warn={dre.costAmount > dre.netRevenue} icon="C" />
        <StatCard label="Recebido" value={formatCompactCurrency(dre.receivedAmount)} delta={`${dre.receivedCount} recebimentos no ano`} icon="R" />
        <StatCard label="Pago" value={formatCompactCurrency(dre.paidAmount)} delta={`${dre.paidCount} pagamentos no ano`} warn={dre.paidAmount > dre.receivedAmount} icon="S" />
      </div>

      <IntegrationSummary integrations={dre.integrations} />

      <div className="dre-grid-wide">
        <CashFlowChart
          data={dre.competenceFlow}
          title="Receita POC x custos"
          note="Receita reconhecida pelo POC e custos lançados, agrupados por mês"
        />
        <CashFlowChart
          data={dre.cashFlow}
          title="Recebido x pago"
          note="Leitura de caixa realizado, agrupada por mês"
        />
      </div>

      <ResultTrend monthly={dre.monthly} />

      <div className="grid-main equal-grid">
        <RankingChart title="Custos por fornecedor" note="Maiores custos e despesas lançados" data={dre.expenseByCreditor} countLabel="parcela" />
        <RankingChart title="Receita POC por empreendimento" note="Maiores receitas reconhecidas no ano" data={dre.salesByEnterprise} countLabel="contrato" />
      </div>

      <div className="grid-main equal-grid">
        <RankingChart title="Avanço POC por obra" note="Percentual medido sobre contratado nos contratos de fornecimento" data={dre.pocProgressRanking} valueKind="percent" countLabel="contrato" />
        <section className="card panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title"><I18nText text={"Base usada no POC"} /></h2>
              <span className="panel-note"><I18nText text={"Valores de contratos de fornecimento salvos localmente"} /></span>
            </div>
          </div>
          <div className="dashboard-period-list">
            <div>
              <span><I18nText text={"Valor contratado"} /></span>
              <strong><I18nText text={formatCompactCurrency(dre.pocSourcePlannedCost)} /></strong>
              <small><span><I18nText text={"Base de custo"} /></span><span>{dre.pocSourceContractCount} <I18nText text={"contratos com medição"} /></span></small>
            </div>
            <div>
              <span><I18nText text={"Valor medido"} /></span>
              <strong><I18nText text={formatCompactCurrency(dre.pocSourceMeasuredCost)} /></strong>
              <small><span><I18nText text={"Avanço reconhecido"} /></span><span>{formatPercent(dre.pocSourceAveragePercent * 100)} <I18nText text={"medido sobre contratado"} /></span></small>
            </div>
            <div>
              <span><I18nText text={"Vendas sem vínculo"} /></span>
              <strong>{dre.pocUnmatchedCount}</strong>
              <small><span><I18nText text={"A revisar"} /></span><span><I18nText text={"Essas vendas não entraram na Receita POC."} /></span></small>
            </div>
          </div>
        </section>
      </div>

      <MonthlyTable monthly={dre.monthly} />

      <section className="card methodology dre-methodology">
        <strong><I18nText text={"Como ler esta DRE POC estimada"} /></strong>
        <p>
          <I18nText text={"Resultado POC considera vendas contratadas multiplicadas pelo percentual de avanço encontrado nos contratos de fornecimento da obra, menos cancelamentos, custos e despesas lançados. Caixa realizado continua separado: recebimentos efetivos menos pagamentos efetivos. Quando uma venda não encontra vínculo com obra/contrato, ela fica fora da receita POC e aparece no card de contratos sem vínculo. Sem histórico mensal de medições e sem apropriação por unidade vendida, a receita POC é uma estimativa anual baseada na última medição salva."} />
        </p>
      </section>
      </>}
    </>
  );
}
