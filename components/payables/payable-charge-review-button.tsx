"use client";

import { I18nText } from "@/components/i18n/i18n-text";
import { useMemo, useState } from "react";
import { analyzePayableCharge, type PayableChargeForReview } from "@/lib/payables-abuse-analysis";
import { formatCurrency, formatOptionalDate } from "@/lib/formatters";

type PayableChargeReviewButtonProps = {
  item: PayableChargeForReview;
  title?: string;
  referenceDate?: string;
  compact?: boolean;
};

export function PayableChargeReviewButton({ item, title = "Análise de cobrança", referenceDate, compact = false }: PayableChargeReviewButtonProps) {
  const [open, setOpen] = useState(false);
  const review = useMemo(() => analyzePayableCharge(item, referenceDate), [item, referenceDate]);
  const buttonLabel = review.hasRisk ? "Revisar cobrança" : "Ver análise";

  return (
    <>
      <button className={`payable-review-button ${review.hasRisk ? "warn" : ""} ${compact ? "compact" : ""}`} type="button" onClick={() => setOpen(true)}>
        {buttonLabel}
      </button>

      {open && (
        <div className="settings-modal-backdrop" role="presentation">
          <div className="settings-modal payable-review-modal" role="dialog" aria-modal="true" aria-labelledby="payable-review-title">
            <div className="settings-modal-head">
              <div>
                <h2 id="payable-review-title">{title}</h2>
                <span><I18nText text={review.hasRisk ? "Possível cobrança acima do critério informado." : "Nenhum excesso identificado pelo critério informado."} /></span>
              </div>
              <button type="button" onClick={() => setOpen(false)}><I18nText text={"Fechar"} /></button>
            </div>

            <div className={`payable-review-status ${review.hasRisk ? "warn" : ""}`}>
              <strong><I18nText text={review.hasRisk ? "Atenção para revisar" : "Dentro do critério"} /></strong>
              <span><I18nText text={"Critério usado: até 2% no ato mais 1% ao mês de atraso."} /></span>
            </div>

            <div className="payable-review-grid">
              <div><span><I18nText text={"Valor original"} /></span><strong>{formatCurrency(review.originalAmount)}</strong></div>
              <div><span><I18nText text={"Valor corrigido"} /></span><strong>{formatCurrency(review.correctedAmount)}</strong></div>
              <div><span><I18nText text={"Acréscimo corrigido"} /></span><strong>{formatCurrency(review.correctedIncrease)}</strong></div>
              <div><span><I18nText text={"Valor pago"} /></span><strong>{formatCurrency(review.paidAmount)}</strong></div>
              <div><span><I18nText text={"Multa/juros pagos a mais"} /></span><strong>{formatCurrency(review.paidIncrease)}</strong></div>
              <div><span><I18nText text={"Limite pelo critério"} /></span><strong>{formatCurrency(review.allowedIncrease)}</strong></div>
              <div><span><I18nText text={"Meses de atraso considerados"} /></span><strong>{review.monthsLate}</strong></div>
              <div><span><I18nText text={"Data de referência"} /></span><strong>{formatOptionalDate(review.referenceDate)}</strong></div>
              <div><span><I18nText text={"Excesso na correção"} /></span><strong className={review.correctedExcess > 0 ? "negative" : ""}>{formatCurrency(review.correctedExcess)}</strong></div>
              <div><span><I18nText text={"Excesso no valor pago"} /></span><strong className={review.paidExcess > 0 ? "negative" : ""}>{formatCurrency(review.paidExcess)}</strong></div>
            </div>

            <p className="payable-review-note">
              <I18nText text={"Esta análise é uma triagem operacional. Ela usa os valores salvos do Sienge e ajuda a separar parcelas para conferência antes de tratar como cobrança indevida."} />
            </p>
          </div>
        </div>
      )}
    </>
  );
}
