import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { ApiErrorNotice } from "@/components/ui/api-error-notice";
import { PayablesCalendarChart } from "@/components/payables/payables-calendar-chart";
import { PayablesAgenda } from "@/components/payables/payables-agenda";
import { loadPayablesSchedule } from "@/features/payables-schedule/data";
import { formatCompactCurrency, formatCurrency } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function ContasPagarPage() {
  const schedule = await loadPayablesSchedule();
  const today = schedule.buckets.find((bucket) => bucket.id === "today");
  const month = schedule.buckets.filter((bucket) => ["today", "week", "month"].includes(bucket.id));
  const monthAmount = month.reduce((sum, bucket) => sum + bucket.amount, 0);
  const futureLabel = schedule.futureMonths === 1 ? "Próximo mês" : `Próximos ${schedule.futureMonths} meses`;

  return (
    <>
      <PageHeading
        eyebrow="Agenda financeira"
        title="Contas a pagar"
        subtitle={`Pagamentos programados por vencimento, do dia atual aos ${futureLabel.toLowerCase()}.`}
        action="Busca avançada"
        actionHref="/lancamentos/baixa"
      />
      <div className="stats">
        <StatCard label="Programado para hoje" value={formatCurrency(today?.amount || 0)} delta={`${today?.items.length || 0} parcelas vencem hoje`} icon="H" />
        <StatCard label="Mês atual" value={formatCompactCurrency(monthAmount)} delta="Hoje, semana e restante do mês" icon="M" />
        <StatCard label={futureLabel} value={formatCompactCurrency(schedule.totalAmount - monthAmount)} delta="Planejamento futuro" icon={`${schedule.futureMonths}M`} />
        <StatCard label="Parcelas autorizadas" value={`${schedule.authorizedCount}/${schedule.totalCount}`} delta="No período consultado" warn={schedule.authorizedCount < schedule.totalCount} icon="A" />
      </div>
      {schedule.error ? <ApiErrorNotice error={schedule.error} /> : <>
        <PayablesCalendarChart buckets={schedule.buckets} />
        <PayablesAgenda buckets={schedule.buckets} />
      </>}
    </>
  );
}
