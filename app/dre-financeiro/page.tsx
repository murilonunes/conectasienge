import Link from "next/link";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { RankingChart } from "@/components/charts/ranking-chart";
import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import {
  loadFinancialDre,
  loadFinancialDreYearOptions,
  normalizeFinancialDreYear,
  type FinancialDreFutureGroup,
  type FinancialDreMonthlyItem
} from "@/features/dre-financeiro/data";
import { formatCompactCurrency, formatCurrency } from "@/lib/formatters";

export const dynamic = "force-dynamic";

type FinancialDrePageProps = {
  searchParams?: {
    ano?: string | string[];
  };
};

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0,0%";
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function IntegrationSummary({ integrations }: { integrations: Awaited<ReturnType<typeof loadFinancialDre>>["integrations"] }) {
  return (
    <section className="card dre-integration-panel">
      {integrations.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{item.count} registros</strong>
          <small>
            {item.lastIntegrationDay
              ? `Integrado em ${item.lastIntegrationDay}`
              : item.lastSavedAt
                ? `Salvo em ${item.lastSavedAt.slice(0, 10)}`
                : "Ainda sem integração salva"}
          </small>
        </div>
      ))}
    </section>
  );
}

function MonthlyTable({ monthly }: { monthly: FinancialDreMonthlyItem[] }) {
  return (
    <section className="card table-card dre-monthly-table">
      <div className="table-head">
        <h2 className="panel-title">DRE financeiro mês a mês</h2>
        <span className="panel-note">Previsto por vencimento e realizado por baixa registrada em contas a pagar/receber</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Mês</th>
            <th>A receber previsto</th>
            <th>Recebido</th>
            <th>A pagar previsto</th>
            <th>Pago</th>
            <th>Resultado previsto</th>
            <th>Resultado realizado</th>
            <th>Aberto líquido</th>
          </tr>
        </thead>
        <tbody>
          {monthly.map((item) => {
            const openNet = item.openReceivables - item.openPayables;
            return (
              <tr key={item.key}>
                <td><strong>{item.label}</strong></td>
                <td>{formatCurrency(item.receivableDue)}</td>
                <td>{formatCurrency(item.receivableReceived)}</td>
                <td>{formatCurrency(item.payableDue)}</td>
                <td>{formatCurrency(item.payablePaid)}</td>
                <td className={item.projectedResult < 0 ? "negative-cell" : "positive-cell"}>{formatCurrency(item.projectedResult)}</td>
                <td className={item.realizedResult < 0 ? "negative-cell" : "positive-cell"}>{formatCurrency(item.realizedResult)}</td>
                <td className={openNet < 0 ? "negative-cell" : "positive-cell"}>{formatCurrency(openNet)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function FutureGroups({ groups }: { groups: FinancialDreFutureGroup[] }) {
  return (
    <section className="card table-card dre-monthly-table">
      <div className="table-head">
        <h2 className="panel-title">Futuro agrupado</h2>
        <span className="panel-note">Somente parcelas abertas com vencimento a partir de hoje, agrupadas por distância do vencimento</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Faixa</th>
            <th>A receber aberto</th>
            <th>Parcelas a receber</th>
            <th>A pagar aberto</th>
            <th>Parcelas a pagar</th>
            <th>Saldo futuro</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((item) => (
            <tr key={item.key}>
              <td><strong>{item.label}</strong></td>
              <td>{formatCurrency(item.receivableOpen)}</td>
              <td>{item.receivableCount}</td>
              <td>{formatCurrency(item.payableOpen)}</td>
              <td>{item.payableCount}</td>
              <td className={item.netResult < 0 ? "negative-cell" : "positive-cell"}>{formatCurrency(item.netResult)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ResultTrend({ monthly }: { monthly: FinancialDreMonthlyItem[] }) {
  const max = Math.max(...monthly.map((item) => Math.abs(item.projectedResult)), 1);

  return (
    <section className="card panel dre-result-panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Resultado previsto por mês</h2>
          <span className="panel-note">A receber previsto menos a pagar previsto, usando a data de vencimento</span>
        </div>
      </div>
      <div className="dre-result-bars">
        {monthly.map((item) => {
          const positive = item.projectedResult >= 0;
          return (
            <div key={item.key} title={`${item.label}: ${formatCurrency(item.projectedResult)}`}>
              <span>{formatCompactCurrency(item.projectedResult)}</span>
              <div className="dre-result-track">
                <i
                  className={positive ? "positive" : "negative"}
                  style={{ height: `${Math.max(5, (Math.abs(item.projectedResult) / max) * 100)}%` }}
                />
              </div>
              <strong>{item.label}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default async function FinancialDrePage({ searchParams }: FinancialDrePageProps) {
  const availableYears = loadFinancialDreYearOptions();
  const selectedYear = normalizeFinancialDreYear(searchParams?.ano, availableYears);
  const requestedYearParam = Array.isArray(searchParams?.ano) ? searchParams?.ano[0] : searchParams?.ano;
  const requestedYear = Number(requestedYearParam);
  const yearWasAdjusted = Boolean(requestedYearParam && Number.isInteger(requestedYear) && requestedYear !== selectedYear);
  const dre = await loadFinancialDre(selectedYear);
  const projectedPositive = dre.projectedResult >= 0;
  const realizedPositive = dre.realizedResult >= 0;
  const receiptCoverage = dre.receivableDue > 0 ? (dre.receivableReceived / dre.receivableDue) * 100 : 0;
  const paymentCoverage = dre.payableDue > 0 ? (dre.payablePaid / dre.payableDue) * 100 : 0;

  return (
    <>
      <PageHeading
        eyebrow="Resultado financeiro"
        title="DRE financeiro"
        subtitle="DRE gerencial baseada 100% em contas a receber e contas a pagar: vencimentos, baixas e saldo futuro aberto."
        action="Atualizar dados"
        actionHref="/configuracoes"
      />

      <section className="reports-filter card">
        <div>
          <span>Exercício</span>
          <strong>{selectedYear}</strong>
          <small>{dre.range.start} até {dre.range.end}</small>
        </div>
        <div className="dashboard-view-controls">
          <div className="dashboard-view-options compact" aria-label="Ano da DRE financeira">
            {availableYears.map((year) => (
              <Link
                key={year}
                href={`/dre-financeiro?ano=${year}`}
                className={year === selectedYear ? "active" : ""}
              >
                {year}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {yearWasAdjusted && (
        <section className="card data-notice">
          <strong>Ano ajustado</strong>
          <span>O exercício {requestedYear} não tem base local de contas. A tela foi aberta em {selectedYear}, que possui dados salvos.</span>
        </section>
      )}

      {dre.unavailable.length > 0 && (
        <section className="card data-notice">
          <strong>Visão parcial</strong>
          <span>Algumas bases ainda não têm dados salvos: {dre.unavailable.join(", ")}. Atualize essas áreas em Configurações.</span>
        </section>
      )}

      <section className={`card dashboard-executive dre-executive ${projectedPositive ? "" : "warning"}`}>
        <div className="dashboard-executive-main">
          <span>{projectedPositive ? "Resultado previsto positivo" : "Resultado previsto negativo"}</span>
          <h2>{formatCompactCurrency(dre.projectedResult)}</h2>
          <p>
            A receber previsto de {formatCompactCurrency(dre.receivableDue)} menos a pagar previsto de {formatCompactCurrency(dre.payableDue)}.
            A visão considera somente títulos e parcelas do contas a receber/pagar.
          </p>
        </div>
        <div className="dashboard-executive-grid">
          <div>
            <span>Resultado realizado</span>
            <strong className={realizedPositive ? "" : "negative"}>{formatCompactCurrency(dre.realizedResult)}</strong>
            <small>{formatCompactCurrency(dre.receivableReceived)} recebido e {formatCompactCurrency(dre.payablePaid)} pago no ano.</small>
          </div>
          <div>
            <span>Aberto líquido do ano</span>
            <strong className={dre.openResult < 0 ? "negative" : ""}>{formatCompactCurrency(dre.openResult)}</strong>
            <small>{dre.openReceivablesCount} parcelas a receber e {dre.openPayablesCount} a pagar ainda abertas.</small>
          </div>
          <div>
            <span>Saldo futuro aberto</span>
            <strong className={dre.futureNetResult < 0 ? "negative" : ""}>{formatCompactCurrency(dre.futureNetResult)}</strong>
            <small>Vencimentos abertos a partir de {dre.baseDate}, agrupados abaixo.</small>
          </div>
        </div>
      </section>

      <div className="stats dre-stats">
        <StatCard label="A receber previsto" value={formatCompactCurrency(dre.receivableDue)} delta={`${dre.receivableDueCount} parcelas no ano`} icon="AR" />
        <StatCard label="Recebido" value={formatCompactCurrency(dre.receivableReceived)} delta={`${formatPercent(receiptCoverage)} do previsto por vencimento`} icon="R" />
        <StatCard label="A pagar previsto" value={formatCompactCurrency(dre.payableDue)} delta={`${dre.payableDueCount} parcelas no ano`} warn={dre.payableDue > dre.receivableDue} icon="AP" />
        <StatCard label="Pago" value={formatCompactCurrency(dre.payablePaid)} delta={`${formatPercent(paymentCoverage)} do previsto por vencimento`} warn={dre.payablePaid > dre.receivableReceived} icon="P" />
        <StatCard label="A receber em atraso" value={formatCompactCurrency(dre.overdueReceivables)} delta={`${dre.overdueReceivablesCount} parcelas vencidas abertas`} warn={dre.overdueReceivables > 0} icon="!" />
        <StatCard label="A pagar em atraso" value={formatCompactCurrency(dre.overduePayables)} delta={`${dre.overduePayablesCount} parcelas vencidas abertas`} warn={dre.overduePayables > 0} icon="!" />
      </div>

      <IntegrationSummary integrations={dre.integrations} />

      <div className="dre-grid-wide">
        <CashFlowChart
          data={dre.projectedFlow}
          title="Previsto por vencimento"
          note="Contas a receber previstas contra contas a pagar previstas"
        />
        <CashFlowChart
          data={dre.realizedFlow}
          title="Realizado por baixa"
          note="Recebimentos registrados contra pagamentos registrados"
        />
      </div>

      <ResultTrend monthly={dre.monthly} />

      <div className="grid-main equal-grid">
        <RankingChart title="Maiores clientes no ano" note="Contas a receber previstas por vencimento" data={dre.clients} countLabel="parcela" />
        <RankingChart title="Maiores fornecedores no ano" note="Contas a pagar previstas por vencimento" data={dre.creditors} countLabel="parcela" />
      </div>

      <FutureGroups groups={dre.futureGroups} />
      <MonthlyTable monthly={dre.monthly} />

      <section className="card methodology dre-methodology">
        <strong>Como ler esta DRE financeira</strong>
        <p>
          Previsto usa a data de vencimento das parcelas de contas a receber e contas a pagar. Realizado usa as baixas salvas
          em recebimentos e pagamentos. A visão futura considera apenas parcelas abertas com vencimento de hoje em diante.
          Esta tela não usa contratos de venda, compras, estoque ou POC.
        </p>
      </section>
    </>
  );
}
