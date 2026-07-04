import type { FreightType } from "./types";

type FreightStepProps = {
  freightType: FreightType;
  freightPrice: string;
  generalNotes: string;
  onFreightTypeChange: (value: FreightType) => void;
  onFreightPriceChange: (value: string) => void;
  onGeneralNotesChange: (value: string) => void;
};

export function FreightStep({
  freightType,
  freightPrice,
  generalNotes,
  onFreightTypeChange,
  onFreightPriceChange,
  onGeneralNotesChange
}: FreightStepProps) {
  return (
    <section className="card supplier-portal-card">
      <div className="supplier-card-head">
        <span>Passo 4 de 5</span>
        <h2>Frete e observações</h2>
      </div>

      <div className="supplier-portal-grid">
        <label>
          <span>Frete</span>
          <select value={freightType} onChange={(event) => onFreightTypeChange(event.target.value as FreightType)}>
            <option value="NONE">Sem frete</option>
            <option value="INCLUDED">Incluso no preço</option>
            <option value="PAID">A pagar à parte</option>
          </select>
        </label>
        {freightType === "PAID" && (
          <label>
            <span>Valor do frete</span>
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
