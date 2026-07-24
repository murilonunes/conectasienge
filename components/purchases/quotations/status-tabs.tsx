import { I18nText } from "@/components/i18n/i18n-text";
import type { QuotationStatus } from "@/features/quotations/data";
import { statusNote, statusOrder } from "./helpers";

type QuotationsStatusTabsProps = {
  status: QuotationStatus | "Todas";
  statusCounts: Map<QuotationStatus, number>;
  filteredCount: number;
  onStatusChange: (status: QuotationStatus | "Todas") => void;
};

export function QuotationsStatusTabs({ status, statusCounts, filteredCount, onStatusChange }: QuotationsStatusTabsProps) {
  return (
    <div className="card filters quotation-quick-filters">
      <button className={status === "Todas" ? "active" : ""} type="button" onClick={() => onStatusChange("Todas")}><I18nText text={"Todas"} /></button>
      {statusOrder.map((item) => (
        <button className={status === item ? "active" : ""} key={item} type="button" onClick={() => onStatusChange(item)}>
          {statusNote(item)} <strong>{statusCounts.get(item) || 0}</strong>
        </button>
      ))}
      <span className="filter-result"><strong>{filteredCount}</strong><span><I18nText text={"cotações"} /></span></span>
    </div>
  );
}
