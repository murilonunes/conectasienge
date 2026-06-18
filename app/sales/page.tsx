import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { ApiErrorNotice } from "@/components/ui/api-error-notice";
import { RankingChart } from "@/components/charts/ranking-chart";
import { SalesExplorer } from "@/components/sales/sales-explorer";
import { SalesSituationChart } from "@/components/sales/sales-situation-chart";
import { MonthlySalesChart } from "@/components/sales/monthly-sales-chart";
import { analyzeSales, loadSalesContracts } from "@/features/sales/data";
import { formatCompactCurrency, formatCurrency } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const result = await loadSalesContracts();
  const summary = analyzeSales(result.contracts);
  return (
    <>
      <PageHeading eyebrow="Portal comercial" title="Contratos de vendas" subtitle={`${result.contracts.length} de ${result.totalCount} contratos disponíveis na consulta diária armazenada.`} />
      <div className="stats">
        <StatCard label="Valor da carteira" value={formatCompactCurrency(summary.totalValue)} delta="Valor total de venda da amostra" icon="R$" />
        <StatCard label="Saldo em aberto" value={formatCompactCurrency(summary.outstandingBalance)} delta="Somado das condições de pagamento" warn icon="↗" />
        <StatCard label="Valor pago" value={formatCompactCurrency(summary.amountPaid)} delta="Informado nas condições de pagamento" icon="✓" />
        <StatCard label="Ticket médio" value={formatCurrency(summary.averageValue)} delta={`${summary.activeCount} contratos não cancelados`} icon="TM" />
      </div>
      {result.error ? <ApiErrorNotice error={result.error} /> : <>
        <MonthlySalesChart data={summary.monthlySales} />
        <div className="grid-main equal-grid">
          <RankingChart title="Carteira por empreendimento" note="Maiores volumes de contratos" data={summary.byEnterprise} />
          <SalesSituationChart data={summary.bySituation} />
        </div>
        <SalesExplorer contracts={result.contracts} />
      </>}
    </>
  );
}
