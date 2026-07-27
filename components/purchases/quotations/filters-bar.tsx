import { I18nText } from "@/components/i18n/i18n-text";
import { useI18n } from "@/components/i18n/i18n-provider";
import type { QuotationPortalData, QuotationStatus } from "@/features/quotations/data";
import { statusOrder } from "./helpers";

type QuotationsFiltersBarProps = {
  data: QuotationPortalData;
  status: QuotationStatus | "Todas";
  buyer: string;
  search: string;
  onStatusChange: (status: QuotationStatus | "Todas") => void;
  onBuyerChange: (buyer: string) => void;
  onSearchChange: (search: string) => void;
  onClear: () => void;
};

export function QuotationsFiltersBar({
  data,
  status,
  buyer,
  search,
  onStatusChange,
  onBuyerChange,
  onSearchChange,
  onClear
}: QuotationsFiltersBarProps) {
  const { t } = useI18n();

  return (
    <form className="card quotation-toolbar" onSubmit={(event) => event.preventDefault()}>
      <div className="advanced-filter-grid quotation-filter-grid">
        <label>
          <span><I18nText text={"Status"} /></span>
          <select value={status} onChange={(event) => onStatusChange(event.target.value as QuotationStatus | "Todas")}>
            <option value="Todas"><I18nText text={"Todas"} /></option>
            {statusOrder.map((item) => <option key={item} value={item}><I18nText text={item} /></option>)}
          </select>
        </label>
        <label>
          <span><I18nText text={"Comprador"} /></span>
          <input value={buyer} onChange={(event) => onBuyerChange(event.target.value)} placeholder="Todos" data-i18n-placeholder={"Todos"} />
        </label>
        <label className="quotation-search-field">
          <span><I18nText text={"Pesquisar"} /></span>
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Cotação, fornecedor, insumo ou observação" data-i18n-placeholder={"Cotação, fornecedor, insumo ou observação"} />
        </label>
        <label>
          <span><I18nText text={"Origem"} /></span>
          <input value={data.request?.code || t("Todas as cotações")} readOnly />
        </label>
        <button className="button secondary quotation-clear-button" type="button" onClick={onClear}>
          <I18nText text={"Limpar"} />
        </button>
      </div>
    </form>
  );
}
