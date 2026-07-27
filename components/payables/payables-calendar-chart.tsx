import { I18nText } from "@/components/i18n/i18n-text";
import { formatCompactCurrency } from "@/lib/formatters";
import type { ScheduleBucket } from "@/features/payables-schedule/types";

export function PayablesCalendarChart({ buckets }: { buckets: ScheduleBucket[] }) {
  const max = Math.max(...buckets.map((bucket) => bucket.amount), 1);
  return (
    <section className="card panel payables-calendar-chart">
      <div className="panel-head"><div><h2 className="panel-title"><I18nText text={"Programação financeira"} /></h2><span className="panel-note"><I18nText text={"Saldo corrigido previsto por janela de vencimento"} /></span></div></div>
      <div className="payables-bars">{buckets.map((bucket) => <div key={bucket.id}><span><I18nText text={formatCompactCurrency(bucket.amount)} /></span><div><i style={{ height: `${Math.max(bucket.amount ? 6 : 0, (bucket.amount / max) * 100)}%` }} /></div><strong><I18nText text={bucket.label} /></strong><small><I18nText text={`${bucket.items.length} ${bucket.items.length === 1 ? "parcela" : "parcelas"}`} /></small></div>)}</div>
    </section>
  );
}
