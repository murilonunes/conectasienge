import { I18nText } from "@/components/i18n/i18n-text";
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
        <div className="card"><strong>{invitations.length}</strong><span><I18nText text={"Links gerados"} /></span></div>
        <div className="card"><strong>{invitations.filter((item) => item.status === "answered").length}</strong><span><I18nText text={"Respondidos"} /></span></div>
        <div className="card"><strong>{invitations.filter((item) => item.status === "pending").length}</strong><span><I18nText text={"Aguardando"} /></span></div>
        <div className="card"><strong>{invitations.filter((item) => item.status === "expired").length}</strong><span><I18nText text={"Vencidos"} /></span></div>
      </div>

      <section className="card quotation-comparison">
        <div className="panel-head">
          <div>
            <h2 className="panel-title"><I18nText text={"Gestão de links"} /></h2>
            <span className="panel-note"><I18nText text={"Validade, fornecedor, status de resposta e ações rápidas"} /></span>
          </div>
          <button className="button secondary" type="button" onClick={() => onGoToTab("fornecedores")}>
            <I18nText text={"Novo link"} />
          </button>
        </div>

        {linkMessage && <div className="settings-inline-message">{linkMessage}</div>}

        {invitations.length ? (
          <div className="quotation-link-list">
            {invitations.map((invitation) => (
              <article className="quotation-link-card" key={invitation.id}>
                <div className="quotation-link-head">
                  <div>
                    <span><I18nText text={"Link #"} />{invitation.id}</span>
                    <h3>{invitation.supplierName || (invitation.document ? formatDocument(invitation.document) : <I18nText text={"Fornecedor não informado"} />)}</h3>
                    <small><I18nText text={"Criado em"} /> {formatOptionalDate(invitation.createdAt)} <I18nText text={"- válido até"} /> {formatOptionalDate(invitation.expiresAt)}</small>
                  </div>
                  <i className={`badge ${invitation.status === "expired" || invitation.status === "revoked" ? "late" : invitation.status === "pending" ? "warn" : ""}`}>
                    {invitation.status === "answered" ? <I18nText text={"Respondido"} /> : invitation.status === "expired" ? <I18nText text={"Vencido"} /> : invitation.status === "revoked" ? <I18nText text={"Revogado"} /> : <I18nText text={"Aguardando"} />}
                  </i>
                </div>

                <div className="quotation-link-meta">
                  <span><strong><I18nText text={"Fornecedor"} /></strong>{invitation.supplierName || <I18nText text={"Não informado"} />}</span>
                  <span><strong><I18nText text={"Documento"} /></strong>{invitation.document ? formatDocument(invitation.document) : <I18nText text={"Não informado"} />}</span>
                  <span><strong><I18nText text={"Respostas"} /></strong>{invitation.responseCount}</span>
                  <span><strong><I18nText text={"Última resposta"} /></strong>{invitation.lastResponseAt ? formatOptionalDate(invitation.lastResponseAt) : <I18nText text={"Sem resposta"} />}</span>
                </div>

                <div className="quotation-link-url">
                  <span>{invitation.url}</span>
                </div>

                <div className="quotation-link-actions">
                  <button className="button secondary" type="button" onClick={() => onCopyLink(invitation.url)}>
                    <I18nText text={"Copiar"} />
                  </button>
                  <button
                    className="button"
                    type="button"
                    disabled={loadingAction !== null}
                    onClick={() => onRegenerateLink(invitation)}
                  >
                    <I18nText text={loadingAction === "supplier-link" ? "Gerando..." : "Regerar"} />
                  </button>
                  {invitation.status !== "revoked" && invitation.status !== "expired" && (
                    <button
                      className="button secondary"
                      type="button"
                      disabled={loadingAction !== null}
                      onClick={() => onRevokeLink(invitation.id)}
                    >
                      <I18nText text={loadingAction === "revoke-link" ? "Revogando..." : "Revogar"} />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state"><I18nText text={"Nenhum link foi gerado para esta cotação ainda."} /></div>
        )}
      </section>
    </section>
  );
}
