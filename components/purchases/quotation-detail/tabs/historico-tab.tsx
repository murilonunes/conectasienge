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
        <div className="card"><strong>{events.length}</strong><span>Eventos</span></div>
        <div className="card"><strong>{events.filter((event) => event.type === "link_sent").length}</strong><span>Links enviados</span></div>
        <div className="card"><strong>{events.filter((event) => event.type === "response_received").length}</strong><span>Respostas</span></div>
        <div className="card"><strong>{events.filter((event) => event.type === "integration_error").length}</strong><span>Erros</span></div>
      </div>

      <section className="card panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Histórico da cotação</h2>
            <span className="panel-note">Eventos operacionais e integrações desta cotação</span>
          </div>
          <button className="button secondary" type="button" onClick={onRefresh}>
            Atualizar
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
                    <span><strong>Fornecedor</strong>{event.supplierName || "Não informado"}</span>
                    <span><strong>Documento</strong>{event.document ? formatDocument(event.document) : "Não informado"}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">Nenhum evento operacional registrado para esta cotação ainda.</div>
        )}
      </section>
    </section>
  );
}
