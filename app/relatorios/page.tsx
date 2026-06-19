import Link from "next/link";
import { SiengeUpdateControls } from "@/components/settings/sienge-update-controls";
import { PageHeading } from "@/components/ui/page-heading";
import { analyzeContracts, loadSupplyContracts } from "@/features/contracts/data";
import {
  DASHBOARD_PERIOD_OPTIONS,
  loadDashboardOverview,
  normalizeDashboardDays,
  normalizeDashboardDirection
} from "@/features/dashboard/data";
import { getSiengeScreenUpdateHistory } from "@/lib/api/sienge-history";
import { formatCompactCurrency } from "@/lib/formatters";
import { reportUpdateAreas } from "@/lib/sienge-update-areas";
import { buildUpdateAreaStatuses } from "@/lib/sienge-update-status";

export const dynamic = "force-dynamic";

type RelatoriosPageProps = {
  searchParams?: {
    dias?: string | string[];
    periodo?: string | string[];
  };
};

type ReportDefinition = {
  icon: string;
  title: string;
  description: string;
  href: string;
  scope: string;
  primaryMetric: string;
  primaryLabel: string;
  secondaryMetric: string;
  secondaryLabel: string;
};

function selectedDays(value?: string | string[]) {
  return value ? normalizeDashboardDays(value) : 365;
}

function selectedDirection(value?: string | string[]) {
  return value ? normalizeDashboardDirection(value) : "past";
}

function periodLabel(days: number, direction: "future" | "past") {
  const option = DASHBOARD_PERIOD_OPTIONS.find((item) => item.days === days);
  const label = option?.label || `${days} dias`;
  return direction === "past" ? `${label} passados` : `${label} futuros`;
}

function countLabel(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export default async function RelatoriosPage({ searchParams }: RelatoriosPageProps) {
  const days = selectedDays(searchParams?.dias);
  const direction = selectedDirection(searchParams?.periodo);
  const overview = await loadDashboardOverview(days, direction, "period");
  const contracts = await loadSupplyContracts();
  const history = getSiengeScreenUpdateHistory();
  const updateStatuses = buildUpdateAreaStatuses(history, reportUpdateAreas);
  const contractSummary = analyzeContracts(contracts.contracts);
  const isPast = direction === "past";
  const unavailable = [
    ...overview.unavailable,
    contracts.error && !contracts.contracts.length ? "contratos" : undefined
  ].filter(Boolean) as string[];

  const receivablePending = isPast ? overview.receivableSummary.periodOpenAmount : overview.receivableSummary.totalOpen;
  const payablePending = isPast ? overview.payableSummary.periodAmount : overview.payableSummary.totalAmount;
  const payablePendingCount = isPast ? overview.payableSummary.periodCount : overview.payables.totalCount;
  const receivablePendingCount = isPast ? overview.receivableSummary.periodOpenCount : overview.receivableSummary.forecastCount;

  const reports: ReportDefinition[] = [
    {
      icon: "R$",
      title: "Relatório financeiro por período",
      description: "Compara entradas, saídas, saldo previsto ou realizado e pendências do recorte escolhido.",
      href: `/dashboard?dias=${days}&periodo=${direction}`,
      scope: periodLabel(days, direction),
      primaryMetric: formatCompactCurrency(isPast ? overview.realizedBalance : overview.predictedBalance),
      primaryLabel: isPast ? "resultado realizado" : "saldo futuro",
      secondaryMetric: `${formatCompactCurrency(isPast ? overview.receivableSummary.periodReceivedAmount : overview.receivableSummary.totalOpen)} / ${formatCompactCurrency(isPast ? overview.payableSummary.periodPaidAmount : overview.payableSummary.totalAmount)}`,
      secondaryLabel: isPast ? "recebido / pago" : "a receber / a pagar"
    },
    {
      icon: "P",
      title: "Relatório de contas a pagar",
      description: "Lista compromissos, pagamentos, valores em aberto e títulos que precisam de atenção.",
      href: "/contas-pagar",
      scope: "Financeiro",
      primaryMetric: formatCompactCurrency(isPast ? overview.payableSummary.expectedAmount : overview.payableSummary.totalAmount),
      primaryLabel: isPast ? "previsto no período" : "saldo a pagar",
      secondaryMetric: countLabel(payablePendingCount, "parcela pendente", "parcelas pendentes"),
      secondaryLabel: formatCompactCurrency(payablePending)
    },
    {
      icon: "R",
      title: "Relatório de contas a receber",
      description: "Mostra previsões, recebimentos vinculados, saldos pendentes e concentração por cliente.",
      href: "/contas-receber",
      scope: "Financeiro",
      primaryMetric: formatCompactCurrency(isPast ? overview.receivableSummary.expectedAmount : overview.receivableSummary.totalOpen),
      primaryLabel: isPast ? "previsto no período" : "saldo a receber",
      secondaryMetric: countLabel(receivablePendingCount, "parcela pendente", "parcelas pendentes"),
      secondaryLabel: formatCompactCurrency(receivablePending)
    },
    {
      icon: "C",
      title: "Relatório de compras",
      description: "Acompanha pedidos, solicitações, compras concluídas e pendências do processo.",
      href: "/compras",
      scope: "Suprimentos",
      primaryMetric: formatCompactCurrency(overview.purchaseSummary.purchasedAmount),
      primaryLabel: "comprado no recorte",
      secondaryMetric: countLabel(overview.purchaseSummary.pendingCount, "pendência", "pendências"),
      secondaryLabel: `${overview.purchaseSummary.orderCount} pedidos`
    },
    {
      icon: "V",
      title: "Relatório de vendas",
      description: "Consolida contratos de venda, valor vendido, empreendimentos e evolução comercial.",
      href: "/sales",
      scope: "Comercial",
      primaryMetric: formatCompactCurrency(overview.salesSummary.totalValue),
      primaryLabel: "valor vendido",
      secondaryMetric: countLabel(overview.salesSummary.activeCount, "contrato ativo", "contratos ativos"),
      secondaryLabel: "carteira comercial"
    },
    {
      icon: "CT",
      title: "Relatório de contratos",
      description: "Resume contratos de fornecimento, situação, valores contratados e saldo estimado.",
      href: "/contratos",
      scope: "Contratos",
      primaryMetric: formatCompactCurrency(contractSummary.totalValue),
      primaryLabel: "valor contratado",
      secondaryMetric: countLabel(contractSummary.activeCount, "contrato ativo", "contratos ativos"),
      secondaryLabel: `${contracts.contracts.length} integrados`
    },
    {
      icon: "E",
      title: "Relatório de estoque",
      description: "Organiza unidades e bens salvos, com situação comercial, origem e valores disponíveis.",
      href: "/estoque",
      scope: "Estoque",
      primaryMetric: String(overview.inventorySummary.unitCount),
      primaryLabel: "unidades salvas",
      secondaryMetric: formatCompactCurrency(overview.inventorySummary.totalValue),
      secondaryLabel: "valor informado"
    }
  ];

  return (
    <>
      <PageHeading
        eyebrow="Relatórios"
        title="Central de relatórios"
        subtitle="Escolha um relatório gerencial para abrir com os dados já integrados. O dashboard fica reservado para visão executiva rápida."
        action="Atualizar dados"
        actionHref="#atualizar-relatorios"
      />

      <section className="reports-filter card">
        <div>
          <span>Período padrão</span>
          <strong>{periodLabel(days, direction)}</strong>
          <small>{overview.dashboardRange.start} até {overview.dashboardRange.end}</small>
        </div>
        <div className="dashboard-view-controls">
          <div className="dashboard-view-options compact" aria-label="Período dos relatórios">
            {DASHBOARD_PERIOD_OPTIONS.map((option) => (
              <Link
                key={option.days}
                href={`/relatorios?dias=${option.days}&periodo=${direction}`}
                className={option.days === days ? "active" : ""}
              >
                {option.label}
              </Link>
            ))}
          </div>
          <div className="dashboard-direction-options" aria-label="Tipo de relatório">
            <Link href={`/relatorios?dias=${days}&periodo=past`} className={isPast ? "active" : ""}>Passado</Link>
            <Link href={`/relatorios?dias=${days}&periodo=future`} className={!isPast ? "active" : ""}>Futuro</Link>
          </div>
        </div>
      </section>

      {unavailable.length > 0 && (
        <section className="card data-notice">
          <strong>Relatórios parciais</strong>
          <span>Algumas áreas ainda não têm dados salvos: {unavailable.join(", ")}. Atualize essas áreas em Configurações para completar os relatórios.</span>
        </section>
      )}

      <section className="reports-intro card">
        <div>
          <span>Como usar</span>
          <h2>Abra o relatório certo para cada análise</h2>
          <p>
            Cada cartão abaixo leva para a tela detalhada correspondente, já seguindo o período escolhido quando fizer sentido.
            Exportação em PDF e Excel fica preparada como próxima etapa, sem misturar essa central com o dashboard.
          </p>
        </div>
        <div className="reports-intro-grid">
          <div>
            <strong>{reports.length}</strong>
            <span>relatórios disponíveis</span>
          </div>
          <div>
            <strong>{periodLabel(days, direction)}</strong>
            <span>recorte selecionado</span>
          </div>
          <div>
            <strong>Dados salvos</strong>
            <span>sem consulta ao Sienge na abertura</span>
          </div>
        </div>
      </section>

      <section className="card panel reports-update-panel" id="atualizar-relatorios">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Atualizar dados dos relatórios</h2>
            <span className="panel-note">Inicie a carga em segundo plano e continue usando o sistema enquanto os dados são salvos.</span>
          </div>
          <Link className="button secondary" href="/configuracoes">Configurações</Link>
        </div>
        <SiengeUpdateControls areas={reportUpdateAreas} statuses={updateStatuses} showForce={false} />
      </section>

      <section className="report-catalog">
        {reports.map((report) => (
          <article className="card report-card" key={report.title}>
            <div className="report-card-top">
              <div className="report-icon">{report.icon}</div>
              <span>{report.scope}</span>
            </div>
            <h2>{report.title}</h2>
            <p>{report.description}</p>
            <div className="report-card-metrics">
              <div>
                <strong>{report.primaryMetric}</strong>
                <span>{report.primaryLabel}</span>
              </div>
              <div>
                <strong>{report.secondaryMetric}</strong>
                <span>{report.secondaryLabel}</span>
              </div>
            </div>
            <div className="report-card-actions">
              <Link className="button" href={report.href}>Abrir relatório</Link>
              <span>Exportar PDF/Excel em breve</span>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
