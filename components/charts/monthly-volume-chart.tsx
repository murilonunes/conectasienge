import { formatCompactCurrency } from "@/lib/formatters";
import type { ChartItem } from "@/features/financeiro/sienge-data";

export function MonthlyVolumeChart({
  data,
  title = "Volume emitido por mês",
  note = "Valor bruto dos títulos retornados pela API"
}: {
  data: ChartItem[];
  title?: string;
  note?: string;
}) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <section className="card panel chart-panel">
      <div className="panel-head">
        <div><h2 className="panel-title">{title}</h2><span className="panel-note">{note}</span></div>
      </div>
      {data.length ? (
        <div className="monthly-chart">
          {data.map((item) => (
            <div className="monthly-column" key={item.label} title={`${item.label}: ${formatCompactCurrency(item.value)} em ${item.count} títulos`}>
              <span>{formatCompactCurrency(item.value)}</span>
              <div className="monthly-track"><i style={{ height: `${Math.max(4, (item.value / max) * 100)}%` }} /></div>
              <strong>{item.label}</strong>
            </div>
          ))}
        </div>
      ) : <div className="chart-empty">Sem dados para montar o gráfico.</div>}
    </section>
  );
}
