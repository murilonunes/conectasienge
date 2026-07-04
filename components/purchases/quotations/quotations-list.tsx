import Link from "next/link";
import type { QuotationSummary } from "@/features/quotations/data";
import { LocalDataList } from "@/components/ui/local-data-list";
import { formatCurrency, formatOptionalDate } from "@/lib/formatters";
import { quotationCsvColumns, statusClass } from "./helpers";

type QuotationsListProps = {
  items: QuotationSummary[];
  resetKey: string;
};

export function QuotationsList({ items, resetKey }: QuotationsListProps) {
  return (
    <LocalDataList<QuotationSummary>
      items={items}
      itemLabel="cotações"
      defaultPageSize={12}
      pageSizeOptions={[12, 24, 48, 96]}
      resetKey={resetKey}
      emptyMessage="Nenhuma cotação encontrada para o filtro atual."
      csvExport={{
        fileName: "cotacoes.csv",
        buttonLabel: "Exportar cotações",
        columns: quotationCsvColumns
      }}
      renderItems={(pageItems) => (
        <section className="advanced-results quotation-results">
          {pageItems.map((quotation) => (
            <article className="card advanced-result quotation-result" key={quotation.id}>
              <div className="advanced-result-main quotation-result-main">
                <span className="quotation-code-cell">
                  <strong>#{quotation.code}</strong>
                  <small>{quotation.selectedSupplier || "Aberta"}</small>
                </span>
                <span>
                  <strong>{quotation.buyerId}</strong>
                  <small>{formatOptionalDate(quotation.date)} | {formatOptionalDate(quotation.deadline)}</small>
                </span>
                <span><strong>{quotation.itemCount}</strong><small>Insumos</small></span>
                <span><strong>{quotation.supplierCount}</strong><small>Forn.</small></span>
                <span><strong>{quotation.responseCount}</strong><small>Propostas</small></span>
                <span><strong>{formatCurrency(quotation.totalValue)}</strong><small>Total</small></span>
                <span className={`badge ${statusClass(quotation.status)}`}>{quotation.status}</span>
                <Link className="payable-review-button compact" href={`/cotacoes/${quotation.id}`}>Abrir</Link>
              </div>
            </article>
          ))}
        </section>
      )}
    />
  );
}
