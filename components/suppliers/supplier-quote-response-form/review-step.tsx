import type { QuotationItemSummary } from "@/features/quotations/data";
import { formatCurrency } from "@/lib/formatters";
import { cashSummaryText, formatDocument, freightSummaryText, itemTotal, termSummaryText } from "./helpers";
import type { FreightType, InstallmentRow, ResponseItem, WizardStep } from "./types";

type ReviewStepProps = {
  document: string;
  supplierName: string;
  email: string;
  phone: string;
  items: QuotationItemSummary[];
  responseItems: ResponseItem[];
  quotedCount: number;
  offersCash: boolean;
  offersTerm: boolean;
  cashDiscountPercentage: string;
  cashPrice: number;
  installments: InstallmentRow[];
  freightType: FreightType;
  freightPrice: string;
  deliveryDays: string;
  generalNotes: string;
  onEditStep: (step: WizardStep) => void;
};

export function ReviewStep({
  document,
  supplierName,
  email,
  phone,
  items,
  responseItems,
  quotedCount,
  offersCash,
  offersTerm,
  cashDiscountPercentage,
  cashPrice,
  installments,
  freightType,
  freightPrice,
  deliveryDays,
  generalNotes,
  onEditStep
}: ReviewStepProps) {
  return (
    <section className="card supplier-portal-card">
      <div className="supplier-card-head">
        <span>Passo 5 de 5</span>
        <h2>Confira antes de enviar</h2>
      </div>

      <div className="supplier-review-section">
        <div className="supplier-review-section-head">
          <h3>Identificação</h3>
          <button type="button" className="supplier-review-edit" onClick={() => onEditStep(1)}>Editar</button>
        </div>
        <div className="supplier-review-grid">
          <span><strong>CPF/CNPJ</strong>{document ? formatDocument(document) : "Não informado"}</span>
          <span><strong>Razão social / Nome</strong>{supplierName || "Não informado"}</span>
          <span><strong>E-mail</strong>{email || "Não informado"}</span>
          <span><strong>Telefone</strong>{phone || "Não informado"}</span>
        </div>
      </div>

      <div className="supplier-review-section">
        <div className="supplier-review-section-head">
          <h3>Itens da cotação</h3>
          <button type="button" className="supplier-review-edit" onClick={() => onEditStep(2)}>Editar</button>
        </div>
        {quotedCount ? (
          <div className="supplier-review-items">
            <div className="supplier-review-items-row supplier-review-items-head">
              <span>Insumo</span><span>Valor unit.</span><span>Qtd.</span><span>Prazo dif.</span><span>Total</span>
            </div>
            {responseItems.filter((item) => item.attends).map((item) => {
              const original = items.find((current) => current.itemNumber === item.itemNumber);
              return (
                <div className="supplier-review-items-row" key={item.itemNumber}>
                  <span>{original?.name || `Item ${item.itemNumber}`}</span>
                  <span>{formatCurrency(Number(item.unitPrice || 0))}</span>
                  <span>{item.quantity} {original?.unit || ""}</span>
                  <span>{item.deadlineDays ? `${item.deadlineDays}d` : "-"}</span>
                  <strong>{formatCurrency(itemTotal(item))}</strong>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="table-muted">Nenhum item marcado.</p>
        )}
      </div>

      <div className="supplier-review-section">
        <div className="supplier-review-section-head">
          <h3>Pagamento</h3>
          <button type="button" className="supplier-review-edit" onClick={() => onEditStep(3)}>Editar</button>
        </div>
        <div className="supplier-review-grid">
          {offersCash && <span><strong>À vista</strong>{cashSummaryText(cashDiscountPercentage)} - {formatCurrency(cashPrice)}</span>}
          {offersTerm && <span><strong>A prazo</strong>{termSummaryText(installments)}</span>}
          {!offersCash && !offersTerm && <span><strong>Pagamento</strong>Nenhuma forma marcada</span>}
        </div>
      </div>

      <div className="supplier-review-section">
        <div className="supplier-review-section-head">
          <h3>Frete e observações</h3>
          <button type="button" className="supplier-review-edit" onClick={() => onEditStep(4)}>Editar</button>
        </div>
        <div className="supplier-review-grid">
          <span><strong>Frete e entrega</strong>{freightSummaryText(freightType, freightPrice, deliveryDays)}</span>
        </div>
        {generalNotes && <p className="quotation-response-notes">{generalNotes}</p>}
      </div>
    </section>
  );
}
