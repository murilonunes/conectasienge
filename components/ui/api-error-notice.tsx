import type { SiengeErrorDetails } from "@/lib/api/sienge";

export function ApiErrorNotice({ error }: { error: SiengeErrorDetails }) {
  return (
    <section className="card api-error" aria-live="polite">
      <div className="api-error-heading">
        <span className="api-error-code">{error.status || "ERRO"}</span>
        <div>
          <h2>{error.title}</h2>
          <p>{error.explanation}</p>
        </div>
      </div>
      <div className="api-error-action">
        <strong>Como resolver</strong>
        <span>{error.suggestion}</span>
      </div>
      <details>
        <summary>Ver detalhes do erro</summary>
        <dl className="api-error-details">
          <div><dt>Consulta técnica</dt><dd>{error.method} {error.endpoint}</dd></div>
          <div><dt>Status</dt><dd>{error.status ? `${error.status} ${error.statusText || ""}` : "Sem resposta HTTP"}</dd></div>
          {error.apiMessage && <div><dt>Resposta do Sienge</dt><dd>{error.apiMessage}</dd></div>}
          {error.requestId && <div><dt>ID da consulta</dt><dd>{error.requestId}</dd></div>}
          <div><dt>Horário</dt><dd>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(error.occurredAt))}</dd></div>
        </dl>
      </details>
    </section>
  );
}
