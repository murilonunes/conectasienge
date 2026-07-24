import { I18nText } from "@/components/i18n/i18n-text";
import { formatCompactCurrency } from "@/lib/formatters";
import type { ChartItem } from "@/features/financeiro/sienge-data";

export function MonthlyVolumeChart({
  data,
  title = "Volume emitido por mês",
  note = "Valor bruto dos títulos carregados",
  countLabel = "título"
}: {
  data: ChartItem[];
  title?: string;
  note?: string;
  countLabel?: string;
}) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <section className="card panel chart-panel">
      <div className="panel-head">
        <div><h2 className="panel-title"><I18nText text={title} /></h2><span className="panel-note"><I18nText text={note} /></span></div>
      </div>
      {data.length ? (
        <div className="monthly-chart">
          {data.map((item) => {
            const countText = `${item.count} ${countLabel}${item.count === 1 ? "" : "s"}`;
            return (
              <div className="monthly-column" key={item.label} title={`${item.label}: ${formatCompactCurrency(item.value)} em ${countText}`}>
                <span>{formatCompactCurrency(item.value)}</span>
                <small>{countText}</small>
                <div className="monthly-track"><i style={{ height: `${Math.max(4, (item.value / max) * 100)}%` }} /></div>
                <strong>{item.label}</strong>
              </div>
            );
          })}
        </div>
      ) : <div className="chart-empty"><I18nText text={"Sem dados para montar o gráfico."} /></div>}
    </section>
  );
}
