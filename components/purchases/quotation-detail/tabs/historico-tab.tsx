import { I18nText } from "@/components/i18n/i18n-text";
import { formatOptionalDate } from "@/lib/formatters";
import type { SupplierQuoteEventSummary } from "@/lib/supplier-quote-portal";
import { eventTypeClass, eventTypeLabel, formatDocument } from "../helpers";

export function HistoricoTab({
  events,
  onRefresh
}: {
  events: SupplierQuoteEventSummary[];
  onRefresh: () => void;
}) {
  return (
    <section className="quotation-history-panel">
      <div className="quotation-detail-stats">
        <div className="card"><strong>{events.length}</strong><span><I18nText text={"Eventos"} /></span></div>
        <div className="card"><strong>{events.filter((event) => event.type === "link_sent").length}</strong><span><I18nText text={"Links enviados"} /></span></div>
        <div className="card"><strong>{events.filter((event) => event.type === "response_received").length}</strong><span><I18nText text={"Respostas"} /></span></div>
        <div className="card"><strong>{events.filter((event) => event.type === "integration_error").length}</strong><span><I18nText text={"Erros"} /></span></div>
      </div>

      <section className="card panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title"><I18nText text={"Histórico da cotação"} /></h2>
            <span className="panel-note"><I18nText text={"Eventos operacionais e integrações desta cotação"} /></span>
          </div>
          <button className="button secondary" type="button" onClick={onRefresh}>
            <I18nText text={"Atualizar"} />
          </button>
        </div>

        {events.length ? (
          <div className="quotation-timeline">
            {events.map((event) => (
              <article key={event.id}>
                <div className="quotation-timeline-marker" />
                <div className="quotation-timeline-body">
                  <div className="quotation-timeline-head">
                    <div>
                      <span>{formatOptionalDate(event.createdAt)}</span>
                      <h3>{event.title}</h3>
                    </div>
                    <i className={`badge ${eventTypeClass(event.type)}`}>{eventTypeLabel(event.type)}</i>
                  </div>
                  {event.description && <p>{event.description}</p>}
                  <div className="quotation-timeline-meta">
                    <span><strong><I18nText text={"Fornecedor"} /></strong>{event.supplierName || <I18nText text={"Não informado"} />}</span>
                    <span><strong><I18nText text={"Documento"} /></strong>{event.document ? formatDocument(event.document) : <I18nText text={"Não informado"} />}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state"><I18nText text={"Nenhum evento operacional registrado para esta cotação ainda."} /></div>
        )}
      </section>
    </section>
  );
}
