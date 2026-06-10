import { formatCompactCurrency } from "@/lib/formatters";
import type { ScheduleBucket } from "@/features/payables-schedule/types";

export function PayablesCalendarChart({ buckets }: { buckets: ScheduleBucket[] }) {
  const max = Math.max(...buckets.map((bucket) => bucket.amount), 1);
  return (
    <section className="card panel payables-calendar-chart">
      <div className="panel-head"><div><h2 className="panel-title">Programação financeira</h2><span className="panel-note">Saldo corrigido previsto por janela de vencimento</span></div></div>
      <div className="payables-bars">{buckets.map((bucket) => <div key={bucket.id}><span>{formatCompactCurrency(bucket.amount)}</span><div><i style={{ height: `${Math.max(bucket.amount ? 6 : 0, (bucket.amount / max) * 100)}%` }} /></div><strong>{bucket.label}</strong><small>{bucket.items.length} parcela{bucket.items.length === 1 ? "" : "s"}</small></div>)}</div>
    </section>
  );
}
