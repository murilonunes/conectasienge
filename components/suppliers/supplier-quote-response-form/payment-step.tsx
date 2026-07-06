import { useMemo, useState } from "react";
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
  onInstallmentsReplace: (installments: InstallmentRow[]) => void;
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
  onInstallmentsReplace,
  onAddInstallment,
  onRemoveInstallment
}: PaymentStepProps) {
  const [installmentCount, setInstallmentCount] = useState("3");
  const [firstDueDays, setFirstDueDays] = useState("30");
  const [intervalMode, setIntervalMode] = useState<"monthly" | "days">("monthly");
  const [intervalDays, setIntervalDays] = useState("30");
  const [distribution, setDistribution] = useState<"equal" | "entry">("equal");
  const [entryPercentage, setEntryPercentage] = useState("20");

  function boundedNumber(value: string, fallback: number, min: number, max: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  function formatPercentage(value: number) {
    return String(Math.round(value * 100) / 100);
  }

  function buildInstallmentPlan() {
    const count = Math.round(boundedNumber(installmentCount, 1, 1, 24));
    const firstDays = Math.round(boundedNumber(firstDueDays, 0, 0, 3650));
    const spacing = intervalMode === "monthly" ? 30 : Math.round(boundedNumber(intervalDays, 30, 1, 3650));
    const entry = distribution === "entry" && count > 1 ? boundedNumber(entryPercentage, 0, 0.01, 99.99) : 0;
    const remainingCount = distribution === "entry" && count > 1 ? count - 1 : count;
    const regularPercentage = (100 - entry) / remainingCount;
    let accumulated = 0;

    return Array.from({ length: count }, (_, index) => {
      const isEntry = distribution === "entry" && count > 1 && index === 0;
      const rawPercentage = isEntry ? entry : regularPercentage;
      const percentage = index === count - 1 ? Math.max(0, 100 - accumulated) : Math.round(rawPercentage * 100) / 100;
      accumulated = Math.round((accumulated + percentage) * 100) / 100;
      return {
        days: String(firstDays + index * spacing),
        percentage: formatPercentage(percentage)
      };
    });
  }

  const generatedPreview = useMemo(buildInstallmentPlan, [
    distribution,
    entryPercentage,
    firstDueDays,
    installmentCount,
    intervalDays,
    intervalMode
  ]);

  function applyInstallmentPlan() {
    onInstallmentsReplace(generatedPreview);
  }

  return (
    <section className="card supplier-portal-card">
      <div className="supplier-card-head">
        <span>Passo 3 de 5</span>
        <h2>Formas de pagamento</h2>
        <p className="supplier-card-note">Marque as formas que você aceita. Pode ser à vista, a prazo ou as duas.</p>
      </div>

      <div className="supplier-payment-options">
        <div className={`supplier-payment-option ${offersCash ? "enabled" : ""}`}>
          <label className="supplier-payment-option-head">
            <input type="checkbox" checked={offersCash} onChange={(event) => onOffersCashChange(event.target.checked)} />
            <span>
              <strong>À vista</strong>
              <small>Pagamento na entrega ou contra apresentação</small>
            </span>
          </label>
          {offersCash && (
            <div className="supplier-payment-fields">
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
              <div className="supplier-installment-helper">
                <div className="supplier-helper-head">
                  <div>
                    <strong>Gerar parcelas automaticamente</strong>
                    <span>Use este bloco para montar a condição por quantidade, intervalo e percentual.</span>
                  </div>
                  <button type="button" className="button secondary" onClick={applyInstallmentPlan}>Aplicar geração automática</button>
                </div>

                <div className="supplier-installment-builder">
                  <label>
                    <span>Parcelas</span>
                    <input value={installmentCount} onChange={(event) => setInstallmentCount(event.target.value)} type="number" min="1" max="24" />
                  </label>
                  <label>
                    <span>{distribution === "entry" ? "Entrada em dias" : "1a parcela em dias"}</span>
                    <input value={firstDueDays} onChange={(event) => setFirstDueDays(event.target.value)} type="number" min="0" max="3650" />
                  </label>
                  <label>
                    <span>Intervalo</span>
                    <select value={intervalMode} onChange={(event) => setIntervalMode(event.target.value as "monthly" | "days")}>
                      <option value="monthly">1 vez por mes</option>
                      <option value="days">Intervalo em dias</option>
                    </select>
                  </label>
                  {intervalMode === "days" && (
                    <label>
                      <span>Dias entre parcelas</span>
                      <input value={intervalDays} onChange={(event) => setIntervalDays(event.target.value)} type="number" min="1" max="3650" />
                    </label>
                  )}
                  <label>
                    <span>Percentual</span>
                    <select value={distribution} onChange={(event) => setDistribution(event.target.value as "equal" | "entry")}>
                      <option value="equal">Fixo igual</option>
                      <option value="entry">Entrada diferenciada</option>
                    </select>
                  </label>
                  {distribution === "entry" && (
                    <label>
                      <span>% entrada</span>
                      <input value={entryPercentage} onChange={(event) => setEntryPercentage(event.target.value)} type="number" min="0.01" max="99.99" step="0.1" />
                    </label>
                  )}
                </div>

                <div className="supplier-installment-preview">
                  {generatedPreview.map((installment, index) => (
                    <span key={`${installment.days}-${index}`}>
                      <strong>{installment.percentage}%</strong>
                      {installment.days} dia(s)
                    </span>
                  ))}
                </div>
              </div>

              <div className="supplier-manual-installments">
                <strong>Preencher ou ajustar manualmente</strong>
                <span>Confira os dias e percentuais. Se precisar, altere uma parcela ou adicione outra linha.</span>
              </div>

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
      </div>
    </section>
  );
}
