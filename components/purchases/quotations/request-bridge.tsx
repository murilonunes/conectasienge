import type { PurchaseRequestForQuotation } from "@/features/quotations/data";
import { OperationResultPanel } from "../operation-result-panel";

type QuotationRequestBridgeProps = {
  request: PurchaseRequestForQuotation;
  buyerId: string;
  quotationDate: string;
  preview: string;
  insertResult: string;
  insertOk: boolean;
  inserting: boolean;
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
        <small>{request.itemCount} insumos</small>
      </div>
      <div className="quotation-create-box">
        <input className="field" value={buyerId} onChange={(event) => onBuyerIdChange(event.target.value)} placeholder="Comprador Sienge" />
        <input className="field" type="date" value={quotationDate} onChange={(event) => onQuotationDateChange(event.target.value)} />
        <button className="button" type="button" onClick={onPrepare}>Preparar inserção</button>
        <button className="button secondary" type="button" onClick={onCreate} disabled={inserting || !buyerId.trim()}>
          {inserting ? "Gravando..." : "Gravar no Sienge"}
        </button>
      </div>
      <OperationResultPanel title="Payload preparado" kind="info" json={preview} />
      <OperationResultPanel title="Retorno do Sienge" kind={insertOk ? "success" : "error"} json={insertResult} />
    </section>
  );
}
