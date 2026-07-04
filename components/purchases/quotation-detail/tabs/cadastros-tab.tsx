import { formatOptionalDate } from "@/lib/formatters";
import type { SupplierQuoteResponseSummary, SupplierRegistrationReview } from "@/lib/supplier-quote-portal";
import { formatDocument, registrationText } from "../helpers";

export function CadastrosTab({
  pendingSuppliers,
  registrationReviews,
  pendingSupplierLoading,
  pendingSupplierResult,
  onSubmitPendingSupplier
}: {
  pendingSuppliers: SupplierQuoteResponseSummary[];
  registrationReviews: Record<string, SupplierRegistrationReview>;
  pendingSupplierLoading: string | null;
  pendingSupplierResult: string;
  onSubmitPendingSupplier: (response: SupplierQuoteResponseSummary, confirm: boolean) => void;
}) {
  return (
    <section className="quotation-pending-suppliers">
      <div className="quotation-detail-stats">
        <div className="card"><strong>{pendingSuppliers.length}</strong><span>Cadastros pendentes</span></div>
        <div className="card"><strong>{pendingSuppliers.filter((response) => registrationReviews[response.document]?.status === "prepared").length}</strong><span>Preparados</span></div>
        <div className="card"><strong>{pendingSuppliers.filter((response) => registrationReviews[response.document]?.status === "created").length}</strong><span>Criados no Sienge</span></div>
        <div className="card"><strong>{pendingSuppliers.filter((response) => registrationReviews[response.document]?.status === "failed").length}</strong><span>Com erro</span></div>
      </div>

      <section className="card quotation-comparison">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Cadastro pendente de fornecedor</h2>
            <span className="panel-note">Revise CPF/CNPJ inexistente na base local e transforme em fornecedor no Sienge</span>
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
                      <small>Resposta #{response.id} - recebida em {formatOptionalDate(response.createdAt)}</small>
                    </div>
                    <i className={`badge ${status === "created" ? "" : status === "failed" ? "late" : "warn"}`}>
                      {status === "created" ? "Criado" : status === "prepared" ? "Preparado" : status === "failed" ? "Erro" : "Pendente"}
                    </i>
                  </div>

                  <div className="quotation-pending-grid">
                    <span><strong>Tipo</strong>{document.length > 11 ? "Pessoa jurídica" : "Pessoa física"}</span>
                    <span><strong>Nome fantasia</strong>{registrationText(response.registration, "tradeName") || "Não informado"}</span>
                    <span><strong>E-mail</strong>{response.email || "Não informado"}</span>
                    <span><strong>Telefone</strong>{response.phone || "Não informado"}</span>
                    <span><strong>Cidade</strong>{registrationText(response.registration, "city") || "Não informado"}</span>
                    <span><strong>UF</strong>{registrationText(response.registration, "state") || "Não informado"}</span>
                  </div>

                  <div className="quotation-pending-actions">
                    <button className="button secondary" type="button" disabled={Boolean(pendingSupplierLoading)} onClick={() => onSubmitPendingSupplier(response, false)}>
                      {loadingPreview ? "Preparando..." : "Preparar payload"}
                    </button>
                    <button className="button sienge-write" type="button" disabled={Boolean(pendingSupplierLoading) || status === "created"} onClick={() => onSubmitPendingSupplier(response, true)}>
                      {loadingConfirm ? "Criando..." : "Criar no Sienge"}
                    </button>
                  </div>

                  {review?.reviewedAt && (
                    <small className="quotation-pending-review">Última revisão: {formatOptionalDate(review.reviewedAt)}</small>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">Nenhum CPF/CNPJ pendente nesta cotação. Os fornecedores que responderam já existem na base local ou ainda não enviaram cadastro.</div>
        )}

        {pendingSupplierResult && (
          <pre className="quotation-payload-preview">{pendingSupplierResult}</pre>
        )}
      </section>
    </section>
  );
}
