import Link from "next/link";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { RankingChart } from "@/components/charts/ranking-chart";
import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { DRE_PERIOD_OPTIONS, loadDreGerencial, normalizeDrePeriod, type DreMonthlyItem } from "@/features/dre/data";
import { formatCompactCurrency, formatCurrency } from "@/lib/formatters";

export const dynamic = "force-dynamic";

type DreGerencialPageProps = {
  searchParams?: {
    periodo?: string | string[];
  };
};

function formatPercent(value: number) {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function periodTitle(period: string) {
  return DRE_PERIOD_OPTIONS.find((option) => option.key === period)?.label || "Histórico completo";
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
          <span className="panel-note">Receita líquida menos custos e despesas lançados</span>
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
        <h2 className="panel-title">DRE mês a mês</h2>
        <span className="panel-note">Valores consolidados por competência e por caixa</span>
      </div>
      {rows.length ? (
        <table>
          <thead>
            <tr>
              <th>Mês</th>
              <th>Receita líquida</th>
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
      ) : <div className="empty-state">Nenhum mês com dados salvos para este recorte.</div>}
    </section>
  );
}

export default async function DreGerencialPage({ searchParams }: DreGerencialPageProps) {
  const period = normalizeDrePeriod(searchParams?.periodo);
  const dre = await loadDreGerencial(period);
  const hasProfit = dre.netResult >= 0;
  const cashPositive = dre.cashResult >= 0;

  return (
    <>
      <PageHeading
        eyebrow="Resultado histórico"
        title="DRE gerencial"
        subtitle="Entenda se a empresa gerou lucro ou prejuízo na operação e se isso virou caixa."
        action="Atualizar dados"
        actionHref="/configuracoes"
      />

      <section className="reports-filter card">
        <div>
          <span>Recorte</span>
          <strong>{periodTitle(period)}</strong>
          <small>{dre.range.start} até {dre.range.end}</small>
        </div>
        <div className="dashboard-view-controls">
          <div className="dashboard-view-options compact" aria-label="Período da DRE">
            {DRE_PERIOD_OPTIONS.map((option) => (
              <Link
                key={option.key}
                href={`/dre-gerencial?periodo=${option.key}`}
                className={option.key === period ? "active" : ""}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {dre.unavailable.length > 0 && (
        <section className="card data-notice">
          <strong>Visão parcial</strong>
          <span>Algumas áreas ainda não têm dados salvos: {dre.unavailable.join(", ")}. Atualize essas áreas em Configurações para completar a DRE.</span>
        </section>
      )}

      <section className={`card dashboard-executive dre-executive ${hasProfit ? "" : "warning"}`}>
        <div className="dashboard-executive-main">
          <span>{hasProfit ? "Lucro gerencial" : "Prejuízo gerencial"}</span>
          <h2>{formatCompactCurrency(dre.netResult)}</h2>
          <p>
            Receita líquida de {formatCompactCurrency(dre.netRevenue)} menos {formatCompactCurrency(dre.costAmount)}
            {" "}em custos e despesas lançados. Margem gerencial de {formatPercent(dre.margin)}.
          </p>
        </div>
        <div className="dashboard-executive-grid">
          <div>
            <span>Caixa realizado</span>
            <strong className={dre.cashResult < 0 ? "negative" : ""}>{formatCompactCurrency(dre.cashResult)}</strong>
            <small>{cashPositive ? "Entrou mais dinheiro do que saiu." : "Saiu mais dinheiro do que entrou."}</small>
          </div>
          <div>
            <span>A receber acumulado</span>
            <strong>{formatCompactCurrency(dre.openReceivables)}</strong>
            <small>{dre.openReceivablesCount} parcelas com saldo salvo</small>
          </div>
          <div>
            <span>A pagar acumulado</span>
            <strong className={dre.openPayables > 0 ? "negative" : ""}>{formatCompactCurrency(dre.openPayables)}</strong>
            <small>{dre.openPayablesCount} parcelas com saldo salvo</small>
          </div>
        </div>
      </section>

      <div className="stats dre-stats">
        <StatCard label="Receita bruta" value={formatCompactCurrency(dre.grossRevenue)} delta={`${dre.contractCount} contratos no recorte`} icon="R$" />
        <StatCard label="Cancelamentos" value={formatCompactCurrency(dre.cancellations)} delta={`${dre.cancelledContractCount} contratos cancelados/distratados`} warn={dre.cancellations > 0} icon="-" />
        <StatCard label="Custos e despesas" value={formatCompactCurrency(dre.costAmount)} delta={`${dre.costCount} parcelas lançadas`} warn={dre.costAmount > dre.netRevenue} icon="C" />
        <StatCard label="Compras contratadas" value={formatCompactCurrency(dre.purchasedAmount)} delta={`${dre.purchaseOrderCount} pedidos, ${dre.pendingPurchaseCount} pendentes`} icon="P" />
        <StatCard label="Recebido" value={formatCompactCurrency(dre.receivedAmount)} delta={`${dre.receivedCount} recebimentos no recorte`} icon="R" />
        <StatCard label="Pago" value={formatCompactCurrency(dre.paidAmount)} delta={`${dre.paidCount} pagamentos no recorte`} warn={dre.paidAmount > dre.receivedAmount} icon="S" />
      </div>

      <IntegrationSummary integrations={dre.integrations} />

      <div className="dre-grid-wide">
        <CashFlowChart
          data={dre.competenceFlow}
          title="Receita x custos"
          note="Leitura por competência gerencial, agrupada por mês"
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
        <RankingChart title="Vendas por empreendimento" note="Maiores receitas vendidas no recorte" data={dre.salesByEnterprise} countLabel="contrato" />
      </div>

      <MonthlyTable monthly={dre.monthly} />

      <section className="card methodology dre-methodology">
        <strong>Como ler esta DRE gerencial</strong>
        <p>
          Resultado gerencial considera contratos de venda menos cancelamentos, custos e despesas lançados no espelho local.
          Caixa realizado é separado: recebimentos efetivos menos pagamentos efetivos. Essa separação ajuda a enxergar quando a operação dá lucro, mas o caixa ainda não acompanhou.
        </p>
      </section>
    </>
  );
}
