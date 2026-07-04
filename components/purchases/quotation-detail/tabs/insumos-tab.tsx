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
        <div className="card"><strong>{quotation.items.length}</strong><span>Itens</span></div>
        <div className="card"><strong>{totalQuantity}</strong><span>Qtd. total</span></div>
        <div className="card"><strong>{units.size}</strong><span>Unidades</span></div>
        <div className="card"><strong>{quotation.items.filter((item) => item.notes).length}</strong><span>Com observação</span></div>
      </section>

      <section className="card table-card quotation-detail-table">
        <div className="panel-head table-head">
          <div>
            <h2 className="panel-title">Insumos da cotação</h2>
            <span className="panel-note">Itens solicitados nesta cotação</span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Insumo</th>
              <th>Detalhe</th>
              <th>Quantidade</th>
              <th>Unidade</th>
              <th>Observação</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {quotation.items.map((item) => (
              <tr key={item.itemNumber}>
                <td><strong>{item.name}</strong><br /><span className="table-muted">#{item.productId || item.itemNumber}</span></td>
                <td>{item.detail || "Sem detalhe"}</td>
                <td>{item.quantity}</td>
                <td>{item.unit}</td>
                <td>{item.notes || "Sem observação"}</td>
                <td>
                  <button className="payable-review-button compact" type="button" onClick={() => onUseItem("sienge", item.itemNumber)}>
                    Usar no Sienge
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!quotation.items.length && <div className="empty-state">Nenhum insumo retornado para esta cotação.</div>}
      </section>
    </>
  );
}
