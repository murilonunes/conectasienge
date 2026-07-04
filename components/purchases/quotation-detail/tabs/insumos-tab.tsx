import type { QuotationSummary } from "@/features/quotations/data";
import type { DetailTab } from "../types";

export function InsumosTab({
  quotation,
  onUseItem
}: {
  quotation: QuotationSummary;
  onUseItem: (tab: DetailTab, itemNumber: number) => void;
}) {
  return (
    <section className="card table-card quotation-detail-table">
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
                  Usar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!quotation.items.length && <div className="empty-state">Nenhum insumo retornado para esta cotação.</div>}
    </section>
  );
}
