import { I18nText } from "@/components/i18n/i18n-text";
import Link from "next/link";
import { PayableChargeReviewButton } from "@/components/payables/payable-charge-review-button";
import { IntegrationStamp } from "@/components/ui/integration-stamp";
import type { ScheduleBucket } from "@/features/payables-schedule/types";
import { analyzePayableCharge } from "@/lib/payables-abuse-analysis";
import { formatCurrency } from "@/lib/formatters";

function documentLabel(item: ScheduleBucket["items"][number]) {
  const parts = [item.documentIdentificationId, item.documentNumber].filter(Boolean);
  return parts.length ? parts.join(" - ") : "Documento não informado";
}

function authorizationLabel(value?: string) {
  if (value === "S") return "Autorizada";
  if (value === "N") return "Não autorizada";
  return "Autorização não informada";
}

export function PayablesAgenda({ buckets }: { buckets: ScheduleBucket[] }) {
  return (
    <div className="payables-agenda">
      {buckets.map((bucket) => (
        <section className="card payables-period" key={bucket.id}>
          <div className="payables-period-head">
            <div><p>{bucket.note}</p><h2>{bucket.label}</h2></div>
            <div><strong>{formatCurrency(bucket.amount)}</strong><span>{bucket.items.length} <I18nText text={"parcela"} /><I18nText text={bucket.items.length === 1 ? "" : "s"} /></span></div>
          </div>
          <div className="payables-period-list">
            {bucket.items.slice(0, 8).map((item) => {
              const review = analyzePayableCharge(item);
              return (
                <article key={`${item.billId}-${item.installmentId}`}>
                  <div className={`due-marker ${bucket.id === "today" ? "urgent" : ""}`}>
                    <strong>{new Date(`${item.dueDate}T12:00:00`).getDate()}</strong>
                    <span>{new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(new Date(`${item.dueDate}T12:00:00`))}</span>
                  </div>
                  <div>
                    <strong>{item.creditorName || `Credor #${item.creditorId || "não informado"}`}</strong>
                    <span>{item.companyName || <I18nText text={"Empresa não informada"} />} <I18nText text={"-"} /> {documentLabel(item)}</span>
                    <span><I18nText text={"Título #"} />{item.billId} <I18nText text={"/ Parcela"} /> {item.installmentId}</span>
                    <span><I18nText text={"Original"} /> {formatCurrency(review.originalAmount)} <I18nText text={"- Multa/juros pagos a mais"} /> {formatCurrency(review.paidIncrease)}</span>
                    <IntegrationStamp record={item} />
                  </div>
                  <div>
                    <strong>{formatCurrency(review.correctedAmount)}</strong>
                    <span><I18nText text={"Valor corrigido"} /></span>
                    <span>{authorizationLabel(item.authorizationStatus)}</span>
                    <PayableChargeReviewButton item={item} title={`Título #${item.billId} / Parcela ${item.installmentId}`} compact />
                  </div>
                </article>
              );
            })}
            {!bucket.items.length && <div className="payables-empty"><I18nText text={"Nenhum pagamento programado nesta janela."} /></div>}
            {bucket.items.length > 8 && <Link className="payables-more" href="/lancamentos/baixa"><I18nText text={"Ver todas as"} /> {bucket.items.length} <I18nText text={"parcelas"} /></Link>}
          </div>
        </section>
      ))}
    </div>
  );
}
