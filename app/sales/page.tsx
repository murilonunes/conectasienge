import { I18nText } from "@/components/i18n/i18n-text";
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
  SALES_PERIOD_OPTIONS,
  salesPeriodRange
} from "@/features/sales/data";
import type { SalesContract } from "@/features/sales/types";
import { formatCompactCurrency } from "@/lib/formatters";

export const dynamic = "force-dynamic";

type SalesPageProps = {
  searchParams?: {
    dias?: string | string[];
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
  const range = salesPeriodRange(selectedDays);
  const periodContracts = filterSalesContractsByPeriod(result.contracts, range);
  const summary = analyzeSales(periodContracts);
  const initialContracts = periodContracts.map(slimSalesContract);
  const periodLabel = range.days === 1 ? "Hoje" : `${range.label} passados`;
  const receivedShare = summary.netValue > 0 ? (summary.amountPaid / summary.netValue) * 100 : 0;
  return (
    <>
      <PageHeading eyebrow="Portal comercial" title="Contratos de vendas" subtitle={`${periodContracts.length} de ${result.totalCount} contratos vendidos no recorte selecionado.`} />
      <section className="dashboard-view-switch">
        <div className="dashboard-view-summary">
          <span><I18nText text={"Vendas realizadas em"} /></span>
          <strong><I18nText text={periodLabel} /></strong>
          <small>{range.start} <I18nText text={"até"} /> {range.end} <I18nText text={"- data da venda (emissão do contrato)"} /></small>
        </div>
        <div className="dashboard-view-controls">
          <div className="dashboard-view-options compact" aria-label="Período" data-i18n-aria-label={"Período"}>
            {SALES_PERIOD_OPTIONS.map((option) => (
              <Link
                key={option.days}
                href={`/sales?dias=${option.days}`}
                className={option.days === range.days ? "active" : ""}
              >
                <I18nText text={option.label} />
              </Link>
            ))}
          </div>
        </div>
      </section>
      <div className="stats sales-stats">
        <StatCard label="Contratos no recorte" value={String(periodContracts.length)} delta={`${summary.activeCount} ativos e ${summary.cancelledCount} cancelados/distratados`} icon="#" />
        <StatCard label="Total vendido (bruto)" value={formatCompactCurrency(summary.grossValue)} delta="Valor total dos contratos, somando caixa e permuta" icon="B" />
        <StatCard label="Valor em caixa" value={formatCompactCurrency(summary.netValue)} delta="Parte do valor vendido que gera dinheiro (bruto menos permuta)" icon="R$" />
        <StatCard label="Valor em permuta" value={formatCompactCurrency(summary.exchangeValue)} delta={`${summary.exchangeContractCount} contratos com bem recebido em vez de dinheiro`} warn={summary.exchangeValue > 0} icon="P" />
        <StatCard label="Já recebido em caixa" value={formatCompactCurrency(summary.amountPaid)} delta={`${receivedShare.toFixed(0)}% do valor em caixa - considera o contrato inteiro, não só este período`} icon="OK" />
        <StatCard label="Saldo em caixa a receber" value={formatCompactCurrency(summary.outstandingBalance)} delta="Parcelas em dinheiro ainda não pagas - considera o contrato inteiro, não só este período" warn={summary.outstandingBalance > 0} icon="R" />
      </div>
      {result.error ? <ApiErrorNotice error={result.error} /> : <>
        <MonthlySalesChart data={summary.monthlySales} />
        <div className="grid-main equal-grid">
          <RankingChart title="Valor em caixa por empreendimento" note="Maiores volumes recebidos em dinheiro, sem contar permutas" data={summary.byEnterprise} />
          <SalesSituationChart data={summary.bySituation} />
        </div>
        <SalesExplorer contracts={initialContracts} totalContracts={periodContracts.length} />
      </>}
    </>
  );
}
