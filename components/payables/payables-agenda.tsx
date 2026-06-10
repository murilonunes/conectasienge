import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { ScheduleBucket } from "@/features/payables-schedule/types";

export function PayablesAgenda({ buckets }: { buckets: ScheduleBucket[] }) {
  return (
    <div className="payables-agenda">
      {buckets.map((bucket) => <section className="card payables-period" key={bucket.id}>
        <div className="payables-period-head"><div><p>{bucket.note}</p><h2>{bucket.label}</h2></div><div><strong>{formatCurrency(bucket.amount)}</strong><span>{bucket.items.length} parcela{bucket.items.length === 1 ? "" : "s"}</span></div></div>
        <div className="payables-period-list">
          {bucket.items.slice(0, 8).map((item) => <article key={`${item.billId}-${item.installmentId}`}>
            <div className={`due-marker ${bucket.id === "today" ? "urgent" : ""}`}><strong>{new Date(`${item.dueDate}T12:00:00`).getDate()}</strong><span>{new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(new Date(`${item.dueDate}T12:00:00`))}</span></div>
            <div><strong>{item.creditorName || `Credor #${item.creditorId}`}</strong><span>{item.documentIdentificationId}-{item.documentNumber} · Título #{item.billId} / Parcela {item.installmentId}</span></div>
            <div><strong>{formatCurrency(item.correctedBalanceAmount ?? item.balanceAmount ?? item.originalAmount ?? 0)}</strong><span>{item.authorizationStatus === "S" ? "Autorizada" : "Não autorizada"}</span></div>
          </article>)}
          {!bucket.items.length && <div className="payables-empty">Nenhum pagamento programado nesta janela.</div>}
          {bucket.items.length > 8 && <Link className="payables-more" href="/lancamentos/baixa">Ver todas as {bucket.items.length} parcelas</Link>}
        </div>
      </section>)}
    </div>
  );
}
