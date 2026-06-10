import { formatCompactCurrency } from "@/lib/formatters";
import type { ChartItem } from "@/features/financeiro/sienge-data";

export function OriginBubbleChart({ data }: { data: ChartItem[] }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <section className="card panel dashboard-chart chart-wide">
      <div className="panel-head"><div><h2 className="panel-title">Peso financeiro por origem</h2><span className="panel-note">Tamanho representa valor bruto; número representa quantidade</span></div></div>
      {data.length ? <div className="bubble-grid">{data.map((item) => {
        const size = 90 + (item.value / max) * 85;
        return <div className="bubble-item" key={item.label}><div className="bubble" style={{ width: size, height: size }}><strong>{item.count}</strong><span>{formatCompactCurrency(item.value)}</span></div><p>{item.label}</p></div>;
      })}</div> : <div className="chart-empty">Sem dados para montar o gráfico.</div>}
    </section>
  );
}
