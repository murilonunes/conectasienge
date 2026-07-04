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
      <article className="card stat quotation-stat"><span>Cotações</span><strong>{filteredCount}</strong></article>
      <article className="card stat quotation-stat"><span>Abertas</span><strong>{open}</strong></article>
      <article className="card stat quotation-stat"><span>Decisão</span><strong>{decision}</strong></article>
      <article className="card stat quotation-stat"><span>Total</span><strong>{formatCompactCurrency(total)}</strong></article>
    </div>
  );
}
