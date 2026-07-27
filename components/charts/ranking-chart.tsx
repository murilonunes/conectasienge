import { I18nText } from "@/components/i18n/i18n-text";
import type { ChartItem } from "@/features/financeiro/sienge-data";
import { formatCompactCurrency } from "@/lib/formatters";

type RankingChartProps = {
  title: string;
  note: string;
  data: ChartItem[];
  valueKind?: "currency" | "count" | "percent";
  countLabel?: string;
};

export function RankingChart({ title, note, data, valueKind = "currency", countLabel }: RankingChartProps) {
  const max = Math.max(...data.map((item) => item.value), 1);
  const formatValue = (value: number) => {
    if (valueKind === "count") return String(value);
    if (valueKind === "percent") return `${value.toFixed(1).replace(".", ",")}%`;
    return formatCompactCurrency(value);
  };
  const noun = countLabel || (valueKind === "count" ? "registro" : "título");

  return (
    <section className="card panel">
      <div className="panel-head"><div><h2 className="panel-title"><I18nText text={title} /></h2><span className="panel-note"><I18nText text={note} /></span></div></div>
      {data.length ? <div className="ranking-list">
        {data.map((item) => (
          <div className="ranking-row" key={item.label}>
            <div><span>{item.label}</span><strong><I18nText text={formatValue(item.value)} /></strong></div>
            <div className="ranking-track"><i style={{ width: `${(item.value / max) * 100}%` }} /></div>
            <small><I18nText text={`${item.count} ${noun}${item.count === 1 ? "" : "s"}`} /></small>
          </div>
        ))}
      </div> : <div className="chart-empty"><I18nText text={"Sem dados para montar o ranking."} /></div>}
    </section>
  );
}
