import { I18nText } from "@/components/i18n/i18n-text";
import type { ChartItem } from "@/features/financeiro/sienge-data";

export function MonthlyCountLine({
  data,
  title = "Quantidade mensal",
  note = "Evolução do número de registros"
}: {
  data: ChartItem[];
  title?: string;
  note?: string;
}) {
  const splitLabel = (label: string) => {
    const parts = label.trim().split(/\s+/);
    if (parts.length < 2) return [label];
    const year = parts[parts.length - 1];
    if (!/^\d{2,4}$/.test(year)) return [label];
    return [parts.slice(0, -1).join(" "), year];
  };
  const max = Math.max(...data.map((item) => item.count), 1);
  const width = 720;
  const height = 235;
  const padding = 34;
  const points = data.map((item, index) => {
    const x = data.length === 1 ? width / 2 : padding + (index / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - (item.count / max) * (height - padding * 2);
    return { ...item, x, y };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <section className="card panel dashboard-chart">
      <div className="panel-head"><div><h2 className="panel-title"><I18nText text={title} /></h2><span className="panel-note"><I18nText text={note} /></span></div></div>
      {data.length ? <div className="line-chart-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
          <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} className="line-axis" />
          <polyline points={polyline} className="line-series" />
          {points.map((point) => {
            const labelLines = splitLabel(point.label);
            return (
              <g key={point.label}>
                <circle cx={point.x} cy={point.y} r="5" className="line-dot" />
                <text x={point.x} y={point.y - 12} textAnchor="middle">{point.count}</text>
                <text x={point.x} y={height - 18} textAnchor="middle">
                  <tspan x={point.x}>{labelLines[0]}</tspan>
                  {labelLines[1] && <tspan x={point.x} dy="11">{labelLines[1]}</tspan>}
                </text>
              </g>
            );
          })}
        </svg>
      </div> : <div className="chart-empty"><I18nText text={"Sem dados para montar o gráfico."} /></div>}
    </section>
  );
}
