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
  return (
    <form className="card quotation-toolbar" onSubmit={(event) => event.preventDefault()}>
      <div className="advanced-filter-grid quotation-filter-grid">
        <label>
          <span>Status</span>
          <select value={status} onChange={(event) => onStatusChange(event.target.value as QuotationStatus | "Todas")}>
            <option>Todas</option>
            {statusOrder.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Comprador</span>
          <input value={buyer} onChange={(event) => onBuyerChange(event.target.value)} placeholder="Todos" />
        </label>
        <label className="quotation-search-field">
          <span>Pesquisar</span>
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Cotação, fornecedor, insumo ou observação" />
        </label>
        <label>
          <span>Origem</span>
          <input value={data.request?.code || "Todas as cotações"} readOnly />
        </label>
        <button className="button secondary quotation-clear-button" type="button" onClick={onClear}>
          Limpar
        </button>
      </div>
    </form>
  );
}
