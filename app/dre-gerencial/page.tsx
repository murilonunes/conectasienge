import Link from "next/link";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { RankingChart } from "@/components/charts/ranking-chart";
import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { loadDreGerencial, loadDreYearOptions, normalizeDreYear, type DreMonthlyItem } from "@/features/dre/data";
import { formatCompactCurrency, formatCurrency } from "@/lib/formatters";

export const dynamic = "force-dynamic";

type DreGerencialPageProps = {
  searchParams?: {
    ano?: string | string[];
  };
};

function formatPercent(value: number) {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function IntegrationSummary({ integrations }: { integrations: Awaited<ReturnType<typeof loadDreGerencial>>["integrations"] }) {
  return (
    <section className="card dre-integration-panel">
      {integrations.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{item.count} registros</strong>
          <small>
            {item.lastIntegrationDay
              ? `Integrado em ${item.lastIntegrationDay}`
              : item.lastSavedAt
                ? `Salvo em ${item.lastSavedAt.slice(0, 10)}`
                : "Ainda sem integração salva"}
          </small>
        </div>
      ))}
    </section>
  );
}

function ResultTrend({ monthly }: { monthly: DreMonthlyItem[] }) {
  const max = Math.max(...monthly.map((item) => Math.abs(item.competenceResult)), 1);
  const recent = monthly.slice(-18);

  return (
    <section className="card panel dre-result-panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Resultado por mês</h2>
          <span className="panel-note">Receita POC líquida menos custos e despesas lançados</span>
        </div>
      </div>
      {recent.length ? (
        <div className="dre-result-bars">
          {recent.map((item) => {
            const positive = item.competenceResult >= 0;
            return (
              <div key={item.key} title={`${item.label}: ${formatCurrency(item.competenceResult)}`}>
                <span>{formatCompactCurrency(item.competenceResult)}</span>
                <div className="dre-result-track">
                  <i
                    className={positive ? "positive" : "negative"}
                    style={{ height: `${Math.max(5, (Math.abs(item.competenceResult) / max) * 100)}%` }}
                  />
                </div>
                <strong>{item.label}</strong>
              </div>
            );
          })}
        </div>
      ) : <div className="chart-empty">Sem dados suficientes para montar a evolução.</div>}
    </section>
  );
}

function MonthlyTable({ monthly }: { monthly: DreMonthlyItem[] }) {
  const rows = monthly.slice().reverse();

  return (
    <section className="card table-card dre-monthly-table">
      <div className="table-head">
        <h2 className="panel-title">DRE POC mês a mês</h2>
        <span className="panel-note">Valores consolidados por competência e por caixa</span>
      </div>
      {rows.length ? (
        <table>
          <thead>
            <tr>
              <th>Mês</th>
              <th>Vendas contratadas</th>
              <th>Receita POC líquida</th>
              <th>Custos/despesas</th>
              <th>Resultado</th>
              <th>Recebido</th>
              <th>Pago</th>
              <th>Caixa</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.key}>
                <td><strong>{item.label}</strong></td>
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
      ) : <div className="empty-state">Nenhum mês com dados salvos para este ano.</div>}
    </section>
  );
}

export default async function DreGerencialPage({ searchParams }: DreGerencialPageProps) {
  const availableYears = loadDreYearOptions();
  const selectedYear = normalizeDreYear(searchParams?.ano, availableYears);
  const requestedYearParam = Array.isArray(searchParams?.ano) ? searchParams?.ano[0] : searchParams?.ano;
  const requestedYear = Number(requestedYearParam);
  const yearWasAdjusted = Boolean(requestedYearParam && Number.isInteger(requestedYear) && requestedYear !== selectedYear);
  const dre = await loadDreGerencial(selectedYear);
  const hasProfit = dre.netResult >= 0;
  const cashPositive = dre.cashResult >= 0;

  return (
    <>
      <PageHeading
        eyebrow="Resultado histórico"
        title="DRE POC estimada"
        subtitle="Análise gerencial anual: estima receita por avanço da obra, compara custos e separa o caixa realizado."
        action="Atualizar dados"
        actionHref="/configuracoes"
      />

      <section className="reports-filter card">
        <div>
          <span>Exercício</span>
          <strong>{selectedYear}</strong>
          <small>{dre.range.start} até {dre.range.end}</small>
        </div>
        <div className="dashboard-view-controls">
          <div className="dashboard-view-options compact" aria-label="Ano da DRE">
            {availableYears.map((year) => (
              <Link
                key={year}
                href={`/dre-gerencial?ano=${year}`}
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
          <strong>Ano ajustado</strong>
          <span>
            O exercício {requestedYear} não tem vendas ou contratos salvos para calcular POC.
            A tela foi aberta em {selectedYear}, que possui base comercial local.
          </span>
        </section>
      )}

      {dre.unavailable.length > 0 && (
        <section className="card data-notice">
          <strong>Visão parcial</strong>
          <span>Algumas áreas ainda não têm dados salvos: {dre.unavailable.join(", ")}. Atualize essas áreas em Configurações para completar a DRE.</span>
        </section>
      )}

      <section className="card data-notice">
        <strong>Estimativa gerencial</strong>
        <span>
          Esta visão ainda não substitui a apuração contábil do POC por unidade vendida. Ela usa os dados salvos para estimar
          receita por avanço de obra e destacar o que precisa ser validado.
        </span>
      </section>

      {dre.pocSourceContractCount === 0 && (
        <section className="card data-notice">
          <strong>POC sem base de medição</strong>
          <span>
            A tela precisa dos contratos de fornecimento com valor contratado e valor medido para reconhecer receita por avanço da obra.
            Atualize Contratos em Configurações; até lá, a Receita POC fica zerada para não transformar venda contratada em receita.
          </span>
        </section>
      )}

      <section className={`card dashboard-executive dre-executive ${hasProfit ? "" : "warning"}`}>
        <div className="dashboard-executive-main">
          <span>{hasProfit ? "Lucro POC estimado" : "Prejuízo POC estimado"}</span>
          <h2>{formatCompactCurrency(dre.netResult)}</h2>
          <p>
            Receita POC líquida de {formatCompactCurrency(dre.netRevenue)} menos {formatCompactCurrency(dre.costAmount)}
            {" "}em custos e despesas lançados. POC médio ponderado de {formatPercent(dre.averagePoc * 100)}.
          </p>
        </div>
        <div className="dashboard-executive-grid">
          <div>
            <span>Caixa realizado</span>
            <strong className={dre.cashResult < 0 ? "negative" : ""}>{formatCompactCurrency(dre.cashResult)}</strong>
            <small>{cashPositive ? "Entrou mais dinheiro do que saiu." : "Saiu mais dinheiro do que entrou."}</small>
          </div>
          <div>
            <span>A receber até o ano</span>
            <strong>{formatCompactCurrency(dre.openReceivables)}</strong>
            <small>{dre.openReceivablesCount} parcelas abertas com vencimento até {selectedYear}</small>
          </div>
          <div>
            <span>A pagar até o ano</span>
            <strong className={dre.openPayables > 0 ? "negative" : ""}>{formatCompactCurrency(dre.openPayables)}</strong>
            <small>{dre.openPayablesCount} parcelas abertas com vencimento até {selectedYear}</small>
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
              <h2 className="panel-title">Base usada no POC</h2>
              <span className="panel-note">Valores de contratos de fornecimento salvos localmente</span>
            </div>
          </div>
          <div className="dashboard-period-list">
            <div>
              <span>Valor contratado</span>
              <strong>{formatCompactCurrency(dre.pocSourcePlannedCost)}</strong>
              <small><span>Base de custo</span><span>{dre.pocSourceContractCount} contratos com medição</span></small>
            </div>
            <div>
              <span>Valor medido</span>
              <strong>{formatCompactCurrency(dre.pocSourceMeasuredCost)}</strong>
              <small><span>Avanço reconhecido</span><span>{formatPercent(dre.pocSourceAveragePercent * 100)} medido sobre contratado</span></small>
            </div>
            <div>
              <span>Vendas sem vínculo</span>
              <strong>{dre.pocUnmatchedCount}</strong>
              <small><span>A revisar</span><span>Essas vendas não entraram na Receita POC.</span></small>
            </div>
          </div>
        </section>
      </div>

      <MonthlyTable monthly={dre.monthly} />

      <section className="card methodology dre-methodology">
        <strong>Como ler esta DRE POC estimada</strong>
        <p>
          Resultado POC considera vendas contratadas multiplicadas pelo percentual de avanço encontrado nos contratos de fornecimento da obra,
          menos cancelamentos, custos e despesas lançados. Caixa realizado continua separado: recebimentos efetivos menos pagamentos efetivos.
          Quando uma venda não encontra vínculo com obra/contrato, ela fica fora da receita POC e aparece no card de contratos sem vínculo.
          Sem histórico mensal de medições e sem apropriação por unidade vendida, a receita POC é uma estimativa anual baseada na última medição salva.
        </p>
      </section>
    </>
  );
}
