import Link from "next/link";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { MonthlyCountLine } from "@/components/charts/monthly-count-line";
import { MonthlyVolumeChart } from "@/components/charts/monthly-volume-chart";
import { PercentPieChart } from "@/components/charts/percent-pie-chart";
import { RankingChart } from "@/components/charts/ranking-chart";
import { StatusDonut } from "@/components/charts/status-donut";
import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { analyzeContracts, loadSupplyContracts } from "@/features/contracts/data";
import {
  DASHBOARD_PERIOD_OPTIONS,
  loadDashboardOverview,
  normalizeDashboardDays,
  normalizeDashboardDirection
} from "@/features/dashboard/data";
import { formatCompactCurrency } from "@/lib/formatters";

export const dynamic = "force-dynamic";

type RelatoriosPageProps = {
  searchParams?: {
    dias?: string | string[];
    periodo?: string | string[];
  };
};

function selectedDays(value?: string | string[]) {
  return value ? normalizeDashboardDays(value) : 365;
}

function selectedDirection(value?: string | string[]) {
  return value ? normalizeDashboardDirection(value) : "past";
}

function periodLabel(days: number, direction: "future" | "past") {
  const option = DASHBOARD_PERIOD_OPTIONS.find((item) => item.days === days);
  const label = option?.label || `${days} dias`;
  return direction === "past" ? `${label} passados` : `${label} futuros`;
}

export default async function RelatoriosPage({ searchParams }: RelatoriosPageProps) {
  const days = selectedDays(searchParams?.dias);
  const direction = selectedDirection(searchParams?.periodo);
  const overview = await loadDashboardOverview(days, direction, "period");
  const contracts = await loadSupplyContracts();
  const contractSummary = analyzeContracts(contracts.contracts);
  const isPast = direction === "past";
  const donePurchases = overview.purchaseSummary.flow.length - overview.purchaseSummary.pendingCount;
  const unavailable = [
    ...overview.unavailable,
    contracts.error && !contracts.contracts.length ? "contratos" : undefined
  ].filter(Boolean) as string[];
  const resultBalance = isPast ? overview.realizedBalance : overview.predictedBalance;
  const pendingReceivable = isPast ? overview.receivableSummary.periodOpenAmount : overview.receivableSummary.totalOpen;
  const pendingPayable = isPast ? overview.payableSummary.periodAmount : overview.payableSummary.totalAmount;

  return (
    <>
      <PageHeading
        eyebrow="Relatórios"
        title="Central de relatórios"
        subtitle={`Visão consolidada de ${periodLabel(days, direction)}, usando somente os dados já integrados.`}
        action="Atualizar dados"
        actionHref="/configuracoes"
      />

      <section className="dashboard-view-switch reports-view-switch">
        <div className="dashboard-view-summary">
          <span>{isPast ? "Realizado" : "Previsto"}</span>
          <strong>{periodLabel(days, direction)}</strong>
          <small>{overview.dashboardRange.start} até {overview.dashboardRange.end}</small>
        </div>
        <div className="dashboard-view-controls">
          <div className="dashboard-view-options compact" aria-label="Período do relatório">
            {DASHBOARD_PERIOD_OPTIONS.map((option) => (
              <Link
                key={option.days}
                href={`/relatorios?dias=${option.days}&periodo=${direction}`}
                className={option.days === days ? "active" : ""}
              >
                {option.label}
              </Link>
            ))}
          </div>
          <div className="dashboard-direction-options" aria-label="Tipo de relatório">
            <Link href={`/relatorios?dias=${days}&periodo=past`} className={isPast ? "active" : ""}>Passado</Link>
            <Link href={`/relatorios?dias=${days}&periodo=future`} className={!isPast ? "active" : ""}>Futuro</Link>
          </div>
        </div>
      </section>

      {unavailable.length > 0 && (
        <section className="card data-notice">
          <strong>Relatório parcial</strong>
          <span>Algumas áreas ainda não têm dados salvos: {unavailable.join(", ")}. Atualize essas áreas em Configurações quando quiser completar a visão.</span>
        </section>
      )}

      <section className={`card report-hero ${resultBalance < 0 ? "warning" : ""}`}>
        <div>
          <span>{isPast ? "Resultado realizado" : "Saldo futuro líquido"}</span>
          <h2>{formatCompactCurrency(resultBalance)}</h2>
          <p>
            {isPast
              ? `${formatCompactCurrency(overview.receivableSummary.receivedAmount)} recebido e ${formatCompactCurrency(overview.payableSummary.paidAmount)} pago no período.`
              : `${formatCompactCurrency(overview.receivableSummary.totalOpen)} a receber e ${formatCompactCurrency(overview.payableSummary.totalAmount)} a pagar no período.`}
          </p>
        </div>
        <div className="report-hero-grid">
          <div>
            <span>Recebível pendente</span>
            <strong>{formatCompactCurrency(pendingReceivable)}</strong>
            <small>{isPast ? "Previsto e ainda não recebido" : "Saldo futuro a receber"}</small>
          </div>
          <div>
            <span>Pagamento pendente</span>
            <strong>{formatCompactCurrency(pendingPayable)}</strong>
            <small>{isPast ? "Previsto e ainda não pago" : "Saldo futuro a pagar"}</small>
          </div>
          <div>
            <span>Contratos ativos</span>
            <strong>{contractSummary.activeCount}</strong>
            <small>{formatCompactCurrency(contractSummary.balanceValue)} de saldo estimado</small>
          </div>
        </div>
      </section>

      <div className="stats report-stats">
        <StatCard label={isPast ? "Recebido" : "Previsto a receber"} value={formatCompactCurrency(isPast ? overview.receivableSummary.receivedAmount : overview.receivableSummary.expectedAmount)} delta={`${isPast ? overview.receivableSummary.receivedCount : overview.receivableSummary.expectedCount} parcelas`} icon="R$" />
        <StatCard label={isPast ? "Pago" : "Previsto a pagar"} value={formatCompactCurrency(isPast ? overview.payableSummary.paidAmount : overview.payableSummary.expectedAmount)} delta={`${isPast ? overview.payableSummary.paidCount : overview.payableSummary.expectedCount} parcelas`} icon="P" />
        <StatCard label="Vendas" value={formatCompactCurrency(overview.salesSummary.totalValue)} delta={`${overview.salesSummary.activeCount} contratos ativos`} icon="V" />
        <StatCard label="Compras" value={formatCompactCurrency(overview.purchaseSummary.purchasedAmount)} delta={`${overview.purchaseSummary.orderCount} pedidos no recorte`} icon="C" />
        <StatCard label="Contratos" value={formatCompactCurrency(contractSummary.totalValue)} delta={`${contracts.contracts.length} contratos integrados`} icon="CT" />
        <StatCard label="Estoque" value={String(overview.inventorySummary.unitCount)} delta="unidades imobiliárias salvas" icon="E" />
        <StatCard label="Pendências a receber" value={formatCompactCurrency(pendingReceivable)} delta={`${isPast ? overview.receivableSummary.periodOpenCount : overview.receivableSummary.forecastCount} parcelas`} warn={pendingReceivable > 0 && isPast} icon="!" />
        <StatCard label="Pendências a pagar" value={formatCompactCurrency(pendingPayable)} delta={`${isPast ? overview.payableSummary.periodCount : overview.payables.totalCount} parcelas`} warn={pendingPayable > 0 && isPast} icon="!" />
      </div>

      <div className="charts-dashboard reports-dashboard">
        <div className="chart-wide">
          <CashFlowChart
            data={overview.cashFlow}
            title={isPast ? "Entradas x saídas realizadas" : "Fluxo futuro previsto"}
            note={isPast ? "Recebimentos e pagamentos realizados no período" : "Recebíveis e compromissos por vencimento"}
          />
        </div>
        <div className="chart-wide">
          <MonthlyVolumeChart
            data={overview.salesMonthly}
            title="Vendas no período"
            note="Valor e quantidade de contratos de venda"
            countLabel="contrato"
          />
        </div>
        <RankingChart title="Recebíveis por cliente" note={isPast ? "Maiores saldos pendentes no período" : "Maiores saldos futuros"} data={overview.receivableSummary.clients} countLabel="parcela" />
        <RankingChart title="Pagamentos por fornecedor" note={isPast ? "Maiores saldos pendentes no período" : "Maiores compromissos futuros"} data={overview.payableSummary.creditors} countLabel="parcela" />
        <MonthlyCountLine data={overview.purchasesMonthly} title="Pedidos de compra" note={`Quantidade de pedidos, ${overview.cashFlowGranularityLabel}`} />
        <StatusDonut
          complete={donePurchases}
          incomplete={overview.purchaseSummary.pendingCount}
          title="Andamento de compras"
          note="Processos concluídos e pendentes"
          completeLabel="Concluídos"
          incompleteLabel="Pendentes"
          centerLabel="concluído"
        />
        <PercentPieChart title="Unidades por situação" note="Distribuição comercial das unidades salvas" data={overview.inventorySummary.byStock} centerLabel="unidades" />
        <RankingChart title="Contratos por situação" note="Carteira de contratos de fornecimento" data={contractSummary.byStatus} countLabel="contrato" />
      </div>

      <section className="card panel report-links">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Abrir detalhes</h2>
            <span className="panel-note">Use os portais abaixo para analisar registros e listas completas.</span>
          </div>
        </div>
        <div>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/contas-receber">Contas a receber</Link>
          <Link href="/contas-pagar">Contas a pagar</Link>
          <Link href="/sales">Vendas</Link>
          <Link href="/compras">Compras</Link>
          <Link href="/estoque">Estoque</Link>
          <Link href="/contratos">Contratos</Link>
          <Link href="/conciliacao">Conciliação</Link>
        </div>
      </section>
    </>
  );
}
