import { I18nText } from "@/components/i18n/i18n-text";
import type { FreightType } from "./types";

type FreightStepProps = {
  freightType: FreightType;
  freightPrice: string;
  deliveryDays: string;
  generalNotes: string;
  showValidation?: boolean;
  onFreightTypeChange: (value: FreightType) => void;
  onFreightPriceChange: (value: string) => void;
  onDeliveryDaysChange: (value: string) => void;
  onGeneralNotesChange: (value: string) => void;
};

export function FreightStep({
  freightType,
  freightPrice,
  deliveryDays,
  generalNotes,
  showValidation = false,
  onFreightTypeChange,
  onFreightPriceChange,
  onDeliveryDaysChange,
  onGeneralNotesChange
}: FreightStepProps) {
  const deliveryDaysNumber = Number(deliveryDays);
  const freightPriceNumber = Number(freightPrice);
  const freightTypeInvalid = showValidation && !freightType;
  const deliveryDaysInvalid = showValidation && (!Number.isFinite(deliveryDaysNumber) || deliveryDaysNumber <= 0);
  const freightPriceInvalid = showValidation && freightType === "PAID" && (!Number.isFinite(freightPriceNumber) || freightPriceNumber <= 0);

  return (
    <section className="card supplier-portal-card">
      <div className="supplier-card-head">
        <span><I18nText text={"Passo 4 de 5"} /></span>
        <h2><I18nText text={"Frete, entrega e observações"} /></h2>
        <p className="supplier-card-note"><I18nText text={"Informe a condição de frete e o prazo geral de entrega para esta proposta."} /></p>
      </div>

      <div className="supplier-portal-grid supplier-freight-grid">
        <label className={freightTypeInvalid ? "supplier-field-invalid" : ""}>
          <span><I18nText text={"Frete *"} /></span>
          <select value={freightType} onChange={(event) => onFreightTypeChange(event.target.value as FreightType)}>
            <option value=""><I18nText text={"Selecione"} /></option>
            <option value="INCLUDED"><I18nText text={"Frete incluso"} /></option>
            <option value="PAID"><I18nText text={"Frete cobrado à parte"} /></option>
            <option value="NONE"><I18nText text={"Sem frete"} /></option>
          </select>
        </label>
        <label className={deliveryDaysInvalid ? "supplier-field-invalid" : ""}>
          <span><I18nText text={"Dias de entrega *"} /></span>
          <input value={deliveryDays} onChange={(event) => onDeliveryDaysChange(event.target.value)} type="number" min="1" step="1" placeholder="Ex.: 7" data-i18n-placeholder={"Ex.: 7"} />
        </label>
        {freightType === "PAID" && (
          <label className={freightPriceInvalid ? "supplier-field-invalid" : ""}>
            <span><I18nText text={"Valor do frete *"} /></span>
            <input value={freightPrice} onChange={(event) => onFreightPriceChange(event.target.value)} type="number" min="0" step="0.01" placeholder="0,00" data-i18n-placeholder={"0,00"} />
          </label>
        )}
        <label className="supplier-general-notes">
          <span><I18nText text={"Observação geral da proposta"} /></span>
          <textarea value={generalNotes} onChange={(event) => onGeneralNotesChange(event.target.value)} placeholder="Condições adicionais, validade da proposta, etc." data-i18n-placeholder={"Condições adicionais, validade da proposta, etc."} rows={2} />
        </label>
      </div>
    </section>
  );
}
