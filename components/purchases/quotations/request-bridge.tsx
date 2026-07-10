import type { PurchaseRequestForQuotation } from "@/features/quotations/data";
import { OperationResultPanel } from "../operation-result-panel";
import { ItemSelectionModal } from "./item-selection-modal";

type QuotationRequestBridgeProps = {
  request: PurchaseRequestForQuotation;
  buyerId: string;
  quotationDate: string;
  preview: string;
  insertResult: string;
  insertOk: boolean;
  inserting: boolean;
  selectedItemNumbers: Set<number>;
  onSelectedItemNumbersChange: (next: Set<number>) => void;
  onBuyerIdChange: (buyerId: string) => void;
  onQuotationDateChange: (quotationDate: string) => void;
  onPrepare: () => void;
  onCreate: () => void;
};

export function QuotationRequestBridge({
  request,
  buyerId,
  quotationDate,
  preview,
  insertResult,
  insertOk,
  inserting,
  selectedItemNumbers,
  onSelectedItemNumbersChange,
  onBuyerIdChange,
  onQuotationDateChange,
  onPrepare,
  onCreate
}: QuotationRequestBridgeProps) {
  return (
    <section className="card quotation-request-bridge">
      <div className="quotation-request-title">
        <span>Origem</span>
        <h2>{request.code}</h2>
        <small>{selectedItemNumbers.size} de {request.itemCount} insumos selecionados</small>
      </div>
      <div className="quotation-create-box">
        <input className="field" value={buyerId} onChange={(event) => onBuyerIdChange(event.target.value)} placeholder="Comprador Sienge" />
        <input className="field" type="date" value={quotationDate} onChange={(event) => onQuotationDateChange(event.target.value)} />
        <ItemSelectionModal request={request} selected={selectedItemNumbers} onChange={onSelectedItemNumbersChange} />
        <button className="button" type="button" onClick={onPrepare} disabled={!selectedItemNumbers.size}>Preparar inserção</button>
        <button className="button secondary" type="button" onClick={onCreate} disabled={inserting || !buyerId.trim() || !selectedItemNumbers.size}>
          {inserting ? "Gravando..." : "Gravar no Sienge"}
        </button>
      </div>
      {!selectedItemNumbers.size && (
        <div className="advanced-search-hint warn">Escolha ao menos um item para gravar a cotação no Sienge.</div>
      )}
      <OperationResultPanel title="Payload preparado" kind="info" json={preview} />
      <OperationResultPanel title="Retorno do Sienge" kind={insertOk ? "success" : "error"} json={insertResult} />
    </section>
  );
}
