import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { FinancialExplorer } from "@/components/tables/financial-explorer";
import { ApiErrorNotice } from "@/components/ui/api-error-notice";
import { formatCurrency } from "@/lib/formatters";
import { loadPayables } from "./sienge-data";
import { analyzePayables } from "./sienge-data";
import { MonthlyVolumeChart } from "@/components/charts/monthly-volume-chart";
import { RankingChart } from "@/components/charts/ranking-chart";

type ModulePageProps = {
  title: string;
  subtitle: string;
  kind?: "payable" | "receivable";
};

export async function FinancialModulePage({ title, subtitle, kind }: ModulePageProps) {
  const payables = kind !== "receivable" ? await loadPayables() : { entries: [], totalCount: 0, error: undefined };
  const entries = payables.entries;
  const analytics = analyzePayables(payables);
  const receivableNotice = kind === "receivable"
    ? "A API do Sienge exige um cliente para consultar contas a receber. Selecione ou implemente o cadastro de clientes para carregar essa área."
    : undefined;
  return (
    <>
      <PageHeading eyebrow="Operações financeiras" title={title} subtitle={subtitle} action="Novo lançamento" actionHref="/lancamentos/novo" />
      <div className="stats">
        <StatCard label="Total consultado" value={formatCurrency(analytics.totalAmount)} delta="Títulos emitidos nos últimos 12 meses" icon="R$" />
        <StatCard label="Títulos encontrados" value={String(payables.totalCount)} delta={`${entries.length} carregados nesta página`} icon="#" />
        <StatCard label="Completos" value={String(analytics.completeCount)} delta="Consistência informada pelo Sienge" icon="C" />
        <StatCard label="Incompletos / em inclusão" value={String(analytics.incompleteCount)} delta="Requerem conferência no Sienge" warn icon="!" />
      </div>
      {payables.error && <ApiErrorNotice error={payables.error} />}
      {receivableNotice && <div className="card data-notice"><strong>Dados não carregados</strong><span>{receivableNotice}</span></div>}
      {!payables.error && kind !== "receivable" && <div className="grid-main"><MonthlyVolumeChart data={analytics.monthly} /><RankingChart title="Volume por origem" note="Módulos que geraram os títulos" data={analytics.origins} /></div>}
      <FinancialExplorer entries={entries} />
    </>
  );
}
