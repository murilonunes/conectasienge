import { I18nText } from "@/components/i18n/i18n-text";
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
                  <strong><I18nText text={"#"} />{quotation.code}</strong>
                  <small>{quotation.selectedSupplier || <I18nText text={"Aberta"} />}</small>
                </span>
                <span>
                  <strong>{quotation.buyerId}</strong>
                  <small>{formatOptionalDate(quotation.date)} <I18nText text={"|"} /> {formatOptionalDate(quotation.deadline)}</small>
                </span>
                <span><strong>{quotation.itemCount}</strong><small><I18nText text={"Insumos"} /></small></span>
                <span><strong>{quotation.supplierCount}</strong><small><I18nText text={"Forn."} /></small></span>
                <span><strong>{quotation.responseCount}</strong><small><I18nText text={"Propostas"} /></small></span>
                <span><strong>{formatCurrency(quotation.totalValue)}</strong><small><I18nText text={"Total"} /></small></span>
                <span className={`badge ${statusClass(quotation.status)}`}><I18nText text={quotation.status} /></span>
                <Link className="payable-review-button compact" href={`/cotacoes/${quotation.id}`}><I18nText text={"Abrir"} /></Link>
              </div>
            </article>
          ))}
        </section>
      )}
    />
  );
}
