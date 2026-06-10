import type { ChartItem } from "@/features/financeiro/sienge-data";

export function MonthlyCountLine({ data }: { data: ChartItem[] }) {
  const max = Math.max(...data.map((item) => item.count), 1);
  const width = 720;
  const height = 220;
  const padding = 24;
  const points = data.map((item, index) => {
    const x = data.length === 1 ? width / 2 : padding + (index / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - (item.count / max) * (height - padding * 2);
    return { ...item, x, y };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <section className="card panel dashboard-chart">
      <div className="panel-head"><div><h2 className="panel-title">Quantidade mensal de títulos</h2><span className="panel-note">Evolução do número de títulos emitidos</span></div></div>
      {data.length ? <div className="line-chart-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Quantidade mensal de títulos">
          <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} className="line-axis" />
          <polyline points={polyline} className="line-series" />
          {points.map((point) => <g key={point.label}><circle cx={point.x} cy={point.y} r="5" className="line-dot" /><text x={point.x} y={point.y - 12} textAnchor="middle">{point.count}</text><text x={point.x} y={height - 5} textAnchor="middle">{point.label}</text></g>)}
        </svg>
      </div> : <div className="chart-empty">Sem dados para montar o gráfico.</div>}
    </section>
  );
}
