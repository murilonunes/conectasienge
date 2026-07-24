"use client";

import { I18nText } from "@/components/i18n/i18n-text";
import { useState } from "react";
import type { PurchaseRequestForQuotation } from "@/features/quotations/data";

export function ItemSelectionModal({
  request,
  selected,
  onChange
}: {
  request: PurchaseRequestForQuotation;
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
}) {
  const [open, setOpen] = useState(false);

  function toggle(itemNumber: number) {
    const next = new Set(selected);
    if (next.has(itemNumber)) next.delete(itemNumber);
    else next.add(itemNumber);
    onChange(next);
  }

  return (
    <>
      <button className="button secondary" type="button" onClick={() => setOpen(true)}>
        <I18nText text={"Escolher itens ("} />{selected.size} <I18nText text={"de"} /> {request.items.length}<I18nText text={")"} />
      </button>

      {open && (
        <div className="settings-modal-backdrop" role="presentation">
          <div className="settings-modal quotation-item-select-modal" role="dialog" aria-modal="true" aria-labelledby="item-select-modal-title">
            <div className="settings-modal-head">
              <div>
                <h2 id="item-select-modal-title"><I18nText text={"Escolher itens da"} /> {request.code}</h2>
                <span><I18nText text={"Marque só os insumos que devem entrar nesta cotação. Dá para criar outra cotação depois com o restante."} /></span>
              </div>
              <button type="button" onClick={() => setOpen(false)}><I18nText text={"Fechar"} /></button>
            </div>

            <div className="settings-modal-actions">
              <button className="button secondary" type="button" onClick={() => onChange(new Set(request.items.map((item) => item.itemNumber)))}>
                <I18nText text={"Marcar todos"} />
              </button>
              <button className="button secondary" type="button" onClick={() => onChange(new Set())}>
                <I18nText text={"Desmarcar todos"} />
              </button>
            </div>

            <div className="map-pdf-modal-checklist">
              {request.items.map((item) => (
                <label key={item.itemNumber} className="map-pdf-checklist-item">
                  <input type="checkbox" checked={selected.has(item.itemNumber)} onChange={() => toggle(item.itemNumber)} />
                  <span><I18nText text={"#"} />{item.itemNumber} {item.name}{item.detail ? ` - ${item.detail}` : <I18nText text={""} />}</span>
                  <small>{item.quantity} {item.unit}</small>
                </label>
              ))}
            </div>

            <div className="settings-modal-footer">
              <span>{selected.size} <I18nText text={"de"} /> {request.items.length} <I18nText text={"itens selecionados."} /></span>
              <button className="button" type="button" onClick={() => setOpen(false)}><I18nText text={"Aplicar seleção"} /></button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
