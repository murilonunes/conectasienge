import type { FreightType } from "./types";

type FreightStepProps = {
  freightType: FreightType;
  freightPrice: string;
  deliveryDays: string;
  generalNotes: string;
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
  onFreightTypeChange,
  onFreightPriceChange,
  onDeliveryDaysChange,
  onGeneralNotesChange
}: FreightStepProps) {
  return (
    <section className="card supplier-portal-card">
      <div className="supplier-card-head">
        <span>Passo 4 de 5</span>
        <h2>Frete, entrega e observações</h2>
        <p className="supplier-card-note">Informe a condição de frete e o prazo geral de entrega para esta proposta.</p>
      </div>

      <div className="supplier-portal-grid supplier-freight-grid">
        <label>
          <span>Frete *</span>
          <select value={freightType} onChange={(event) => onFreightTypeChange(event.target.value as FreightType)}>
            <option value="">Selecione</option>
            <option value="INCLUDED">Frete incluso</option>
            <option value="PAID">Frete cobrado à parte</option>
            <option value="NONE">Sem frete</option>
          </select>
        </label>
        <label>
          <span>Dias de entrega *</span>
          <input value={deliveryDays} onChange={(event) => onDeliveryDaysChange(event.target.value)} type="number" min="1" step="1" placeholder="Ex.: 7" />
        </label>
        {freightType === "PAID" && (
          <label>
            <span>Valor do frete *</span>
            <input value={freightPrice} onChange={(event) => onFreightPriceChange(event.target.value)} type="number" min="0" step="0.01" placeholder="0,00" />
          </label>
        )}
        <label className="supplier-general-notes">
          <span>Observação geral da proposta</span>
          <textarea value={generalNotes} onChange={(event) => onGeneralNotesChange(event.target.value)} placeholder="Condições adicionais, validade da proposta, etc." rows={2} />
        </label>
      </div>
    </section>
  );
}
