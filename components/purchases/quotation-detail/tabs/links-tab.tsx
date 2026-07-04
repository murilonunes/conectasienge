import { formatOptionalDate } from "@/lib/formatters";
import type { SupplierQuoteInvitationSummary } from "@/lib/supplier-quote-portal";
import { formatDocument } from "../helpers";
import type { DetailTab } from "../types";

export function LinksTab({
  invitations,
  linkMessage,
  loadingAction,
  onGoToTab,
  onCopyLink,
  onRegenerateLink,
  onRevokeLink
}: {
  invitations: SupplierQuoteInvitationSummary[];
  linkMessage: string;
  loadingAction: string | null;
  onGoToTab: (tab: DetailTab) => void;
  onCopyLink: (url: string) => void;
  onRegenerateLink: (invitation: SupplierQuoteInvitationSummary) => void;
  onRevokeLink: (invitationId: number) => void;
}) {
  return (
    <section className="quotation-links">
      <div className="quotation-detail-stats">
        <div className="card"><strong>{invitations.length}</strong><span>Links gerados</span></div>
        <div className="card"><strong>{invitations.filter((item) => item.status === "answered").length}</strong><span>Respondidos</span></div>
        <div className="card"><strong>{invitations.filter((item) => item.status === "pending").length}</strong><span>Aguardando</span></div>
        <div className="card"><strong>{invitations.filter((item) => item.status === "expired").length}</strong><span>Vencidos</span></div>
      </div>

      <section className="card quotation-comparison">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Gestão de links</h2>
            <span className="panel-note">Validade, fornecedor, status de resposta e ações rápidas</span>
          </div>
          <button className="button secondary" type="button" onClick={() => onGoToTab("fornecedores")}>
            Novo link
          </button>
        </div>

        {linkMessage && <div className="settings-inline-message">{linkMessage}</div>}

        {invitations.length ? (
          <div className="quotation-link-list">
            {invitations.map((invitation) => (
              <article className="quotation-link-card" key={invitation.id}>
                <div className="quotation-link-head">
                  <div>
                    <span>Link #{invitation.id}</span>
                    <h3>{invitation.supplierName || (invitation.document ? formatDocument(invitation.document) : "Fornecedor não informado")}</h3>
                    <small>Criado em {formatOptionalDate(invitation.createdAt)} - válido até {formatOptionalDate(invitation.expiresAt)}</small>
                  </div>
                  <i className={`badge ${invitation.status === "expired" || invitation.status === "revoked" ? "late" : invitation.status === "pending" ? "warn" : ""}`}>
                    {invitation.status === "answered" ? "Respondido" : invitation.status === "expired" ? "Vencido" : invitation.status === "revoked" ? "Revogado" : "Aguardando"}
                  </i>
                </div>

                <div className="quotation-link-meta">
                  <span><strong>Fornecedor</strong>{invitation.supplierName || "Não informado"}</span>
                  <span><strong>Documento</strong>{invitation.document ? formatDocument(invitation.document) : "Não informado"}</span>
                  <span><strong>Respostas</strong>{invitation.responseCount}</span>
                  <span><strong>Última resposta</strong>{invitation.lastResponseAt ? formatOptionalDate(invitation.lastResponseAt) : "Sem resposta"}</span>
                </div>

                <div className="quotation-link-url">
                  <span>{invitation.url}</span>
                </div>

                <div className="quotation-link-actions">
                  <button className="button secondary" type="button" onClick={() => onCopyLink(invitation.url)}>
                    Copiar
                  </button>
                  <button
                    className="button"
                    type="button"
                    disabled={loadingAction !== null}
                    onClick={() => onRegenerateLink(invitation)}
                  >
                    {loadingAction === "supplier-link" ? "Gerando..." : "Regerar"}
                  </button>
                  {invitation.status !== "revoked" && invitation.status !== "expired" && (
                    <button
                      className="button secondary"
                      type="button"
                      disabled={loadingAction !== null}
                      onClick={() => onRevokeLink(invitation.id)}
                    >
                      {loadingAction === "revoke-link" ? "Revogando..." : "Revogar"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">Nenhum link foi gerado para esta cotação ainda.</div>
        )}
      </section>
    </section>
  );
}
