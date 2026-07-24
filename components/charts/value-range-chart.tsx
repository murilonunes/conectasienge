import { I18nText } from "@/components/i18n/i18n-text";
import type { ChartItem } from "@/features/financeiro/sienge-data";

export function ValueRangeChart({ data }: { data: ChartItem[] }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const colors = ["#2a785b", "#4d9879", "#77b096", "#d6a04e", "#c46655"];
  let current = 0;
  const stops = data.map((item, index) => {
    const start = total ? (current / total) * 100 : 0;
    current += item.count;
    const end = total ? (current / total) * 100 : 0;
    return `${colors[index]} ${start}% ${end}%`;
  }).join(", ");

  return (
    <section className="card panel dashboard-chart">
      <div className="panel-head"><div><h2 className="panel-title"><I18nText text={"Distribuição por faixa de valor"} /></h2><span className="panel-note"><I18nText text={"Quantidade de títulos por porte"} /></span></div></div>
      <div className="range-layout">
        <div className="range-donut" style={{ background: `conic-gradient(${stops || "#edf1ee 0 100%"})` }}><div><strong>{total}</strong><span><I18nText text={"títulos"} /></span></div></div>
        <div className="range-legend">{data.map((item, index) => <div key={item.label}><i style={{ background: colors[index] }} /><span>{item.label}</span><strong>{item.count}</strong></div>)}</div>
      </div>
    </section>
  );
}
