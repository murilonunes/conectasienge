import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { ApiErrorNotice } from "@/components/ui/api-error-notice";
import { RankingChart } from "@/components/charts/ranking-chart";
import { SalesExplorer } from "@/components/sales/sales-explorer";
import { SalesSituationChart } from "@/components/sales/sales-situation-chart";
import { MonthlySalesChart } from "@/components/sales/monthly-sales-chart";
import { analyzeSales, loadSalesContracts } from "@/features/sales/data";
import type { SalesContract } from "@/features/sales/types";
import { formatCompactCurrency, formatCurrency } from "@/lib/formatters";

export const dynamic = "force-dynamic";

const INITIAL_CONTRACT_LIMIT = 100;

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
  const initialContracts = result.contracts.slice(0, INITIAL_CONTRACT_LIMIT).map(slimSalesContract);
  return (
    <>
      <PageHeading eyebrow="Portal comercial" title="Contratos de vendas" subtitle={`${result.contracts.length} de ${result.totalCount} contratos disponíveis nos dados integrados.`} />
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
        <SalesExplorer contracts={initialContracts} totalContracts={result.contracts.length} />
      </>}
    </>
  );
}
