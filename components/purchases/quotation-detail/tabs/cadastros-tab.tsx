import { I18nText } from "@/components/i18n/i18n-text";
import { formatOptionalDate } from "@/lib/formatters";
import type { SupplierQuoteResponseSummary, SupplierRegistrationReview } from "@/lib/supplier-quote-portal";
import { OperationResultPanel, type OperationResultKind } from "../../operation-result-panel";
import { formatDocument, registrationText } from "../helpers";

export function CadastrosTab({
  pendingSuppliers,
  registrationReviews,
  pendingSupplierLoading,
  pendingSupplierResult,
  pendingSupplierKind,
  onSubmitPendingSupplier
}: {
  pendingSuppliers: SupplierQuoteResponseSummary[];
  registrationReviews: Record<string, SupplierRegistrationReview>;
  pendingSupplierLoading: string | null;
  pendingSupplierResult: string;
  pendingSupplierKind: OperationResultKind;
  onSubmitPendingSupplier: (response: SupplierQuoteResponseSummary, confirm: boolean) => void;
}) {
  return (
    <section className="quotation-pending-suppliers">
      <div className="quotation-detail-stats">
        <div className="card"><strong>{pendingSuppliers.length}</strong><span><I18nText text={"Cadastros pendentes"} /></span></div>
        <div className="card"><strong>{pendingSuppliers.filter((response) => registrationReviews[response.document]?.status === "prepared").length}</strong><span><I18nText text={"Preparados"} /></span></div>
        <div className="card"><strong>{pendingSuppliers.filter((response) => registrationReviews[response.document]?.status === "created").length}</strong><span><I18nText text={"Criados no Sienge"} /></span></div>
        <div className="card"><strong>{pendingSuppliers.filter((response) => registrationReviews[response.document]?.status === "failed").length}</strong><span><I18nText text={"Com erro"} /></span></div>
      </div>

      <section className="card quotation-comparison">
        <div className="panel-head">
          <div>
            <h2 className="panel-title"><I18nText text={"Cadastro pendente de fornecedor"} /></h2>
            <span className="panel-note"><I18nText text={"Revise CPF/CNPJ inexistente na base local e transforme em fornecedor no Sienge"} /></span>
          </div>
        </div>

        {pendingSuppliers.length ? (
          <div className="quotation-pending-list">
            {pendingSuppliers.map((response) => {
              const document = response.document.replace(/\D/g, "");
              const review = registrationReviews[document];
              const status = review?.status || "pending";
              const loadingPreview = pendingSupplierLoading === `${document}-preview`;
              const loadingConfirm = pendingSupplierLoading === `${document}-confirm`;
              return (
                <article className="quotation-pending-card" key={document}>
                  <div className="quotation-pending-head">
                    <div>
                      <span>{formatDocument(document)}</span>
                      <h3>{response.supplierName}</h3>
                      <small><I18nText text={"Resposta #"} />{response.id} <I18nText text={"- recebida em"} /> {formatOptionalDate(response.createdAt)}</small>
                    </div>
                    <i className={`badge ${status === "created" ? "" : status === "failed" ? "late" : "warn"}`}>
                      {status === "created" ? <I18nText text={"Criado"} /> : status === "prepared" ? <I18nText text={"Preparado"} /> : status === "failed" ? <I18nText text={"Erro"} /> : <I18nText text={"Pendente"} />}
                    </i>
                  </div>

                  <div className="quotation-pending-grid">
                    <span><strong><I18nText text={"Tipo"} /></strong><I18nText text={document.length > 11 ? "Pessoa jurídica" : "Pessoa física"} /></span>
                    <span><strong><I18nText text={"Nome fantasia"} /></strong>{registrationText(response.registration, "tradeName") || <I18nText text={"Não informado"} />}</span>
                    <span><strong><I18nText text={"E-mail"} /></strong>{response.email || <I18nText text={"Não informado"} />}</span>
                    <span><strong><I18nText text={"Telefone"} /></strong>{response.phone || <I18nText text={"Não informado"} />}</span>
                    <span><strong><I18nText text={"Cidade"} /></strong>{registrationText(response.registration, "city") || <I18nText text={"Não informado"} />}</span>
                    <span><strong><I18nText text={"UF"} /></strong>{registrationText(response.registration, "state") || <I18nText text={"Não informado"} />}</span>
                  </div>

                  <div className="quotation-pending-actions">
                    <button className="button secondary" type="button" disabled={Boolean(pendingSupplierLoading)} onClick={() => onSubmitPendingSupplier(response, false)}>
                      <I18nText text={loadingPreview ? "Preparando..." : "Preparar payload"} />
                    </button>
                    <button className="button sienge-write" type="button" disabled={Boolean(pendingSupplierLoading) || status === "created"} onClick={() => onSubmitPendingSupplier(response, true)}>
                      <I18nText text={loadingConfirm ? "Criando..." : "Criar no Sienge"} />
                    </button>
                  </div>

                  {review?.reviewedAt && (
                    <small className="quotation-pending-review"><I18nText text={"Última revisão:"} /> {formatOptionalDate(review.reviewedAt)}</small>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state"><I18nText text={"Nenhum CPF/CNPJ pendente nesta cotação. Os fornecedores que responderam já existem na base local ou ainda não enviaram cadastro."} /></div>
        )}

      </section>
      <OperationResultPanel title="Cadastro de fornecedor" kind={pendingSupplierKind} json={pendingSupplierResult} />
    </section>
  );
}
