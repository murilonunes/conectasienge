import { FileDown } from "lucide-react";
import Link from "next/link";
import { I18nText } from "@/components/i18n/i18n-text";
import type { QuotationSummary } from "@/features/quotations/data";
import type { DetailTab } from "../types";

export function InsumosTab({
  quotation,
  onUseItem
}: {
  quotation: QuotationSummary;
  onUseItem: (tab: DetailTab, itemNumber: number) => void;
}) {
  const units = new Set(quotation.items.map((item) => item.unit).filter(Boolean));
  const totalQuantity = quotation.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      <section className="quotation-detail-stats">
        <div className="card"><strong>{quotation.items.length}</strong><span><I18nText text={"Itens"} /></span></div>
        <div className="card"><strong>{totalQuantity}</strong><span><I18nText text={"Qtd. total"} /></span></div>
        <div className="card"><strong>{units.size}</strong><span><I18nText text={"Unidades"} /></span></div>
        <div className="card"><strong>{quotation.items.filter((item) => item.notes).length}</strong><span><I18nText text={"Com observação"} /></span></div>
      </section>

      <section className="card table-card quotation-detail-table">
        <div className="panel-head table-head">
          <div>
            <h2 className="panel-title"><I18nText text={"Insumos da cotação"} /></h2>
            <span className="panel-note"><I18nText text={"Itens solicitados nesta cotação"} /></span>
          </div>
          <Link
            className="button secondary"
            href={`/cotacoes/${quotation.id}/solicitacao-fornecedor`}
            rel="noopener noreferrer"
            target="_blank"
          >
            <FileDown aria-hidden="true" size={15} />
            <I18nText text="PDF para fornecedor" />
          </Link>
        </div>
        <table>
          <thead>
            <tr>
              <th><I18nText text={"Insumo"} /></th>
              <th><I18nText text={"Detalhe"} /></th>
              <th><I18nText text={"Quantidade"} /></th>
              <th><I18nText text={"Unidade"} /></th>
              <th><I18nText text={"Observação"} /></th>
              <th><I18nText text={"Ação"} /></th>
            </tr>
          </thead>
          <tbody>
            {quotation.items.map((item) => (
              <tr key={item.itemNumber}>
                <td><strong>{item.name}</strong><br /><span className="table-muted"><I18nText text={"#"} />{item.productId || item.itemNumber}</span></td>
                <td>{item.detail || <I18nText text={"Sem detalhe"} />}</td>
                <td>{item.quantity}</td>
                <td>{item.unit}</td>
                <td>{item.notes || <I18nText text={"Sem observação"} />}</td>
                <td>
                  <button className="payable-review-button compact" type="button" onClick={() => onUseItem("sienge", item.itemNumber)}>
                    <I18nText text={"Usar no Sienge"} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!quotation.items.length && <div className="empty-state"><I18nText text={"Nenhum insumo retornado para esta cotação."} /></div>}
      </section>
    </>
  );
}
