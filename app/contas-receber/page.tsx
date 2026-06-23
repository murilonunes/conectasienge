import { MonthlyVolumeChart } from "@/components/charts/monthly-volume-chart";
import { RankingChart } from "@/components/charts/ranking-chart";
import { ReceivablesForecastTable } from "@/components/tables/receivables-forecast-table";
import { ApiErrorNotice } from "@/components/ui/api-error-notice";
import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency } from "@/lib/formatters";
import { analyzeReceivablesForecast, loadReceivablesForecast, type ReceivableInstallment } from "@/features/receivables-forecast/sienge-data";

export const dynamic = "force-dynamic";

const INITIAL_RECEIVABLES_LIMIT = 200;

function slimReceivableEntry(entry: ReceivableInstallment): ReceivableInstallment {
  return {
    companyName: entry.companyName,
    businessAreaName: entry.businessAreaName,
    clientId: entry.clientId,
    clientName: entry.clientName,
    billId: entry.billId,
    receivableBillId: entry.receivableBillId,
    installmentId: entry.installmentId,
    documentIdentificationId: entry.documentIdentificationId,
    documentNumber: entry.documentNumber,
    documentForecast: entry.documentForecast,
    originalAmount: entry.originalAmount,
    balanceAmount: entry.balanceAmount,
    correctedBalanceAmount: entry.correctedBalanceAmount,
    dueDate: entry.dueDate,
    mainUnit: entry.mainUnit,
    installmentNumber: entry.installmentNumber,
    receipts: entry.receipts?.map((receipt) => ({
      grossAmount: receipt.grossAmount,
      netAmount: receipt.netAmount
    })),
    __siengeIntegrationDay: entry.__siengeIntegrationDay,
    __siengeIntegratedAt: entry.__siengeIntegratedAt
  };
}

export default async function ContasReceberPage() {
  const forecast = await loadReceivablesForecast();
  const analytics = analyzeReceivablesForecast(forecast);
  const initialEntries = forecast.forecastEntries.slice(0, INITIAL_RECEIVABLES_LIMIT).map(slimReceivableEntry);

  return (
    <>
      <PageHeading
        eyebrow="Previsão financeira"
        title="Contas a receber"
        subtitle="Previsão do que a empresa tem para receber, usando parcelas abertas por data de vencimento."
      />

      <div className="stats">
        <StatCard label="Total a receber" value={formatCurrency(analytics.totalOpen)} delta={`${analytics.forecastCount} parcelas abertas`} icon="R$" />
        <StatCard label="Mês atual" value={formatCurrency(analytics.currentMonthAmount)} delta="Vencimentos dentro do mês" icon="M" />
        <StatCard label="Próximos 30 dias" value={formatCurrency(analytics.next30DaysAmount)} delta="Agenda imediata de caixa" icon="30" />
        <StatCard label="Em atraso" value={formatCurrency(analytics.overdueAmount)} delta={`${analytics.overdueCount} parcelas vencidas`} warn={analytics.overdueAmount > 0} icon="!" />
      </div>

      {forecast.error && <ApiErrorNotice error={forecast.error} />}

      {!forecast.error && (
        <>
          <section className="card data-notice">
            <strong>Dados carregados</strong>
            <span>
              Leitura de {forecast.range.startDate} até {forecast.range.endDate}, por vencimento da parcela.
              Para trazer dados novos, use a atualização em Configurações.
            </span>
          </section>

          <div className="grid-main">
            <MonthlyVolumeChart
              data={analytics.monthly}
              title="Previsão por mês"
              note="Valor em aberto das parcelas a receber agrupado pelo vencimento"
              countLabel="parcela"
            />
            <RankingChart
              title="Maiores clientes a receber"
              note="Clientes com maior saldo aberto no período carregado"
              data={analytics.clients}
              countLabel="parcela"
            />
          </div>

          <div className="grid-main equal-grid">
            <RankingChart
              title="Origem dos recebimentos"
              note="Áreas que geraram as parcelas abertas"
              data={analytics.origins}
              countLabel="parcela"
            />
            <section className="card methodology">
              <strong>Como a previsão é calculada</strong>
              <p>
                A tela considera parcelas abertas por vencimento. O valor previsto usa o saldo corrigido quando disponível;
                se ele não vier, usa o saldo em aberto e, por último, o valor original. Parcelas com saldo zero ficam fora da previsão.
              </p>
            </section>
          </div>

          <ReceivablesForecastTable entries={initialEntries} totalEntries={forecast.forecastEntries.length} />
        </>
      )}
    </>
  );
}
