import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { FinancialTable } from "@/components/tables/financial-table";
import { ApiErrorNotice } from "@/components/ui/api-error-notice";
import { MonthlyVolumeChart } from "@/components/charts/monthly-volume-chart";
import { RankingChart } from "@/components/charts/ranking-chart";
import { StatusDonut } from "@/components/charts/status-donut";
import { loadPayables } from "@/features/financeiro/sienge-data";
import { analyzePayables } from "@/features/financeiro/sienge-data";
import { formatCompactCurrency, formatCurrency } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const payables = await loadPayables();
  const analytics = analyzePayables(payables);
  return (
    <>
      <PageHeading eyebrow="Dados do Sienge" title="Visão financeira" subtitle="Títulos a pagar emitidos nos últimos 12 meses." action="Gerar relatório" />
      <div className="stats">
        <StatCard label="Volume da amostra" value={formatCompactCurrency(analytics.totalAmount)} delta={`${payables.entries.length} títulos somados`} icon="R$" />
        <StatCard label="Valor médio" value={formatCurrency(analytics.averageAmount)} delta="Média por título carregado" icon="Ø" />
        <StatCard label="Títulos encontrados" value={String(payables.totalCount)} delta={`${analytics.coverage.toFixed(0)}% carregados na amostra`} icon="#" />
        <StatCard label="A revisar" value={String(analytics.incompleteCount)} delta="Incompletos ou em inclusão" warn icon="!" />
      </div>
      {payables.error && <ApiErrorNotice error={payables.error} />}
      {!payables.error && <>
        <div className="grid-main"><MonthlyVolumeChart data={analytics.monthly} /><StatusDonut complete={analytics.completeCount} incomplete={analytics.incompleteCount} /></div>
        <div className="grid-main equal-grid"><RankingChart title="Maiores credores" note="Ranking pelo valor bruto da amostra" data={analytics.creditors} /><RankingChart title="Volume por origem" note="Módulos que geraram os títulos" data={analytics.origins} /></div>
      </>}
      <section>
        <div className="panel-head"><div><h2 className="panel-title">Títulos recentes</h2><span className="panel-note">Dados retornados pela API do Sienge</span></div></div>
        <FinancialTable entries={payables.entries.slice(0, 10)} dateHeading="Emissão" />
      </section>
    </>
  );
}
