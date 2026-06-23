import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { ApiErrorNotice } from "@/components/ui/api-error-notice";
import { RankingChart } from "@/components/charts/ranking-chart";
import { SalesExplorer } from "@/components/sales/sales-explorer";
import { SalesSituationChart } from "@/components/sales/sales-situation-chart";
import { MonthlySalesChart } from "@/components/sales/monthly-sales-chart";
import { analyzeSales, loadSalesContracts } from "@/features/sales/data";
import type { SalesContract } from "@/features/sales/types";
import { formatCompactCurrency } from "@/lib/formatters";

export const dynamic = "force-dynamic";

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
      conditionTypeName: condition.conditionTypeName,
      installmentsNumber: condition.installmentsNumber,
      openInstallmentsNumber: condition.openInstallmentsNumber,
      outstandingBalance: condition.outstandingBalance,
      amountPaid: condition.amountPaid
    })),
    __siengeIntegrationDay: (contract as SalesContract & { __siengeIntegrationDay?: string }).__siengeIntegrationDay,
    __siengeIntegratedAt: (contract as SalesContract & { __siengeIntegratedAt?: string }).__siengeIntegratedAt
  } as SalesContract;
}

export default async function SalesPage() {
  const result = await loadSalesContracts();
  const summary = analyzeSales(result.contracts);
  const initialContracts = result.contracts.map(slimSalesContract);
  return (
    <>
      <PageHeading eyebrow="Portal comercial" title="Contratos de vendas" subtitle={`${result.contracts.length} de ${result.totalCount} contratos disponíveis nos dados integrados.`} />
      <div className="stats">
        <StatCard label="Carteira líquida" value={formatCompactCurrency(summary.netValue)} delta={`${formatCompactCurrency(summary.grossValue)} bruto - ${formatCompactCurrency(summary.exchangeValue)} em permutas`} icon="R$" />
        <StatCard label="Permutas abatidas" value={formatCompactCurrency(summary.exchangeValue)} delta={`${summary.exchangeContractCount} contratos com bem no negócio`} warn={summary.exchangeValue > 0} icon="P" />
        <StatCard label="A receber financeiro" value={formatCompactCurrency(summary.outstandingBalance)} delta="Sem condições de permuta" warn icon="↗" />
        <StatCard label="Recebido financeiro" value={formatCompactCurrency(summary.amountPaid)} delta="Sem condições de permuta" icon="✓" />
      </div>
      {result.error ? <ApiErrorNotice error={result.error} /> : <>
        <MonthlySalesChart data={summary.monthlySales} />
        <div className="grid-main equal-grid">
          <RankingChart title="Carteira por empreendimento" note="Maiores volumes de contratos" data={summary.byEnterprise} />
          <SalesSituationChart data={summary.bySituation} />
        </div>
        <SalesExplorer contracts={initialContracts} totalContracts={result.contracts.length} />
      </>}
    </>
  );
}
