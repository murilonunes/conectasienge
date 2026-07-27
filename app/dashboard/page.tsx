import { I18nText } from "@/components/i18n/i18n-text";
import { Suspense } from "react";
import Link from "next/link";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { MonthlyCountLine } from "@/components/charts/monthly-count-line";
import { MonthlyVolumeChart } from "@/components/charts/monthly-volume-chart";
import { PercentPieChart } from "@/components/charts/percent-pie-chart";
import { RankingChart } from "@/components/charts/ranking-chart";
import { StatusDonut } from "@/components/charts/status-donut";
import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { DASHBOARD_PERIOD_OPTIONS, loadDashboardOverview, normalizeDashboardDays, normalizeDashboardDirection, normalizeDashboardOverdueMode } from "@/features/dashboard/data";
import { formatCompactCurrency, formatCurrency } from "@/lib/formatters";
import { DashboardLoadingState } from "./dashboard-loading";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams?: {
    dias?: string | string[];
    periodo?: string | string[];
    atraso?: string | string[];
  };
};

async function DashboardContent({ days, direction, overdueMode }: { days: number; direction: "future" | "past"; overdueMode: "period" | "all" }) {
  const overview = await loadDashboardOverview(days, direction, overdueMode);
  const donePurchases = overview.purchaseSummary.flow.length - overview.purchaseSummary.pendingCount;
  const directionLabel = overview.dashboardDirection === "past" ? "passados" : "futuros";
  const periodSummaryLabel = overview.dashboardDays === 1 ? "Hoje" : `${overview.dashboardPeriodLabel} ${directionLabel}`;
  const isPastView = overview.dashboardDirection === "past";
  const overdueQuery = isPastView && overview.dashboardOverdueMode === "all" ? "&atraso=all" : "";
  const executiveBalance = isPastView ? overview.realizedBalance : overview.predictedBalance;
  const executiveLabel = isPastView ? "Resultado realizado" : "Saldo futuro líquido";
  const executiveDescription = isPastView
    ? `${formatCompactCurrency(overview.receivableSummary.receivedAmount)} recebido - ${formatCompactCurrency(overview.payableSummary.paidAmount)} pago.`
    : `${formatCompactCurrency(overview.receivableSummary.totalOpen)} a receber - ${formatCompactCurrency(overview.payableSummary.totalAmount)} a pagar.`;
  const cashReading = isPastView
    ? (executiveBalance >= 0 ? "Resultado positivo no recorte selecionado." : "Resultado negativo no recorte selecionado.")
    : executiveBalance > 0
      ? "Entradas previstas superam as saídas."
      : executiveBalance < 0
        ? "Saídas previstas superam as entradas."
        : "Entradas e saídas previstas estão equilibradas.";
  const realizedReading = overview.realizedBalance >= 0
    ? "Entrou mais dinheiro do que saiu no período."
    : "Saiu mais dinheiro do que entrou no período.";
  const futureLinkedBalance = overview.receivableSummary.periodReceivedAmount - overview.payableSummary.periodPaidAmount;

  return (
    <>
      <PageHeading
        eyebrow="Visão geral"
        title="Dashboard inicial"
        subtitle={`Resumo executivo dos próximos ou últimos ${overview.dashboardPeriodLabel}. Altere a visão abaixo sem sair do dashboard.`}
      />

      <section className="dashboard-view-switch">
        <div className="dashboard-view-summary">
          <span><I18nText text={isPastView ? "Execução" : "Planejamento"} /></span>
          <strong><I18nText text={periodSummaryLabel} /></strong>
          <small>{overview.dashboardRange.start} <I18nText text={"até"} /> {overview.dashboardRange.end} <I18nText text={"-"} /> <I18nText text={isPastView ? "previsto x realizado" : "previsão por vencimento"} /></small>
        </div>
        <div className="dashboard-view-controls">
          <div className="dashboard-view-options compact" aria-label="Período" data-i18n-aria-label={"Período"}>
            {DASHBOARD_PERIOD_OPTIONS.map((option) => (
              <Link
                key={option.days}
                href={`/dashboard?dias=${option.days}&periodo=${overview.dashboardDirection}${overdueQuery}`}
                className={option.days === overview.dashboardDays ? "active" : ""}
              >
                <I18nText text={option.label} />
              </Link>
            ))}
          </div>
          <div className="dashboard-direction-options" aria-label="Direção do período" data-i18n-aria-label={"Direção do período"}>
              <Link
              href={`/dashboard?dias=${overview.dashboardDays}&periodo=future`}
              className={overview.dashboardDirection === "future" ? "active" : ""}
            >
              <I18nText text={"Futuro"} />
            </Link>
              <Link
              href={`/dashboard?dias=${overview.dashboardDays}&periodo=past${overdueQuery}`}
              className={overview.dashboardDirection === "past" ? "active" : ""}
            >
              <I18nText text={"Passado"} />
            </Link>
          </div>
        </div>
      </section>

      {overview.unavailable.length > 0 && (
        <section className="card data-notice">
          <strong><I18nText text={"Visão parcial"} /></strong>
          <span><I18nText text={"Algumas áreas não carregaram agora:"} /> {overview.unavailable.join(", ")}<I18nText text={". O dashboard mostra os módulos disponíveis."} /></span>
        </section>
      )}

      <section className={`card dashboard-executive ${executiveBalance < 0 ? "warning" : ""}`}>
        <div className="dashboard-executive-main">
          <span><I18nText text={executiveLabel} /></span>
          <h2><I18nText text={formatCompactCurrency(executiveBalance)} /></h2>
          <p><I18nText text={`${cashReading} ${executiveDescription}`} /></p>
        </div>
        <div className="dashboard-executive-grid">
          {isPastView ? (
            <>
              <div>
                <span><I18nText text={"Saldo realizado"} /></span>
                <strong className={overview.realizedBalance < 0 ? "negative" : ""}><I18nText text={formatCompactCurrency(overview.realizedBalance)} /></strong>
                <small><I18nText text={realizedReading} /></small>
              </div>
              <div>
                <span><I18nText text={"Não recebido"} /></span>
                <strong><I18nText text={formatCompactCurrency(overview.receivableSummary.periodOpenAmount)} /></strong>
                <small>{overview.receivableSummary.periodOpenCount} <I18nText text={"parcelas previstas ficaram pendentes"} /></small>
              </div>
              <div>
                <span><I18nText text={"Não pago"} /></span>
                <strong className={overview.payableSummary.periodAmount > 0 ? "negative" : ""}><I18nText text={formatCompactCurrency(overview.payableSummary.periodAmount)} /></strong>
                <small>{overview.payableSummary.periodCount} <I18nText text={"parcelas previstas ficaram pendentes"} /></small>
              </div>
            </>
          ) : (
            <>
              <div>
                <span><I18nText text={"A receber restante"} /></span>
                <strong><I18nText text={formatCompactCurrency(overview.receivableSummary.totalOpen)} /></strong>
                <small>{overview.receivableSummary.forecastCount} <I18nText text={"parcelas ainda têm saldo"} /></small>
              </div>
              <div>
                <span><I18nText text={"A pagar restante"} /></span>
                <strong className={overview.payableSummary.totalAmount > 0 ? "negative" : ""}><I18nText text={formatCompactCurrency(overview.payableSummary.totalAmount)} /></strong>
                <small>{overview.payables.totalCount} <I18nText text={"parcelas ainda têm saldo"} /></small>
              </div>
              <div>
                <span><I18nText text={"Já realizado"} /></span>
                <strong className={futureLinkedBalance < 0 ? "negative" : ""}><I18nText text={formatCompactCurrency(futureLinkedBalance)} /></strong>
                <small>{formatCompactCurrency(overview.receivableSummary.periodReceivedAmount)} <I18nText text={"recebido -"} /> {formatCompactCurrency(overview.payableSummary.periodPaidAmount)} <I18nText text={"pago"} /></small>
              </div>
            </>
          )}
        </div>
      </section>

      <div className={`stats dashboard-strategy ${isPastView ? "past" : "future"}`}>
        <section className="dashboard-metric-group">
          <div className="dashboard-group-head">
            <span><I18nText text={isPastView ? "Recebimentos" : "Previsão de recebimento"} /></span>
            <strong><I18nText text={isPastView ? "O que entrou" : "Saldo futuro"} /></strong>
          </div>
          <div className="dashboard-group-stats">
            {isPastView ? (
              <>
                <StatCard label="Previsto" value={formatCompactCurrency(overview.receivableSummary.expectedAmount)} delta={`${overview.receivableSummary.expectedCount} parcelas venciam no período`} icon="R$" />
                <StatCard label="Recebido do previsto" value={formatCompactCurrency(overview.receivableSummary.periodReceivedAmount)} delta={`${overview.receivableSummary.periodReceivedCount} recebimentos vinculados ao recorte`} icon="R" />
                <StatCard label="Não recebido" value={formatCompactCurrency(overview.receivableSummary.periodOpenAmount)} delta={`${overview.receivableSummary.periodOpenCount} parcelas seguem pendentes`} warn={overview.receivableSummary.periodOpenCount > 0} icon="!" />
              </>
            ) : (
              <>
                <StatCard label="Previsto a receber" value={formatCompactCurrency(overview.receivableSummary.expectedAmount)} delta={`${overview.receivableSummary.expectedCount} parcelas vencem no recorte`} icon="R$" />
                <StatCard label="Já recebido" value={formatCompactCurrency(overview.receivableSummary.periodReceivedAmount)} delta={`${overview.receivableSummary.periodReceivedCount} recebimentos vinculados`} icon="R" />
                <StatCard label="Saldo a receber" value={formatCompactCurrency(overview.receivableSummary.totalOpen)} delta={`${overview.receivableSummary.forecastCount} parcelas ainda têm saldo`} icon="R$" />
              </>
            )}
          </div>
        </section>
        <section className="dashboard-metric-group">
          <div className="dashboard-group-head">
            <span><I18nText text={isPastView ? "Pagamentos" : "Previsão de pagamento"} /></span>
            <strong><I18nText text={isPastView ? "O que saiu" : "Compromissos futuros"} /></strong>
          </div>
          <div className="dashboard-group-stats">
            {isPastView ? (
              <>
                <StatCard label="Previsto" value={formatCompactCurrency(overview.payableSummary.expectedAmount)} delta={`${overview.payableSummary.expectedCount} parcelas venciam no período`} icon="P" />
                <StatCard label="Pago do previsto" value={formatCompactCurrency(overview.payableSummary.periodPaidAmount)} delta={`${overview.payableSummary.periodPaidCount} pagamentos vinculados ao recorte`} icon="R" />
                <StatCard label="Não pago" value={formatCompactCurrency(overview.payableSummary.periodAmount)} delta={`${overview.payableSummary.periodCount} parcelas seguem pendentes`} warn={overview.payableSummary.periodCount > 0} icon="!" />
              </>
            ) : (
              <>
                <StatCard label="Previsto a pagar" value={formatCompactCurrency(overview.payableSummary.expectedAmount)} delta={`${overview.payableSummary.expectedCount} parcelas vencem no recorte`} icon="P" />
                <StatCard label="Já pago" value={formatCompactCurrency(overview.payableSummary.periodPaidAmount)} delta={`${overview.payableSummary.periodPaidCount} pagamentos vinculados`} icon="R" />
                <StatCard label="Saldo a pagar" value={formatCompactCurrency(overview.payableSummary.totalAmount)} delta={`${overview.payables.totalCount} parcelas ainda têm saldo`} icon="P" />
              </>
            )}
          </div>
        </section>
        {isPastView && (
          <section className="dashboard-metric-group compact">
            <div className="dashboard-group-head">
              <span><I18nText text={"Operação"} /></span>
              <strong><I18nText text={"Movimento comercial"} /></strong>
            </div>
            <div className="dashboard-group-stats">
              <StatCard label="Vendas" value={formatCompactCurrency(overview.salesSummary.totalValue)} delta={`${overview.salesSummary.activeCount} contratos ativos`} icon="V" />
              <StatCard label="Compras pendentes" value={String(overview.purchaseSummary.pendingCount)} delta={formatCurrency(overview.purchaseSummary.pendingAmount)} warn={overview.purchaseSummary.pendingCount > 0} icon="C" />
            </div>
          </section>
        )}
      </div>

      {isPastView ? (
        <div className="dashboard-past-grid">
          <div className="dashboard-past-wide">
            <CashFlowChart
              data={overview.cashFlow}
              title="Entradas x saídas"
              note={`Recebimentos e pagamentos realizados, ${overview.cashFlowGranularityLabel}`}
            />
          </div>
          <div className="dashboard-past-wide">
            <MonthlyVolumeChart
              data={overview.salesMonthly}
              title="Vendas no recorte"
              note={`Valor e quantidade de vendas, ${overview.cashFlowGranularityLabel}`}
              countLabel="venda"
            />
          </div>
          <StatusDonut
            complete={donePurchases}
            incomplete={overview.purchaseSummary.pendingCount}
            title="Compras"
            note="Andamento geral do processo"
            completeLabel="Feito"
            incompleteLabel="Pendente"
            centerLabel="feito"
            description="Mostra rapidamente o que já avançou e o que ainda precisa de atenção."
          />
          <MonthlyCountLine
            data={overview.purchasesMonthly}
            title="Pedidos de compra"
            note={`Quantidade de pedidos, ${overview.cashFlowGranularityLabel}`}
          />
        </div>
      ) : (
        <div className="dashboard-future-grid">
          <div className="dashboard-future-wide">
            <CashFlowChart
              data={overview.cashFlow}
              title="Fluxo futuro"
              note={`Entradas e saídas previstas, ${overview.cashFlowGranularityLabel}`}
            />
          </div>
          <RankingChart title="Recebíveis por cliente" note="Maiores saldos futuros a receber" data={overview.receivableSummary.clients} countLabel="parcela" />
          <RankingChart title="Pagamentos por fornecedor" note="Maiores compromissos futuros" data={overview.payableSummary.creditors} countLabel="parcela" />
          <div className="dashboard-future-wide">
            <RankingChart title="Pagamentos por obra/empresa" note="Concentração dos compromissos futuros" data={overview.payableSummary.origins} countLabel="parcela" />
          </div>
        </div>
      )}

      {isPastView && (
        <>
          <div className="grid-main equal-grid">
            <PercentPieChart title="Unidades por situação" note="Distribuição comercial das unidades em estoque" data={overview.inventorySummary.byStock} centerLabel="unidades" />
            <RankingChart title="Recebíveis por cliente" note="Maiores saldos pendentes no recorte" data={overview.receivableSummary.clients} countLabel="parcela" />
          </div>

          <div className="grid-main equal-grid">
            <section className="card panel dashboard-mini-panel">
              <div className="panel-head">
                <div><h2 className="panel-title"><I18nText text={"Compras por período"} /></h2><span className="panel-note"><I18nText text={"Resumo do recorte selecionado"} /></span></div>
              </div>
              <div className="dashboard-period-list">
                {overview.purchaseSummary.periods.map((period) => (
                  <div key={period.key}>
                    <span><I18nText text={period.label} /></span>
                    <strong><I18nText text={formatCompactCurrency(period.amount)} /></strong>
                    <small>
                      <span><I18nText text={period.note} /></span>
                      <span>{period.count} <I18nText text={"registros -"} /> {period.doneCount} <I18nText text={"concluídos -"} /> {period.pendingCount} <I18nText text={"pendentes"} /></span>
                    </small>
                  </div>
                ))}
              </div>
            </section>
            <RankingChart title="Vendas por empreendimento" note="Carteira comercial consolidada" data={overview.salesSummary.byEnterprise} countLabel="contrato" />
          </div>
        </>
      )}
    </>
  );
}
export default function DashboardPage({ searchParams }: DashboardPageProps) {
  const selectedDays = normalizeDashboardDays(searchParams?.dias);
  const selectedDirection = normalizeDashboardDirection(searchParams?.periodo);
  const selectedOverdueMode = normalizeDashboardOverdueMode(searchParams?.atraso);
  return (
    <Suspense key={`${selectedDays}-${selectedDirection}-${selectedOverdueMode}`} fallback={<DashboardLoadingState />}>
      <DashboardContent days={selectedDays} direction={selectedDirection} overdueMode={selectedOverdueMode} />
    </Suspense>
  );
}
