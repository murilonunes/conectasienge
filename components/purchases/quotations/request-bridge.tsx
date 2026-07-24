import { I18nText } from "@/components/i18n/i18n-text";
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
        <span><I18nText text={"Origem"} /></span>
        <h2>{request.code}</h2>
        <small>{selectedItemNumbers.size} <I18nText text={"de"} /> {request.itemCount} <I18nText text={"insumos selecionados"} /></small>
      </div>
      <div className="quotation-create-box">
        <input className="field" value={buyerId} onChange={(event) => onBuyerIdChange(event.target.value)} placeholder="Comprador Sienge" data-i18n-placeholder={"Comprador Sienge"} />
        <input className="field" type="date" value={quotationDate} onChange={(event) => onQuotationDateChange(event.target.value)} />
        <ItemSelectionModal request={request} selected={selectedItemNumbers} onChange={onSelectedItemNumbersChange} />
        <button className="button" type="button" onClick={onPrepare} disabled={!selectedItemNumbers.size}><I18nText text={"Preparar inserção"} /></button>
        <button className="button secondary" type="button" onClick={onCreate} disabled={inserting || !buyerId.trim() || !selectedItemNumbers.size}>
          <I18nText text={inserting ? "Gravando..." : "Gravar no Sienge"} />
        </button>
      </div>
      {!selectedItemNumbers.size && (
        <div className="advanced-search-hint warn"><I18nText text={"Escolha ao menos um item para gravar a cotação no Sienge."} /></div>
      )}
      <OperationResultPanel title="Payload preparado" kind="info" json={preview} />
      <OperationResultPanel title="Retorno do Sienge" kind={insertOk ? "success" : "error"} json={insertResult} />
    </section>
  );
}
