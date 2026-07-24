import { I18nText } from "@/components/i18n/i18n-text";
import { formatCompactCurrency } from "@/lib/formatters";

type QuotationsSummaryStatsProps = {
  filteredCount: number;
  open: number;
  decision: number;
  total: number;
};

export function QuotationsSummaryStats({ filteredCount, open, decision, total }: QuotationsSummaryStatsProps) {
  return (
    <div className="stats advanced-stats quotation-stats">
      <article className="card stat quotation-stat"><span><I18nText text={"Cotações"} /></span><strong>{filteredCount}</strong></article>
      <article className="card stat quotation-stat"><span><I18nText text={"Abertas"} /></span><strong>{open}</strong></article>
      <article className="card stat quotation-stat"><span><I18nText text={"Decisão"} /></span><strong>{decision}</strong></article>
      <article className="card stat quotation-stat"><span><I18nText text={"Total"} /></span><strong>{formatCompactCurrency(total)}</strong></article>
    </div>
  );
}
