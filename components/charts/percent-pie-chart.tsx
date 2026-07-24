import { I18nText } from "@/components/i18n/i18n-text";
import type { ChartItem } from "@/features/financeiro/sienge-data";

const colors = ["#1f6b4f", "#4d9879", "#77b096", "#d6a04e", "#c46655", "#8d7baf", "#6f8792", "#c9a15b"];

type PercentPieChartProps = {
  title: string;
  note: string;
  data: ChartItem[];
  centerLabel?: string;
};

export function PercentPieChart({ title, note, data, centerLabel = "itens" }: PercentPieChartProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  let current = 0;
  const gradient = data.map((item, index) => {
    const start = total ? (current / total) * 100 : 0;
    current += item.count;
    const end = total ? (current / total) * 100 : 0;
    return `${colors[index % colors.length]} ${start}% ${end}%`;
  }).join(", ");

  return (
    <section className="card panel">
      <div className="panel-head"><div><h2 className="panel-title"><I18nText text={title} /></h2><span className="panel-note"><I18nText text={note} /></span></div></div>
      {data.length ? (
        <div className="percent-pie-layout">
          <div className="percent-pie" style={{ background: `conic-gradient(${gradient || "#edf1ee 0 100%"})` }}>
            <div><strong>{total}</strong><span><I18nText text={centerLabel} /></span></div>
          </div>
          <div className="percent-pie-legend">
            {data.map((item, index) => {
              const percentage = total ? (item.count / total) * 100 : 0;
              return (
                <div key={item.label}>
                  <i style={{ background: colors[index % colors.length] }} />
                  <span>{item.label}</span>
                  <strong>{percentage.toFixed(0)}<I18nText text={"%"} /></strong>
                  <small>{item.count} <I18nText text={"unidade"} /><I18nText text={item.count === 1 ? "" : "s"} /></small>
                </div>
              );
            })}
          </div>
        </div>
      ) : <div className="chart-empty"><I18nText text={"Sem dados para montar o grafico."} /></div>}
    </section>
  );
}
