import type { QuotationSummary } from "@/features/quotations/data";
import { formatCurrency, formatOptionalDate } from "@/lib/formatters";
import type { SupplierQuoteResponseSummary } from "@/lib/supplier-quote-portal";
import { exportSupplierResponses, formatDocument, freightSummary, paymentSummary, plural } from "../helpers";

export function RespostasTab({
  quotation,
  supplierResponses,
  responseStats,
  loadingAction,
  onSendNegotiation,
  onDeleteResponse,
  message,
  syncableCount,
  onSyncAll
}: {
  quotation: QuotationSummary;
  supplierResponses: SupplierQuoteResponseSummary[];
  responseStats: { totalValue: number; attendedItems: number; pendingRegistrations: number; suppliers: number };
  loadingAction: string | null;
  onSendNegotiation: (response: SupplierQuoteResponseSummary, confirm: boolean) => void;
  onDeleteResponse: (response: SupplierQuoteResponseSummary) => void;
  message: string;
  syncableCount: number;
  onSyncAll: (confirm: boolean) => void;
}) {
  const activeCount = supplierResponses.filter((response) => !response.supersededByResponseId).length;
  const supersededCount = supplierResponses.length - activeCount;

  return (
    <section className="quotation-responses">
      <div className="quotation-detail-stats">
        <div className="card"><strong>{activeCount}</strong><span>{supersededCount ? `Respostas válidas (+${supersededCount} substituída${supersededCount === 1 ? "" : "s"})` : "Respostas recebidas"}</span></div>
        <div className="card"><strong>{responseStats.suppliers}</strong><span>Fornecedores únicos</span></div>
        <div className="card"><strong>{responseStats.attendedItems}</strong><span>Itens atendidos</span></div>
        <div className="card"><strong>{formatCurrency(responseStats.totalValue)}</strong><span>Total informado</span></div>
      </div>

      <section className="card quotation-comparison">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Respostas dos fornecedores</h2>
            <span className="panel-note">Propostas recebidas pelo link protegido desta cotação</span>
          </div>
          <div className="quotation-operation-actions">
            <button className="button secondary" type="button" onClick={() => exportSupplierResponses(quotation, supplierResponses)} disabled={!supplierResponses.length}>
              Exportar respostas
            </button>
            <button className="button secondary" type="button" disabled={!syncableCount || loadingAction !== null} onClick={() => onSyncAll(false)}>
              Conferir sincronização
            </button>
            <button className="button sienge-write" type="button" disabled={!syncableCount || loadingAction !== null} onClick={() => onSyncAll(true)}>
              {loadingAction === "negotiation-confirm"
                ? "Sincronizando..."
                : `Sincronizar cotação com o Sienge${syncableCount ? ` (${syncableCount})` : ""}`}
            </button>
          </div>
        </div>

        {!syncableCount && supplierResponses.length > 0 && (
          <div className="advanced-search-hint">
            Nenhuma resposta ativa tem fornecedor cadastrado no Sienge ainda. Cadastre o fornecedor na aba Cadastros para poder sincronizar.
          </div>
        )}

        {message && <div className="settings-inline-message">{message}</div>}

        {supplierResponses.length ? (
          <div className="quotation-response-list">
            {supplierResponses.map((response) => (
              <article className={`quotation-response-card ${response.supersededByResponseId ? "superseded" : ""}`} key={response.id}>
                <div className="quotation-response-head">
                  <div>
                    <span>Resposta #{response.id}</span>
                    <h3>{response.supplierName}</h3>
                    <small>{formatDocument(response.document)} - {formatOptionalDate(response.createdAt)}</small>
                  </div>
                  <div>
                    <strong>{formatCurrency(response.totalValue)}</strong>
                    {response.supersededByResponseId ? (
                      <i className="badge muted">Substituída pela #{response.supersededByResponseId}</i>
                    ) : (
                      <i className={`badge ${response.registrationPending ? "warn" : ""}`}>
                        {response.registrationPending ? "Cadastro pendente" : "Cadastro local"}
                      </i>
                    )}
                  </div>
                </div>

                <div className="quotation-response-contact">
                  <span><strong>E-mail</strong>{response.email || "Não informado"}</span>
                  <span><strong>Telefone</strong>{response.phone || "Não informado"}</span>
                  <span><strong>Itens atendidos</strong>{response.attendedCount} de {response.items.length}</span>
                  <span><strong>Pagamento</strong>{paymentSummary(response.commercialTerms)}</span>
                  <span><strong>Frete</strong>{freightSummary(response.commercialTerms)}</span>
                  {response.proposalAttachment && (
                    <span>
                      <strong>Proposta anexada</strong>
                      <a className="quotation-response-attachment" href={`/api/supplier-portal/responses/${response.id}/attachment?quotationId=${quotation.id}`}>
                        {response.proposalAttachment.fileName}
                      </a>
                    </span>
                  )}
                </div>
                {response.commercialTerms.generalNotes && (
                  <p className="quotation-response-notes">{response.commercialTerms.generalNotes}</p>
                )}

                <div className="quotation-operation-actions">
                  {response.supersededByResponseId ? (
                    <span className="table-muted">Proposta substituída pela revisão #{response.supersededByResponseId}: fora do mapa, das aprovações e do envio ao Sienge.</span>
                  ) : response.supplierId ? (
                    <>
                      <button className="button secondary" type="button" disabled={loadingAction !== null} onClick={() => onSendNegotiation(response, false)}>
                        Preparar negociação
                      </button>
                      <button className="button sienge-write" type="button" disabled={loadingAction !== null} onClick={() => onSendNegotiation(response, true)}>
                        {loadingAction === "negotiation-confirm" ? "Enviando..." : "Enviar negociação ao Sienge"}
                      </button>
                    </>
                  ) : (
                    <span className="table-muted">Crie o cadastro deste fornecedor no Sienge (aba Cadastros) para enviar a negociação.</span>
                  )}
                  <button className="button danger" type="button" disabled={loadingAction !== null} onClick={() => onDeleteResponse(response)}>
                    {loadingAction === `delete-response-${response.id}` ? "Excluindo..." : "Excluir resposta"}
                  </button>
                </div>

                <div className="quotation-response-items">
                  <table>
                    <thead>
                      <tr>
                        <th>Insumo</th>
                        <th>Status</th>
                        <th>Qtd.</th>
                        <th>Valor unit.</th>
                        <th>Total</th>
                        <th>Prazo</th>
                        <th>Observação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {response.items.map((item) => {
                        const quotationItem = quotation.items.find((current) => current.itemNumber === item.itemNumber);
                        const total = item.attends ? (item.unitPrice || 0) * (item.quantity || 0) : 0;
                        const itemStatus = item.attends ? item.partial ? "Parcial" : "Atende" : "Não atende";
                        return (
                          <tr className={item.attends && item.partial ? "partial-row" : ""} key={`${response.id}-${item.itemNumber}`}>
                            <td><strong>{quotationItem?.name || `Item ${item.itemNumber}`}</strong><br /><span className="table-muted">#{item.itemNumber}</span></td>
                            <td><i className={`badge ${item.attends ? item.partial ? "warn" : "" : "muted"}`}>{itemStatus}</i></td>
                            <td>{item.attends ? item.quantity || 0 : "-"}</td>
                            <td>{item.attends ? formatCurrency(item.unitPrice || 0) : "-"}</td>
                            <td>{item.attends ? formatCurrency(total) : "-"}</td>
                            <td>{item.attends && item.deadlineDays ? plural(item.deadlineDays, "dia", "dias") : "-"}</td>
                            <td>{item.notes || "Sem observação"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">Nenhuma resposta recebida pelo link desta cotação ainda.</div>
        )}

        {responseStats.pendingRegistrations > 0 && (
          <div className="advanced-search-hint warn">
            {plural(responseStats.pendingRegistrations, "fornecedor respondeu", "fornecedores responderam")} sem cadastro local confirmado. Valide o cadastro antes de integrar qualquer decisão ao Sienge.
          </div>
        )}
      </section>
    </section>
  );
}
