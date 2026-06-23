import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { ApiErrorNotice } from "@/components/ui/api-error-notice";
import { RankingChart } from "@/components/charts/ranking-chart";
import { SalesExplorer } from "@/components/sales/sales-explorer";
import { SalesSituationChart } from "@/components/sales/sales-situation-chart";
import { MonthlySalesChart } from "@/components/sales/monthly-sales-chart";
import {
  analyzeSales,
  filterSalesContractsByPeriod,
  loadSalesContracts,
  normalizeSalesDays,
  normalizeSalesDirection,
  SALES_PERIOD_OPTIONS,
  salesPeriodRange
} from "@/features/sales/data";
import type { SalesContract } from "@/features/sales/types";
import { formatCompactCurrency } from "@/lib/formatters";

export const dynamic = "force-dynamic";

type SalesPageProps = {
  searchParams?: {
    dias?: string | string[];
    periodo?: string | string[];
  };
};

function slimSalesContract(contract: SalesContract): SalesContract {
  const mainCustomer = contract.salesContractCustomers?.find((customer) => customer.main) || contract.salesContractCustomers?.[0];
  const mainUnit = contract.salesContractUnits?.find((unit) => unit.main) || contract.salesContractUnits?.[0];
  return {
    id: contract.id,
    number: contract.number,
    externalId: contract.externalId,
    companyName: contract.companyName,
    enterpriseName: contract.enterpriseName,
    receivableBillId: contract.receivableBillId,
    contractDate: contract.contractDate,
    issueDate: contract.issueDate,
    expectedDeliveryDate: contract.expectedDeliveryDate,
    situation: contract.situation,
    value: contract.value,
    totalSellingValue: contract.totalSellingValue,
    salesContractCustomers: mainCustomer ? [mainCustomer] : undefined,
    salesContractUnits: mainUnit ? [mainUnit] : undefined,
    paymentConditions: contract.paymentConditions?.map((condition) => ({
      conditionTypeId: condition.conditionTypeId,
      conditionTypeName: condition.conditionTypeName,
      installmentsNumber: condition.installmentsNumber,
      openInstallmentsNumber: condition.openInstallmentsNumber,
      totalValue: condition.totalValue,
      totalValueInterest: condition.totalValueInterest,
      outstandingBalance: condition.outstandingBalance,
      amountPaid: condition.amountPaid
    })),
    __siengeIntegrationDay: (contract as SalesContract & { __siengeIntegrationDay?: string }).__siengeIntegrationDay,
    __siengeIntegratedAt: (contract as SalesContract & { __siengeIntegratedAt?: string }).__siengeIntegratedAt
  } as SalesContract;
}

export default async function SalesPage({ searchParams }: SalesPageProps) {
  const result = await loadSalesContracts();
  const selectedDays = normalizeSalesDays(searchParams?.dias);
  const selectedDirection = normalizeSalesDirection(searchParams?.periodo);
  const range = salesPeriodRange(selectedDays, selectedDirection);
  const periodContracts = filterSalesContractsByPeriod(result.contracts, range);
  const summary = analyzeSales(periodContracts);
  const initialContracts = periodContracts.map(slimSalesContract);
  const directionLabel = range.direction === "past" ? "passados" : "futuros";
  const periodLabel = range.days === 1 ? "Hoje" : `${range.label} ${directionLabel}`;
  return (
    <>
      <PageHeading eyebrow="Portal comercial" title="Contratos de vendas" subtitle={`${periodContracts.length} de ${result.totalCount} contratos no recorte selecionado.`} />
      <section className="dashboard-view-switch">
        <div className="dashboard-view-summary">
          <span>Visão comercial</span>
          <strong>{periodLabel}</strong>
          <small>{range.start} até {range.end} - valores líquidos sem permutas</small>
        </div>
        <div className="dashboard-view-controls">
          <div className="dashboard-view-options compact" aria-label="Período">
            {SALES_PERIOD_OPTIONS.map((option) => (
              <Link
                key={option.days}
                href={`/sales?dias=${option.days}&periodo=${range.direction}`}
                className={option.days === range.days ? "active" : ""}
              >
                {option.label}
              </Link>
            ))}
          </div>
          <div className="dashboard-direction-options" aria-label="Direção do período">
            <Link href={`/sales?dias=${range.days}&periodo=past`} className={range.direction === "past" ? "active" : ""}>Passado</Link>
            <Link href={`/sales?dias=${range.days}&periodo=future`} className={range.direction === "future" ? "active" : ""}>Futuro</Link>
          </div>
        </div>
      </section>
      <div className="stats">
        <StatCard label="Carteira líquida" value={formatCompactCurrency(summary.netValue)} delta={`${formatCompactCurrency(summary.grossValue)} bruto - ${formatCompactCurrency(summary.exchangeValue)} em permutas`} icon="R$" />
        <StatCard label="Permutas abatidas" value={formatCompactCurrency(summary.exchangeValue)} delta={`${summary.exchangeContractCount} contratos com bem no negócio`} warn={summary.exchangeValue > 0} icon="P" />
        <StatCard label="Contratos no recorte" value={String(periodContracts.length)} delta={`${summary.activeCount} ativos e ${summary.cancelledCount} cancelados/distratados`} icon="#" />
        <StatCard label="A receber financeiro" value={formatCompactCurrency(summary.outstandingBalance)} delta={`${formatCompactCurrency(summary.amountPaid)} já recebido`} warn={summary.outstandingBalance > 0} icon="R" />
      </div>
      {result.error ? <ApiErrorNotice error={result.error} /> : <>
        <MonthlySalesChart data={summary.monthlySales} />
        <div className="grid-main equal-grid">
          <RankingChart title="Carteira líquida por empreendimento" note="Maiores volumes sem permutas" data={summary.byEnterprise} />
          <SalesSituationChart data={summary.bySituation} />
        </div>
        <SalesExplorer contracts={initialContracts} totalContracts={periodContracts.length} />
      </>}
    </>
  );
}
