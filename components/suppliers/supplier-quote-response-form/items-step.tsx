import { I18nText } from "@/components/i18n/i18n-text";
import type { QuotationItemSummary } from "@/features/quotations/data";
import { formatCurrency } from "@/lib/formatters";
import { itemTotal } from "./helpers";
import type { ResponseItem } from "./types";

type ItemsStepProps = {
  items: QuotationItemSummary[];
  responseItems: ResponseItem[];
  showValidation?: boolean;
  onItemChange: (itemNumber: number, field: keyof ResponseItem, value: string | boolean) => void;
};

export function ItemsStep({ items, responseItems, showValidation = false, onItemChange }: ItemsStepProps) {
  const quotedCount = responseItems.filter((item) => item.attends).length;

  return (
    <section className={`card supplier-portal-card ${showValidation && quotedCount === 0 ? "supplier-section-invalid" : ""}`}>
      <div className="supplier-card-head">
        <span><I18nText text={"Passo 2 de 5"} /></span>
        <h2><I18nText text={"Itens da cotação"} /></h2>
        <p className="supplier-card-note"><I18nText text={"Marque os itens que sua empresa consegue cotar. Use atendimento parcial apenas quando a quantidade for menor que a solicitada."} /></p>
      </div>
      <div className="supplier-quote-items">
        {items.map((item) => {
          const current = responseItems.find((row) => row.itemNumber === item.itemNumber);
          if (!current) return null;
          const total = itemTotal(current);
          const requestedQuantity = Number(item.quantity || 0);
          const quantity = Number(current.quantity);
          const unitPrice = Number(current.unitPrice);
          const unitPriceInvalid = current.attends && (!Number.isFinite(unitPrice) || unitPrice <= 0);
          const quantityInvalid = current.attends && (
            !Number.isFinite(quantity)
            || !Number.isFinite(requestedQuantity)
            || quantity <= 0
            || requestedQuantity <= 0
            || quantity > requestedQuantity
            || (current.partial ? quantity >= requestedQuantity : quantity !== requestedQuantity)
          );
          const articleClassName = [
            current.attends ? "active" : "",
            current.attends && current.partial ? "partial" : "",
            showValidation && (unitPriceInvalid || quantityInvalid) ? "invalid" : ""
          ].filter(Boolean).join(" ");
          return (
            <article className={articleClassName} key={item.itemNumber}>
              <div className="supplier-item-top">
                <label className="supplier-item-check">
                  <input type="checkbox" checked={current.attends} onChange={(event) => onItemChange(item.itemNumber, "attends", event.target.checked)} />
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.quantity} {item.unit}{item.detail ? ` | ${item.detail}` : <I18nText text={""} />}</small>
                  </span>
                </label>
                <div className="supplier-item-side">
                  <label className="supplier-item-partial">
                    <input type="checkbox" disabled={!current.attends} checked={current.partial} onChange={(event) => onItemChange(item.itemNumber, "partial", event.target.checked)} />
                    <span><I18nText text={"Atendimento parcial"} /></span>
                  </label>
                  <strong className="supplier-item-total">{current.attends ? formatCurrency(total) : <I18nText text={"Não cotado"} />}</strong>
                </div>
              </div>
              {item.notes && (
                <div className="supplier-item-buyer-note" role="note">
                  <span><I18nText text="Observação do comprador" /></span>
                  <strong>{item.notes}</strong>
                </div>
              )}
              <div className="supplier-item-values">
                <label className={showValidation && unitPriceInvalid ? "supplier-field-invalid" : ""}><span><I18nText text={"Valor unitário *"} /></span><input disabled={!current.attends} value={current.unitPrice} onChange={(event) => onItemChange(item.itemNumber, "unitPrice", event.target.value)} type="number" min="0" step="0.01" /></label>
                <label className={showValidation && quantityInvalid ? "supplier-field-invalid" : ""}><span><I18nText text={"Quantidade cotada *"} /></span><input disabled={!current.attends || !current.partial} value={current.quantity} onChange={(event) => onItemChange(item.itemNumber, "quantity", event.target.value)} type="number" min="0" max={item.quantity} step="0.01" /></label>
                <label><span><I18nText text={"Prazo diferente do pedido (dias)"} /></span><input disabled={!current.attends} value={current.deadlineDays} onChange={(event) => onItemChange(item.itemNumber, "deadlineDays", event.target.value)} type="number" min="0" placeholder="Opcional" data-i18n-placeholder={"Opcional"} /></label>
                <label><span><I18nText text={"Sua observação (opcional)"} /></span><input disabled={!current.attends} value={current.notes} onChange={(event) => onItemChange(item.itemNumber, "notes", event.target.value)} /></label>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
