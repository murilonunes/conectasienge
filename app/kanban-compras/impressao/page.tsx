import { I18nText } from "@/components/i18n/i18n-text";
import { PrintButton } from "@/components/ui/print-button";
import { loadPurchaseProjectKanbanData } from "@/features/purchases/project-kanban-data";
import { getSessionUserFromCookieValue } from "@/lib/app-users";
import { localeCookieName, resolveLocale } from "@/lib/i18n/config";
import { loadPurchaseProjectKanban } from "@/lib/purchase-project-kanban";
import { cookies } from "next/headers";
import Link from "next/link";

export const dynamic = "force-dynamic";

function parseStageIds(value?: string) {
  return new Set((value || "").split(",").map(Number).filter((id) => Number.isInteger(id) && id > 0));
}

export default async function PurchaseProjectKanbanPrintPage({ searchParams }: { searchParams?: { etapas?: string } }) {
  const cookieStore = cookies();
  const user = getSessionUserFromCookieValue(cookieStore.get("brasin_session")?.value);
  if (!user?.permissions.includes("screen.kanban-compras")) {
    return (
      <main className="kanban-print-page">
        <section className="card panel access-denied-panel">
          <div className="panel-head"><div><h2 className="panel-title"><I18nText text="Acesso não liberado" /></h2><span className="panel-note"><I18nText text="Seu usuário não tem permissão para esta tela" /></span></div></div>
        </section>
      </main>
    );
  }

  const board = loadPurchaseProjectKanban();
  const catalog = await loadPurchaseProjectKanbanData(board.projects.flatMap((project) => project.requestIds));
  const visibleRequestIds = new Set(catalog.requests.map((request) => request.id));
  const requestsById = new Map(catalog.requests.map((request) => [request.id, request]));
  const quotationsById = new Map(catalog.quotations.map((quotation) => [quotation.id, quotation]));
  const columnsById = new Map(board.columns.map((column) => [column.id, column]));
  const requestedStageIds = parseStageIds(searchParams?.etapas);
  const selectedColumns = board.columns.filter((column) => requestedStageIds.size === 0 || requestedStageIds.has(column.id));
  const selectedColumnIds = new Set(selectedColumns.map((column) => column.id));
  const projects = board.projects
    .filter((project) => selectedColumnIds.has(project.columnId))
    .map((project) => ({
      ...project,
      requestIds: project.requestIds.filter((requestId) => visibleRequestIds.has(requestId)),
      requestLinks: project.requestLinks.filter((link) => visibleRequestIds.has(link.requestId))
    }));
  const uniqueRequestIds = new Set(projects.flatMap((project) => project.requestIds));
  const uniqueQuotationIds = new Set(Array.from(uniqueRequestIds).flatMap((requestId) => requestsById.get(requestId)?.quotationIds || []));
  const locale = resolveLocale(cookieStore.get(localeCookieName)?.value);
  const formatDate = (value?: string) => value
    ? new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`))
    : undefined;

  return (
    <main className="kanban-print-page">
      <div className="kanban-print-actions">
        <Link className="button secondary" href="/kanban-compras"><I18nText text="Voltar ao Kanban" /></Link>
        <PrintButton />
      </div>

      <article className="kanban-print-document">
        <header className="kanban-print-header">
          <div><span><I18nText text="Brasin Empreendimentos - Suprimentos" /></span><h1><I18nText text="Relatório gerencial de compras por projeto" /></h1><p><I18nText text="Gerado em" /> {new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" }).format(new Date())}</p></div>
          <div className="kanban-print-summary">
            <span><strong>{selectedColumns.length}</strong><small><I18nText text="Etapas selecionadas" /></small></span>
            <span><strong>{projects.length}</strong><small><I18nText text="Projetos no relatório" /></small></span>
            <span><strong>{uniqueRequestIds.size}</strong><small>S.C.</small></span>
            <span><strong>{uniqueQuotationIds.size}</strong><small><I18nText text="Cotações relacionadas" /></small></span>
          </div>
        </header>

        <div className="kanban-print-stage-index">
          {selectedColumns.map((column) => <span key={column.id}><i className={`kanban-column-mark color-${column.color}`} />{column.systemKey ? <I18nText text={column.name} /> : column.name}</span>)}
        </div>

        {selectedColumns.map((column) => {
          const stageProjects = projects.filter((project) => project.columnId === column.id).sort((left, right) => left.position - right.position);
          return (
            <section className={`kanban-print-stage color-${column.color}`} key={column.id}>
              <header><div><i className={`kanban-column-mark color-${column.color}`} /><h2>{column.systemKey ? <I18nText text={column.name} /> : column.name}</h2>{column.isInitial && <em><I18nText text="Inicial" /></em>}{column.isCompleted && <em><I18nText text="Finalizada" /></em>}</div><strong>{stageProjects.length} <I18nText text={stageProjects.length === 1 ? "projeto" : "projetos"} /></strong></header>
              <div className="kanban-print-projects">
                {stageProjects.map((project) => {
                  const requestStageIds = new Map(project.requestLinks.map((link) => [link.requestId, link.columnId]));
                  const requestEntries = project.requestIds
                    .map((requestId) => ({ request: requestsById.get(requestId), stage: columnsById.get(requestStageIds.get(requestId) || 0) }))
                    .filter((entry): entry is { request: NonNullable<typeof entry.request>; stage: typeof entry.stage } => Boolean(entry.request))
                    .sort((left, right) => (left.stage?.position ?? Number.MAX_SAFE_INTEGER) - (right.stage?.position ?? Number.MAX_SAFE_INTEGER) || right.request.id - left.request.id);
                  return (
                    <section className="kanban-print-project" key={project.id}>
                      <header>
                        <div><h3>{project.name}</h3>{project.description && <p>{project.description}</p>}</div>
                        <span><small><I18nText text="Previsão de encerramento" /></small><strong>{formatDate(project.closingDate) || <I18nText text="Não informada" />}</strong></span>
                      </header>
                      <div className="kanban-print-request-list">
                        {requestEntries.map(({ request, stage }) => {
                          const itemNotes = request.items.filter((item) => item.notes);
                          const relatedQuotations = request.quotationIds.map((id) => quotationsById.get(id)).filter((quotation): quotation is NonNullable<typeof quotation> => Boolean(quotation));
                          return (
                            <section className="kanban-print-request" key={request.id}>
                              <header>
                                <div><strong>{request.code}</strong><span><I18nText text={request.status} /></span></div>
                                <div className="kanban-print-request-stage"><small><I18nText text="Etapa da solicitação" /></small><strong>{stage ? <><i className={`kanban-column-mark color-${stage.color}`} />{stage.systemKey ? <I18nText text={stage.name} /> : stage.name}</> : <I18nText text="Etapa não encontrada" />}</strong></div>
                              </header>
                              <div className="kanban-print-request-meta">
                                <span><small><I18nText text="Data da solicitação" /></small><strong>{formatDate(request.date) || <I18nText text="Não informada" />}</strong></span>
                                <span><small><I18nText text="Solicitante" /></small><strong>{request.requester || <I18nText text="Não informado" />}</strong></span>
                                <span><small><I18nText text="Itens solicitados" /></small><strong>{request.itemCount}</strong></span>
                                <span><small><I18nText text="Cotações relacionadas" /></small><strong>{request.quotationCount}</strong></span>
                              </div>
                              {relatedQuotations.length > 0 && <div className="kanban-print-quotation-statuses">{relatedQuotations.map((quotation) => <span key={quotation.id}><b>#{quotation.id}</b><I18nText text={quotation.status} /></span>)}</div>}
                              <div className="kanban-print-notes">
                                <div><strong><I18nText text="Observações da solicitação" /></strong><p>{request.notes || <I18nText text="Sem observações registradas." />}</p></div>
                                <div><strong><I18nText text="Observações dos itens" /></strong>{itemNotes.length > 0 ? <ul>{itemNotes.map((item) => <li key={`${request.id}:${item.number}`}><b>{item.productId ? `#${item.productId}` : `#${item.number}`} {item.description}{item.detail ? ` - ${item.detail}` : ""}</b><span>{item.notes}</span></li>)}</ul> : <p><I18nText text="Sem observações registradas." /></p>}</div>
                              </div>
                            </section>
                          );
                        })}
                        {requestEntries.length === 0 && <p className="kanban-print-empty"><I18nText text="Nenhuma solicitação vinculada a este projeto." /></p>}
                      </div>
                    </section>
                  );
                })}
                {stageProjects.length === 0 && <p className="kanban-print-empty"><I18nText text="Nenhum projeto encontrado nesta etapa." /></p>}
              </div>
            </section>
          );
        })}
      </article>
    </main>
  );
}
