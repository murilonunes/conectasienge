import { formatCompactCurrency } from "@/lib/formatters";

export type DreYearlyStackedItem = {
  label: string;
  positive: number;
  negative: number;
};

export function DreYearlyStackedChart({
  data,
  title,
  note,
  positiveLabel,
  negativeLabel
}: {
  data: DreYearlyStackedItem[];
  title: string;
  note: string;
  positiveLabel: string;
  negativeLabel: string;
}) {
  const max = Math.max(...data.map((item) => item.positive + item.negative), 1);

  return (
    <section className="card panel dre-yearly-panel">
      <div className="panel-head">
        <div><h2 className="panel-title">{title}</h2><span className="panel-note">{note}</span></div>
        <div className="chart-legend"><span><i className="dot" />{positiveLabel}</span><span><i className="dot out" />{negativeLabel}</span></div>
      </div>
      {data.length ? (
        <div className="dre-yearly-chart">
          {data.map((item) => {
            const total = item.positive + item.negative;
            const net = item.positive - item.negative;
            return (
              <div
                className="dre-yearly-column"
                key={item.label}
                title={`${item.label}: ${formatCompactCurrency(item.positive)} ${positiveLabel.toLowerCase()} + ${formatCompactCurrency(item.negative)} ${negativeLabel.toLowerCase()} - resultado ${formatCompactCurrency(net)}`}
              >
                <span className={net < 0 ? "negative" : ""}>{formatCompactCurrency(net)}</span>
                <div className="dre-yearly-bars">
                  <div className="dre-yearly-stack" style={{ height: `${total > 0 ? Math.max(4, (total / max) * 100) : 0}%` }}>
                    <i className="dre-yearly-positive" style={{ flexGrow: Math.max(item.positive, 0) || (item.negative > 0 ? 0 : 1) }} />
                    {item.negative > 0 && <i className="dre-yearly-negative" style={{ flexGrow: item.negative }} />}
                  </div>
                </div>
                <strong>{item.label}</strong>
              </div>
            );
          })}
        </div>
      ) : <div className="chart-empty">Sem dados para montar o gráfico.</div>}
    </section>
  );
}
