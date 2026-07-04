import type { QuotationItemSummary } from "@/features/quotations/data";
import { formatCurrency } from "@/lib/formatters";
import { itemTotal } from "./helpers";
import type { ResponseItem } from "./types";

type ItemsStepProps = {
  items: QuotationItemSummary[];
  responseItems: ResponseItem[];
  onItemChange: (itemNumber: number, field: keyof ResponseItem, value: string | boolean) => void;
};

export function ItemsStep({ items, responseItems, onItemChange }: ItemsStepProps) {
  return (
    <section className="card supplier-portal-card">
      <div className="supplier-card-head">
        <span>Passo 2 de 5</span>
        <h2>Itens da cotação</h2>
      </div>
      <div className="supplier-quote-items">
        {items.map((item) => {
          const current = responseItems.find((row) => row.itemNumber === item.itemNumber);
          if (!current) return null;
          const total = itemTotal(current);
          const articleClassName = [
            current.attends ? "active" : "",
            current.attends && current.partial ? "partial" : ""
          ].filter(Boolean).join(" ");
          return (
            <article className={articleClassName} key={item.itemNumber}>
              <div className="supplier-item-top">
                <label className="supplier-item-check">
                  <input type="checkbox" checked={current.attends} onChange={(event) => onItemChange(item.itemNumber, "attends", event.target.checked)} />
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.quantity} {item.unit}{item.detail ? ` | ${item.detail}` : ""}</small>
                  </span>
                </label>
                <div className="supplier-item-side">
                  <label className="supplier-item-partial">
                    <input type="checkbox" disabled={!current.attends} checked={current.partial} onChange={(event) => onItemChange(item.itemNumber, "partial", event.target.checked)} />
                    <span>Parcial</span>
                  </label>
                  <strong className="supplier-item-total">{current.attends ? formatCurrency(total) : "Não atende"}</strong>
                </div>
              </div>
              <div className="supplier-item-values">
                <label><span>Valor unitário</span><input disabled={!current.attends} value={current.unitPrice} onChange={(event) => onItemChange(item.itemNumber, "unitPrice", event.target.value)} type="number" min="0" step="0.01" /></label>
                <label><span>Quantidade</span><input disabled={!current.attends || !current.partial} value={current.quantity} onChange={(event) => onItemChange(item.itemNumber, "quantity", event.target.value)} type="number" min="0" max={item.quantity} step="0.01" /></label>
                <label><span>Prazo diferente (dias)</span><input disabled={!current.attends} value={current.deadlineDays} onChange={(event) => onItemChange(item.itemNumber, "deadlineDays", event.target.value)} type="number" min="0" placeholder="Opcional" /></label>
                <label><span>Observação</span><input disabled={!current.attends} value={current.notes} onChange={(event) => onItemChange(item.itemNumber, "notes", event.target.value)} /></label>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
