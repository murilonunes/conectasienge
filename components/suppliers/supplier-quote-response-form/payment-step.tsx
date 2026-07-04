import { formatCurrency } from "@/lib/formatters";
import type { InstallmentRow } from "./types";

type PaymentStepProps = {
  offersCash: boolean;
  offersTerm: boolean;
  cashDiscountPercentage: string;
  cashPrice: number;
  installments: InstallmentRow[];
  installmentsTotalPercentage: number;
  installmentsTotalValid: boolean;
  onOffersCashChange: (value: boolean) => void;
  onOffersTermChange: (value: boolean) => void;
  onCashDiscountPercentageChange: (value: string) => void;
  onInstallmentChange: (index: number, field: keyof InstallmentRow, value: string) => void;
  onAddInstallment: () => void;
  onRemoveInstallment: (index: number) => void;
};

export function PaymentStep({
  offersCash,
  offersTerm,
  cashDiscountPercentage,
  cashPrice,
  installments,
  installmentsTotalPercentage,
  installmentsTotalValid,
  onOffersCashChange,
  onOffersTermChange,
  onCashDiscountPercentageChange,
  onInstallmentChange,
  onAddInstallment,
  onRemoveInstallment
}: PaymentStepProps) {
  return (
    <section className="card supplier-portal-card">
      <div className="supplier-card-head">
        <span>Passo 3 de 5</span>
        <h2>Formas de pagamento</h2>
        <p className="supplier-card-note">Marque as formas que você aceita. Pode ser à vista, a prazo ou as duas.</p>
      </div>

      <div className={`supplier-payment-option ${offersCash ? "enabled" : ""}`}>
        <label className="supplier-payment-option-head">
          <input type="checkbox" checked={offersCash} onChange={(event) => onOffersCashChange(event.target.checked)} />
          <span>
            <strong>À vista</strong>
            <small>Pagamento na entrega ou contra apresentação</small>
          </span>
        </label>
        {offersCash && (
          <div className="supplier-portal-grid">
            <label>
              <span>Desconto à vista (%)</span>
              <input value={cashDiscountPercentage} onChange={(event) => onCashDiscountPercentageChange(event.target.value)} type="number" min="0" max="100" step="0.1" placeholder="0" />
            </label>
            <div className="supplier-payment-preview">
              <span>Preço à vista</span>
              <strong>{formatCurrency(cashPrice)}</strong>
            </div>
          </div>
        )}
      </div>

      <div className={`supplier-payment-option ${offersTerm ? "enabled" : ""}`}>
        <label className="supplier-payment-option-head">
          <input type="checkbox" checked={offersTerm} onChange={(event) => onOffersTermChange(event.target.checked)} />
          <span>
            <strong>A prazo</strong>
            <small>Parcelado - informe os dias e o percentual de cada parcela</small>
          </span>
        </label>
        {offersTerm && (
          <div className="supplier-installments">
            {installments.map((installment, index) => (
              <div className="supplier-installment-row" key={index}>
                <label>
                  <span>Dias</span>
                  <input value={installment.days} onChange={(event) => onInstallmentChange(index, "days", event.target.value)} type="number" min="0" placeholder="30" />
                </label>
                <label>
                  <span>% do valor</span>
                  <input value={installment.percentage} onChange={(event) => onInstallmentChange(index, "percentage", event.target.value)} type="number" min="0" max="100" step="0.1" placeholder="100" />
                </label>
                {installments.length > 1 && (
                  <button type="button" className="supplier-installment-remove" onClick={() => onRemoveInstallment(index)}>Remover</button>
                )}
              </div>
            ))}
            <div className="supplier-installment-actions">
              <button type="button" className="button secondary" onClick={onAddInstallment}>Adicionar parcela</button>
              <span className={installmentsTotalValid ? "done" : "warn"}>Total: {installmentsTotalPercentage}%{!installmentsTotalValid ? " (deve somar 100%)" : ""}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
