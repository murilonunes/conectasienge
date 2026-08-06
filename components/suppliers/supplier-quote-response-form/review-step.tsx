import { I18nText } from "@/components/i18n/i18n-text";
import type { QuotationItemSummary } from "@/features/quotations/data";
import type { SupplierQuoteProposalAttachment } from "@/lib/supplier-quote-portal";
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
  cashDiscountMode?: string;
  cashDiscountValue?: string;
  cashPrice: number;
  installments: InstallmentRow[];
  freightType: FreightType;
  freightPrice: string;
  deliveryDays: string;
  generalNotes: string;
  proposalAttachment?: SupplierQuoteProposalAttachment;
  onProposalAttachmentChange: (file: File | undefined) => void;
  onProposalAttachmentRemove: () => void;
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
  cashDiscountMode,
  cashDiscountValue,
  cashPrice,
  installments,
  freightType,
  freightPrice,
  deliveryDays,
  generalNotes,
  proposalAttachment,
  onProposalAttachmentChange,
  onProposalAttachmentRemove,
  onEditStep
}: ReviewStepProps) {
  const attachmentSize = proposalAttachment
    ? `${Math.max(1, Math.round(proposalAttachment.sizeBytes / 1024))} KB`
    : "";

  return (
    <section className="card supplier-portal-card supplier-final-review-card">
      <div className="supplier-card-head">
        <span><I18nText text={"Passo 5 de 5"} /></span>
        <h2><I18nText text={"Confira antes de enviar"} /></h2>
        <p className="supplier-card-note"><I18nText text={"Revise os dados da proposta. Se algo estiver incorreto, volte ao passo correspondente antes de enviar."} /></p>
      </div>

      <div className="supplier-review-section">
        <div className="supplier-review-section-head">
          <h3><I18nText text={"Dados do fornecedor"} /></h3>
          <button type="button" className="supplier-review-edit" onClick={() => onEditStep(1)}><I18nText text={"Editar dados"} /></button>
        </div>
        <div className="supplier-review-grid">
          <span><strong><I18nText text={"CPF/CNPJ"} /></strong>{document ? formatDocument(document) : <I18nText text={"Não informado"} />}</span>
          <span><strong><I18nText text={"Razão social ou nome"} /></strong>{supplierName || <I18nText text={"Não informado"} />}</span>
          <span><strong><I18nText text={"E-mail"} /></strong>{email || <I18nText text={"Não informado"} />}</span>
          <span><strong><I18nText text={"Telefone"} /></strong>{phone || <I18nText text={"Não informado"} />}</span>
        </div>
      </div>

      <div className="supplier-review-section">
        <div className="supplier-review-section-head">
          <h3><I18nText text={"Itens cotados"} /></h3>
          <button type="button" className="supplier-review-edit" onClick={() => onEditStep(2)}><I18nText text={"Editar itens"} /></button>
        </div>
        {quotedCount ? (
          <div className="supplier-review-items">
            <div className="supplier-review-items-row supplier-review-items-head">
              <span><I18nText text={"Insumo"} /></span><span><I18nText text={"Valor unitário"} /></span><span><I18nText text={"Quantidade"} /></span><span><I18nText text={"Prazo especial"} /></span><span><I18nText text={"Total"} /></span>
            </div>
            {responseItems.filter((item) => item.attends).map((item) => {
              const original = items.find((current) => current.itemNumber === item.itemNumber);
              return (
                <div className="supplier-review-items-row" key={item.itemNumber}>
                  <span className="supplier-review-item-description">
                    {original?.name || `Item ${item.itemNumber}`}
                    {original?.notes && <small><I18nText text="Observação do comprador" />: {original.notes}</small>}
                  </span>
                  <span>{formatCurrency(Number(item.unitPrice || 0))}</span>
                  <span>{item.quantity} {original?.unit || <I18nText text={""} />}</span>
                  <span>{item.deadlineDays ? `${item.deadlineDays}d` : <I18nText text={"-"} />}</span>
                  <strong>{formatCurrency(itemTotal(item))}</strong>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="table-muted"><I18nText text={"Nenhum item marcado."} /></p>
        )}
      </div>

      <div className="supplier-review-section">
        <div className="supplier-review-section-head">
          <h3><I18nText text={"Pagamento"} /></h3>
          <button type="button" className="supplier-review-edit" onClick={() => onEditStep(3)}><I18nText text={"Editar pagamento"} /></button>
        </div>
        <div className="supplier-review-grid">
          {offersCash && <span><strong><I18nText text={"À vista"} /></strong>{cashSummaryText(cashDiscountPercentage, cashDiscountMode, cashDiscountValue)} <I18nText text={"-"} /> {formatCurrency(cashPrice)}</span>}
          {offersTerm && <span><strong><I18nText text={"A prazo"} /></strong>{termSummaryText(installments)}</span>}
          {!offersCash && !offersTerm && <span><strong><I18nText text={"Pagamento"} /></strong><I18nText text={"Nenhuma forma marcada"} /></span>}
        </div>
      </div>

      <div className="supplier-review-section">
        <div className="supplier-review-section-head">
          <h3><I18nText text={"Frete e observações"} /></h3>
          <button type="button" className="supplier-review-edit" onClick={() => onEditStep(4)}><I18nText text={"Editar frete"} /></button>
        </div>
        <div className="supplier-review-grid">
          <span><strong><I18nText text={"Frete e entrega"} /></strong>{freightSummaryText(freightType, freightPrice, deliveryDays)}</span>
        </div>
        {generalNotes && <p className="quotation-response-notes">{generalNotes}</p>}
      </div>

      <div className="supplier-review-section supplier-attachment-section">
        <div className="supplier-review-section-head">
          <h3><I18nText text={"Proposta do fornecedor"} /></h3>
          <label className="supplier-attachment-button">
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(event) => onProposalAttachmentChange(event.target.files?.[0])}
            />
            <I18nText text={"Anexar proposta"} />
          </label>
        </div>
        {proposalAttachment ? (
          <div className="supplier-attachment-card">
            <div>
              <strong>{proposalAttachment.fileName}</strong>
              <span><I18nText text={proposalAttachment.mimeType === "application/pdf" ? "PDF" : "Imagem"} /> <I18nText text={"-"} /> {attachmentSize}</span>
            </div>
            <button type="button" onClick={onProposalAttachmentRemove}><I18nText text={"Remover anexo"} /></button>
          </div>
        ) : (
          <p className="supplier-attachment-empty"><I18nText text={"Opcional: anexe a proposta gerada no sistema do fornecedor em PDF, JPG ou PNG, até 2 MB."} /></p>
        )}
      </div>
    </section>
  );
}
