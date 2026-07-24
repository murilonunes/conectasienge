import { I18nText } from "@/components/i18n/i18n-text";
import { formatCompactCurrency } from "@/lib/formatters";

export type CashFlowChartItem = {
  label: string;
  income: number;
  outcome: number;
};

const fallbackData: CashFlowChartItem[] = [
  { label: "Jan", income: 56, outcome: 38 },
  { label: "Fev", income: 68, outcome: 46 },
  { label: "Mar", income: 48, outcome: 61 },
  { label: "Abr", income: 74, outcome: 52 },
  { label: "Mai", income: 82, outcome: 59 },
  { label: "Jun", income: 64, outcome: 44 },
  { label: "Jul", income: 88, outcome: 63 },
  { label: "Ago", income: 72, outcome: 49 }
];

export function CashFlowChart({
  data = fallbackData,
  title = "Fluxo de caixa",
  note = "Entradas e saídas consolidadas"
}: {
  data?: CashFlowChartItem[];
  title?: string;
  note?: string;
}) {
  const max = Math.max(...data.flatMap((item) => [item.income, item.outcome]), 1);
  const barHeight = (value: number) => value > 0 ? `${Math.max(4, (value / max) * 100)}%` : "0%";

  return (
    <section className="card panel">
      <div className="panel-head">
        <div><h2 className="panel-title"><I18nText text={title} /></h2><span className="panel-note"><I18nText text={note} /></span></div>
        <div className="chart-legend"><span><i className="dot" /><I18nText text={"Entradas"} /></span><span><i className="dot out" /><I18nText text={"Saídas"} /></span></div>
      </div>
      {data.length ? (
        <div className="chart">
          {data.map((item) => (
            <div className="chart-group" key={item.label} title={`${item.label}: ${formatCompactCurrency(item.income)} entrando e ${formatCompactCurrency(item.outcome)} saindo`}>
              <i className="bar" style={{ height: barHeight(item.income) }} />
              <i className="bar out" style={{ height: barHeight(item.outcome) }} />
              <span className="chart-label">{item.label}</span>
            </div>
          ))}
        </div>
      ) : <div className="chart-empty"><I18nText text={"Sem dados para montar o gráfico."} /></div>}
    </section>
  );
}
