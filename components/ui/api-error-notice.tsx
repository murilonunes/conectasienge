import { I18nText } from "@/components/i18n/i18n-text";
import type { SiengeErrorDetails } from "@/lib/api/sienge";

export function ApiErrorNotice({ error }: { error: SiengeErrorDetails }) {
  return (
    <section className="card api-error" aria-live="polite">
      <div className="api-error-heading">
        <span className="api-error-code">{error.status || <I18nText text={"ERRO"} />}</span>
        <div>
          <h2>{error.title}</h2>
          <p>{error.explanation}</p>
        </div>
      </div>
      <div className="api-error-action">
        <strong><I18nText text={"Como resolver"} /></strong>
        <span>{error.suggestion}</span>
      </div>
      <details>
        <summary><I18nText text={"Ver detalhes do erro"} /></summary>
        <dl className="api-error-details">
          <div><dt><I18nText text={"Origem da informação"} /></dt><dd>{error.method} {error.endpoint}</dd></div>
          <div><dt><I18nText text={"Status"} /></dt><dd>{error.status ? `${error.status} ${error.statusText || ""}` : <I18nText text={"Sem resposta HTTP"} />}</dd></div>
          {error.apiMessage && <div><dt><I18nText text={"Resposta do Sienge"} /></dt><dd>{error.apiMessage}</dd></div>}
          {error.requestId && <div><dt><I18nText text={"ID da consulta"} /></dt><dd>{error.requestId}</dd></div>}
          <div><dt><I18nText text={"Horário"} /></dt><dd>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(error.occurredAt))}</dd></div>
        </dl>
      </details>
    </section>
  );
}
