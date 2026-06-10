import { formatCompactCurrency } from "@/lib/formatters";
import type { ChartItem } from "@/features/financeiro/sienge-data";

export function RankingChart({ title, note, data }: { title: string; note: string; data: ChartItem[] }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <section className="card panel">
      <div className="panel-head"><div><h2 className="panel-title">{title}</h2><span className="panel-note">{note}</span></div></div>
      {data.length ? <div className="ranking-list">
        {data.map((item) => (
          <div className="ranking-row" key={item.label}>
            <div><span>{item.label}</span><strong>{formatCompactCurrency(item.value)}</strong></div>
            <div className="ranking-track"><i style={{ width: `${(item.value / max) * 100}%` }} /></div>
            <small>{item.count} título{item.count === 1 ? "" : "s"}</small>
          </div>
        ))}
      </div> : <div className="chart-empty">Sem dados para montar o ranking.</div>}
    </section>
  );
}
