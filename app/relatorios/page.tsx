import { PageHeading } from "@/components/ui/page-heading";
import { ApiErrorNotice } from "@/components/ui/api-error-notice";
import { MonthlyVolumeChart } from "@/components/charts/monthly-volume-chart";
import { RankingChart } from "@/components/charts/ranking-chart";
import { StatusDonut } from "@/components/charts/status-donut";
import { MonthlyCountLine } from "@/components/charts/monthly-count-line";
import { ValueRangeChart } from "@/components/charts/value-range-chart";
import { OriginBubbleChart } from "@/components/charts/origin-bubble-chart";
import { analyzePayables, loadPayables } from "@/features/financeiro/sienge-data";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  const payables = await loadPayables();
  const analytics = analyzePayables(payables);
  return (
    <>
      <PageHeading eyebrow="Painel visual do Sienge" title="Painel de gráficos" subtitle={`${payables.entries.length} de ${payables.totalCount} títulos carregados na análise atual.`} />
      {payables.error ? <ApiErrorNotice error={payables.error} /> : <>
        <div className="charts-dashboard">
          <MonthlyVolumeChart data={analytics.monthly} />
          <MonthlyCountLine data={analytics.monthly} />
          <StatusDonut complete={analytics.completeCount} incomplete={analytics.incompleteCount} />
          <ValueRangeChart data={analytics.valueRanges} />
          <RankingChart title="Concentração por credor" note="Maiores volumes da amostra" data={analytics.creditors} />
          <RankingChart title="Concentração por origem" note="Módulos geradores dos títulos" data={analytics.origins} />
          <OriginBubbleChart data={analytics.origins} />
        </div>
      </>}
    </>
  );
}
