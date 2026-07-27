import { I18nText } from "@/components/i18n/i18n-text";
import Link from "next/link";
import { SiengeUpdateControls } from "@/components/settings/sienge-update-controls";
import { PageHeading } from "@/components/ui/page-heading";
import {
  DASHBOARD_PERIOD_OPTIONS,
  loadDashboardOverview,
  normalizeDashboardDays,
  normalizeDashboardDirection
} from "@/features/dashboard/data";
import { loadContractsReportSummary, loadDreReportSummary, loadFinancialDreReportSummary } from "@/features/reports/data";
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
  const contracts = loadContractsReportSummary();
  const dre = loadDreReportSummary();
  const financialDre = loadFinancialDreReportSummary();
  const history = getSiengeScreenUpdateHistory();
  const updateStatuses = buildUpdateAreaStatuses(history, reportUpdateAreas);
  const isPast = direction === "past";
  const unavailable = [
    ...overview.unavailable,
    contracts.totalCount === 0 ? "contratos" : undefined,
    dre.baseCount === 0 ? "base da DRE POC" : undefined,
    financialDre.baseCount === 0 ? "base da DRE financeira" : undefined
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
      icon: "=",
      title: "DRE financeiro",
      description: "Apura resultado anual e futuro agrupado usando somente contas a receber e contas a pagar.",
      href: `/dre-financeiro?ano=${financialDre.year}`,
      scope: `Exercício ${financialDre.year}`,
      primaryMetric: String(financialDre.availableYears.length),
      primaryLabel: financialDre.availableYears.length === 1 ? "ano com contas salvas" : "anos com contas salvas",
      secondaryMetric: String(financialDre.baseCount),
      secondaryLabel: "parcelas para apuração"
    },
    {
      icon: "P%",
      title: "DRE POC estimada",
      description: "Abre a apuração anual por avanço da obra, custos e caixa realizado.",
      href: `/dre-gerencial?ano=${dre.year}`,
      scope: `Exercício ${dre.year}`,
      primaryMetric: String(dre.availableYears.length),
      primaryLabel: dre.availableYears.length === 1 ? "ano com base salva" : "anos com base salva",
      secondaryMetric: String(dre.baseCount),
      secondaryLabel: "registros para apuração"
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
      primaryMetric: formatCompactCurrency(contracts.totalValue),
      primaryLabel: "valor contratado",
      secondaryMetric: countLabel(contracts.activeCount, "contrato ativo", "contratos ativos"),
      secondaryLabel: `${contracts.totalCount} integrados`
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
          <span><I18nText text={"Período padrão"} /></span>
          <strong>{periodLabel(days, direction)}</strong>
          <small>{overview.dashboardRange.start} <I18nText text={"até"} /> {overview.dashboardRange.end}</small>
        </div>
        <div className="dashboard-view-controls">
          <div className="dashboard-view-options compact" aria-label="Período dos relatórios" data-i18n-aria-label={"Período dos relatórios"}>
            {DASHBOARD_PERIOD_OPTIONS.map((option) => (
              <Link
                key={option.days}
                href={`/relatorios?dias=${option.days}&periodo=${direction}`}
                className={option.days === days ? "active" : ""}
              >
                <I18nText text={option.label} />
              </Link>
            ))}
          </div>
          <div className="dashboard-direction-options" aria-label="Tipo de relatório" data-i18n-aria-label={"Tipo de relatório"}>
            <Link href={`/relatorios?dias=${days}&periodo=past`} className={isPast ? "active" : ""}><I18nText text={"Passado"} /></Link>
            <Link href={`/relatorios?dias=${days}&periodo=future`} className={!isPast ? "active" : ""}><I18nText text={"Futuro"} /></Link>
          </div>
        </div>
      </section>

      {unavailable.length > 0 && (
        <section className="card data-notice">
          <strong><I18nText text={"Relatórios parciais"} /></strong>
          <span><I18nText text={"Algumas áreas ainda não têm dados salvos:"} /> {unavailable.join(", ")}<I18nText text={". Atualize essas áreas em Configurações para completar os relatórios."} /></span>
        </section>
      )}

      <section className="reports-intro card">
        <div>
          <span><I18nText text={"Como usar"} /></span>
          <h2><I18nText text={"Abra o relatório certo para cada análise"} /></h2>
          <p>
            <I18nText text={"Cada cartão abre a tela detalhada correspondente e usa apenas um resumo salvo para orientar a escolha. O relatório completo é montado só quando você entra na análise, mantendo esta central rápida."} />
          </p>
        </div>
        <div className="reports-intro-grid">
          <div>
            <strong>{reports.length}</strong>
            <span><I18nText text={"relatórios disponíveis"} /></span>
          </div>
          <div>
            <strong>{periodLabel(days, direction)}</strong>
            <span><I18nText text={"recorte selecionado"} /></span>
          </div>
          <div>
            <strong><I18nText text={"Dados salvos"} /></strong>
            <span><I18nText text={"sem consulta ao Sienge na abertura"} /></span>
          </div>
        </div>
      </section>

      <section className="card panel reports-update-panel" id="atualizar-relatorios">
        <div className="panel-head">
          <div>
            <h2 className="panel-title"><I18nText text={"Atualizar dados dos relatórios"} /></h2>
            <span className="panel-note"><I18nText text={"Inicie a carga em segundo plano e continue usando o sistema enquanto os dados são salvos."} /></span>
          </div>
          <Link className="button secondary" href="/configuracoes"><I18nText text={"Configurações"} /></Link>
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
                <span><I18nText text={report.primaryLabel} /></span>
              </div>
              <div>
                <strong>{report.secondaryMetric}</strong>
                <span><I18nText text={report.secondaryLabel} /></span>
              </div>
            </div>
            <div className="report-card-actions">
              <Link className="button" href={report.href}><I18nText text={"Abrir relatório"} /></Link>
              <span><I18nText text={"Exportar PDF/Excel em breve"} /></span>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
