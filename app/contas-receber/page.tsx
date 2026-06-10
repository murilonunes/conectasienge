import { MonthlyVolumeChart } from "@/components/charts/monthly-volume-chart";
import { RankingChart } from "@/components/charts/ranking-chart";
import { ReceivablesForecastTable } from "@/components/tables/receivables-forecast-table";
import { ApiErrorNotice } from "@/components/ui/api-error-notice";
import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency } from "@/lib/formatters";
import { analyzeReceivablesForecast, loadReceivablesForecast } from "@/features/receivables-forecast/sienge-data";

export const dynamic = "force-dynamic";

export default async function ContasReceberPage() {
  const forecast = await loadReceivablesForecast();
  const analytics = analyzeReceivablesForecast(forecast);

  return (
    <>
      <PageHeading
        eyebrow="Previsão financeira"
        title="Contas a receber"
        subtitle="Previsão do que a empresa tem para receber, usando parcelas abertas do Sienge por data de vencimento."
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
            <strong>Consulta usada</strong>
            <span>
              Leitura diária em cache de {forecast.loadedFrom}, de {forecast.range.startDate} até {forecast.range.endDate}, por vencimento da parcela.
              Os dados também são gravados no SQLite para formar a base paralela local.
            </span>
          </section>

          <div className="grid-main">
            <MonthlyVolumeChart
              data={analytics.monthly}
              title="Previsão por mês"
              note="Valor em aberto das parcelas a receber agrupado pelo vencimento"
            />
            <RankingChart
              title="Maiores clientes a receber"
              note="Clientes com maior saldo aberto no período carregado"
              data={analytics.clients}
            />
          </div>

          <div className="grid-main equal-grid">
            <RankingChart
              title="Origem dos recebimentos"
              note="Módulos que geraram as parcelas abertas"
              data={analytics.origins}
            />
            <section className="card methodology">
              <strong>Como a previsão é calculada</strong>
              <p>
                A tela busca parcelas pelo vencimento no bulk de recebimentos. O valor previsto usa o saldo corrigido quando o Sienge retorna esse campo;
                se ele não vier, usa o saldo em aberto e, por último, o valor original. Parcelas com saldo zero ficam fora da previsão.
              </p>
            </section>
          </div>

          <ReceivablesForecastTable entries={forecast.forecastEntries} />
        </>
      )}
    </>
  );
}
