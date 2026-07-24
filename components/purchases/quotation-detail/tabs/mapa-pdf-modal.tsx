"use client";

import { I18nText } from "@/components/i18n/i18n-text";
import { useMemo, useState } from "react";
import type { ItemComparisonRow } from "../types";

type Scope = "todos" | "selecionados" | "proposta";

export function MapaPdfModal({ quotationId, items }: { quotationId: number; items: ItemComparisonRow[] }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("todos");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const withProposalCount = useMemo(() => items.filter((row) => row.best).length, [items]);

  function toggleItem(itemNumber: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(itemNumber)) next.delete(itemNumber);
      else next.add(itemNumber);
      return next;
    });
  }

  function close() {
    setOpen(false);
  }

  function generate() {
    const params = new URLSearchParams();
    if (scope === "selecionados") {
      if (!selected.size) return;
      params.set("itens", Array.from(selected).join(","));
      params.set("escopo", "selecionados");
    } else if (scope === "proposta") {
      const numbers = items.filter((row) => row.best).map((row) => row.itemNumber);
      if (!numbers.length) return;
      params.set("itens", numbers.join(","));
      params.set("escopo", "proposta");
    }
    const query = params.toString();
    window.open(`/cotacoes/${quotationId}/mapa-pdf${query ? `?${query}` : ""}`, "_blank", "noopener,noreferrer");
    close();
  }

  const canGenerate = scope !== "selecionados" || selected.size > 0;

  return (
    <>
      <button className="button secondary" type="button" onClick={() => setOpen(true)}>
        <I18nText text={"Mapa em PDF"} />
      </button>

      {open && (
        <div className="settings-modal-backdrop" role="presentation">
          <div className="settings-modal map-pdf-modal" role="dialog" aria-modal="true" aria-labelledby="map-pdf-modal-title">
            <div className="settings-modal-head">
              <div>
                <h2 id="map-pdf-modal-title"><I18nText text={"Mapa comparativo em PDF"} /></h2>
                <span><I18nText text={"Gerado a partir das respostas recebidas no portal, sem depender do Sienge."} /></span>
              </div>
              <button type="button" onClick={close}><I18nText text={"Fechar"} /></button>
            </div>

            <div className="map-pdf-modal-scopes">
              <label className={`map-pdf-scope-option ${scope === "todos" ? "active" : ""}`}>
                <input type="radio" name="map-pdf-scope" checked={scope === "todos"} onChange={() => setScope("todos")} />
                <span>
                  <strong><I18nText text={"Todos os itens"} /></strong>
                  <small>{items.length} <I18nText text={items.length === 1 ? "item" : "itens"} /> <I18nText text={"no mapa"} /></small>
                </span>
              </label>
              <label className={`map-pdf-scope-option ${scope === "proposta" ? "active" : ""} ${!withProposalCount ? "disabled" : ""}`}>
                <input type="radio" name="map-pdf-scope" checked={scope === "proposta"} onChange={() => setScope("proposta")} disabled={!withProposalCount} />
                <span>
                  <strong><I18nText text={"Somente itens com proposta"} /></strong>
                  <small>{withProposalCount} <I18nText text={withProposalCount === 1 ? "item recebeu" : "itens receberam"} /> <I18nText text={"preço válido"} /></small>
                </span>
              </label>
              <label className={`map-pdf-scope-option ${scope === "selecionados" ? "active" : ""}`}>
                <input type="radio" name="map-pdf-scope" checked={scope === "selecionados"} onChange={() => setScope("selecionados")} />
                <span>
                  <strong><I18nText text={"Escolher os itens"} /></strong>
                  <small>{selected.size} <I18nText text={selected.size === 1 ? "selecionado" : "selecionados"} /></small>
                </span>
              </label>
            </div>

            {scope === "selecionados" && (
              <div className="map-pdf-modal-checklist">
                {items.map((row) => (
                  <label key={row.itemNumber} className="map-pdf-checklist-item">
                    <input type="checkbox" checked={selected.has(row.itemNumber)} onChange={() => toggleItem(row.itemNumber)} />
                    <span>{row.item?.name || `Item ${row.itemNumber}`}</span>
                    {!row.best && <small><I18nText text={"Sem preço"} /></small>}
                  </label>
                ))}
              </div>
            )}

            <div className="settings-modal-footer">
              <span><I18nText text={"O PDF abre em uma nova aba; use \"Imprimir / salvar PDF\" para exportar."} /></span>
              <button className="button" type="button" onClick={generate} disabled={!canGenerate}>
                <I18nText text={"Gerar PDF"} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
