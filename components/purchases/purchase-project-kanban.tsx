"use client";

import { I18nText } from "@/components/i18n/i18n-text";
import { useI18n } from "@/components/i18n/i18n-provider";
import type { PurchaseProjectKanbanData, PurchaseProjectKanbanRequest } from "@/features/purchases/project-kanban-data";
import type { PurchaseProjectKanbanProject, PurchaseProjectKanbanState } from "@/lib/purchase-project-kanban";
import { purchaseProjectKanbanActions as actions } from "@/lib/purchase-project-kanban-actions";
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  ClipboardList,
  Columns3,
  GripVertical,
  Link2,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Scale,
  Trash2,
  Unlink,
  X
} from "lucide-react";
import { useMemo, useState } from "react";

type Modal = "columns" | "create-project" | "quotation-links" | { projectId: number } | null;
type ApiInput = Record<string, string | number | undefined>;

function ProjectRequestRow({ request, action }: { request: PurchaseProjectKanbanRequest; action?: React.ReactNode }) {
  return (
    <div className="kanban-request-row">
      <div>
        <strong>{request.code}</strong>
        <span><I18nText text={request.status} /></span>
        {request.notes && <p>{request.notes}</p>}
      </div>
      <small>{request.itemCount} <I18nText text={request.itemCount === 1 ? "item" : "itens"} /></small>
      <div className="kanban-request-quotations">
        <strong>{request.quotationCount} <I18nText text={request.quotationCount === 1 ? "cotação" : "cotações"} /></strong>
        {request.quotationIds.length > 0 && <span>{request.quotationIds.map((id) => `#${id}`).join(", ")}</span>}
      </div>
      {action}
    </div>
  );
}

export function PurchaseProjectKanban({ initialBoard, catalog }: { initialBoard: PurchaseProjectKanbanState; catalog: PurchaseProjectKanbanData }) {
  const { t, formatDate } = useI18n();
  const [board, setBoard] = useState(initialBoard);
  const [requests, setRequests] = useState(catalog.requests);
  const [quotations, setQuotations] = useState(catalog.quotations);
  const [modal, setModal] = useState<Modal>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [draggedProjectId, setDraggedProjectId] = useState<number>();
  const [dragTargetColumnId, setDragTargetColumnId] = useState<number>();
  const [newColumnName, setNewColumnName] = useState("");
  const [columnNames, setColumnNames] = useState<Record<number, string>>({});
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectClosingDate, setProjectClosingDate] = useState("");
  const [requestQuery, setRequestQuery] = useState("");
  const [quotationRequestSelections, setQuotationRequestSelections] = useState<Record<number, string>>({});
  const [requestProjectSelections, setRequestProjectSelections] = useState<Record<number, string>>({});

  const requestsById = useMemo(() => new Map(requests.map((request) => [request.id, request])), [requests]);
  const assignedRequestIds = useMemo(() => new Set(board.projects.flatMap((project) => project.requestIds)), [board.projects]);
  const selectedProject = typeof modal === "object" && modal ? board.projects.find((project) => project.id === modal.projectId) : undefined;
  const selectedRequests = selectedProject?.requestIds.map((id) => requestsById.get(id)).filter((item): item is PurchaseProjectKanbanRequest => Boolean(item)) || [];
  const availableRequests = requests.filter((request) => {
    if (assignedRequestIds.has(request.id)) return false;
    const normalized = requestQuery.trim().toLocaleLowerCase("pt-BR");
    return !normalized || `${request.code} ${request.status} ${request.requester || ""}`.toLocaleLowerCase("pt-BR").includes(normalized);
  });
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const filteredProjects = board.projects.filter((project) => {
    const requestCodes = project.requestIds.map((id) => requestsById.get(id)?.code || "").join(" ");
    return !normalizedQuery || `${project.name} ${project.description} ${requestCodes}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
  });
  const linkedRequests = board.projects.reduce((sum, project) => sum + project.requestIds.length, 0);
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const completedColumnIds = new Set(board.columns.filter((column) => column.systemKey === "completed").map((column) => column.id));
  const overdueProjects = board.projects.filter((project) => project.closingDate && project.closingDate < todayIso && !completedColumnIds.has(project.columnId));
  const pendingQuotations = quotations.filter((quotation) => quotation.requestIds.length === 0 || quotation.requestIds.some((requestId) => !assignedRequestIds.has(requestId)));
  const quotationsInProjects = quotations.filter((quotation) => quotation.requestIds.length > 0 && quotation.requestIds.every((requestId) => assignedRequestIds.has(requestId))).length;

  async function updateBoard(input: ApiInput) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/purchases/project-kanban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const body = await response.json() as PurchaseProjectKanbanState & { message?: string };
      if (!response.ok) throw new Error(body.message || t("Não foi possível atualizar o Kanban."));
      const nextBoard = { columns: body.columns, projects: body.projects };
      setBoard(nextBoard);
      return nextBoard;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("Não foi possível atualizar o Kanban."));
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function reloadBoard() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/purchases/project-kanban", { cache: "no-store" });
      const body = await response.json() as PurchaseProjectKanbanState & { message?: string };
      if (!response.ok) throw new Error(body.message || t("Não foi possível recarregar o Kanban."));
      setBoard(body);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("Não foi possível recarregar o Kanban."));
    } finally { setBusy(false); }
  }

  function openColumns() {
    setColumnNames(Object.fromEntries(board.columns.map((column) => [column.id, column.name])));
    setNewColumnName("");
    setMessage("");
    setModal("columns");
  }

  function openCreateProject() {
    setProjectName("");
    setProjectDescription("");
    setProjectClosingDate("");
    setMessage("");
    setModal("create-project");
  }

  function openProject(project: PurchaseProjectKanbanProject) {
    setProjectName(project.name);
    setProjectDescription(project.description);
    setProjectClosingDate(project.closingDate || "");
    setRequestQuery("");
    setMessage("");
    setModal({ projectId: project.id });
  }

  async function createProject() {
    if (await updateBoard({ action: actions.createProject, name: projectName, description: projectDescription, closingDate: projectClosingDate })) setModal(null);
  }

  async function saveProject() {
    if (!selectedProject) return;
    await updateBoard({ action: actions.updateProject, projectId: selectedProject.id, name: projectName, description: projectDescription, closingDate: projectClosingDate });
  }

  async function deleteProject() {
    if (!selectedProject || !window.confirm(t("Excluir este projeto? As solicitações serão apenas desvinculadas e continuarão no sistema."))) return;
    if (await updateBoard({ action: actions.deleteProject, projectId: selectedProject.id })) setModal(null);
  }

  async function moveProject(projectId: number, columnId: number) {
    const project = board.projects.find((item) => item.id === projectId);
    if (!project || project.columnId === columnId) return;
    const previousBoard = board;
    setBoard((current) => ({
      ...current,
      projects: [
        { ...project, columnId, updatedAt: new Date().toISOString() },
        ...current.projects.filter((item) => item.id !== projectId)
      ]
    }));
    if (!await updateBoard({ action: actions.moveProject, projectId, columnId })) setBoard(previousBoard);
  }

  function startProjectDrag(event: React.DragEvent<HTMLElement>, projectId: number) {
    const project = board.projects.find((item) => item.id === projectId);
    if (!project) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(projectId));

    const dragImage = event.currentTarget.cloneNode(true) as HTMLElement;
    dragImage.classList.add("purchase-kanban-drag-image");
    dragImage.style.width = `${event.currentTarget.getBoundingClientRect().width}px`;
    document.body.appendChild(dragImage);
    event.dataTransfer.setDragImage(dragImage, 24, 24);
    window.requestAnimationFrame(() => dragImage.remove());

    setDraggedProjectId(projectId);
    setDragTargetColumnId(undefined);
  }

  function finishProjectDrag() {
    setDraggedProjectId(undefined);
    setDragTargetColumnId(undefined);
  }

  function dragProjectOverColumn(event: React.DragEvent<HTMLElement>, columnId: number) {
    if (!draggedProjectId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const sourceColumnId = board.projects.find((project) => project.id === draggedProjectId)?.columnId;
    setDragTargetColumnId(sourceColumnId === columnId ? undefined : columnId);
  }

  function dropProject(event: React.DragEvent<HTMLElement>, columnId: number) {
    event.preventDefault();
    const projectId = Number(event.dataTransfer.getData("text/plain")) || draggedProjectId;
    finishProjectDrag();
    if (projectId) void moveProject(projectId, columnId);
  }

  async function addColumn() {
    const nextBoard = await updateBoard({ action: actions.createColumn, name: newColumnName });
    if (nextBoard) {
      setNewColumnName("");
      setColumnNames(Object.fromEntries(nextBoard.columns.map((column) => [column.id, column.name])));
    }
  }

  function columnLabel(column: PurchaseProjectKanbanState["columns"][number]) {
    return column.systemKey ? t(column.name) : column.name;
  }

  function displayDate(value: string) {
    return formatDate(`${value}T12:00:00`, { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  async function linkQuotationToRequest(quotationId: number) {
    const requestId = Number(quotationRequestSelections[quotationId]);
    if (!requestId) return;
    const nextBoard = await updateBoard({ action: actions.linkQuotationRequest, quotationId, requestId });
    if (!nextBoard) return;
    setQuotations((current) => current.map((quotation) => quotation.id === quotationId
      ? { ...quotation, requestIds: Array.from(new Set([...quotation.requestIds, requestId])) }
      : quotation));
    setRequests((current) => current.map((request) => request.id === requestId && !request.quotationIds.includes(quotationId)
      ? { ...request, quotationIds: [quotationId, ...request.quotationIds].sort((left, right) => right - left), quotationCount: request.quotationCount + 1 }
      : request));
  }

  return (
    <section className="purchase-kanban-page">
      <div className="purchase-kanban-toolbar">
        <div className="purchase-kanban-search">
          <Search size={16} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar projeto ou solicitação" data-i18n-placeholder="Buscar projeto ou solicitação" />
        </div>
        <button className="kanban-icon-button" type="button" onClick={reloadBoard} disabled={busy} title="Recarregar quadro" data-i18n-title="Recarregar quadro"><RefreshCw size={16} /></button>
        <button className={`button secondary kanban-link-pending-button ${pendingQuotations.length ? "warn" : ""}`} type="button" onClick={() => { setMessage(""); setModal("quotation-links"); }}><AlertTriangle size={16} /> <I18nText text="Pendências de vínculo" /> <strong>{pendingQuotations.length}</strong></button>
        <button className="button secondary" type="button" onClick={openColumns}><Columns3 size={16} /> <I18nText text="Gerenciar etapas" /></button>
        <button className="button" type="button" onClick={openCreateProject}><Plus size={16} /> <I18nText text="Novo projeto" /></button>
      </div>

      {(catalog.error || catalog.warning || message) && <div className={`kanban-feedback ${catalog.error || message ? "error" : ""}`}><I18nText text={message || catalog.error || catalog.warning || ""} /></div>}

      <div className="purchase-kanban-stats" aria-label="Resumo gerencial" data-i18n-aria-label="Resumo gerencial">
        <div><BriefcaseBusiness size={17} /><span><I18nText text="Projetos" /></span><strong>{board.projects.length}</strong></div>
        <div><ClipboardList size={17} /><span><I18nText text="Solicitações vinculadas" /></span><strong>{linkedRequests}</strong></div>
        <div><Scale size={17} /><span><I18nText text="Cotações nos projetos" /></span><strong>{quotationsInProjects}</strong></div>
        <div className={pendingQuotations.length ? "warn" : ""}><AlertTriangle size={17} /><span><I18nText text="Cotações com vínculo pendente" /></span><strong>{pendingQuotations.length}</strong></div>
        <div><Link2 size={17} /><span><I18nText text="Solicitações disponíveis" /></span><strong>{Math.max(0, requests.length - linkedRequests)}</strong></div>
        <div className={overdueProjects.length ? "warn" : ""}><CalendarClock size={17} /><span><I18nText text="Encerramentos em atraso" /></span><strong>{overdueProjects.length}</strong></div>
      </div>

      <div className="purchase-kanban-board" style={{ gridTemplateColumns: `repeat(${Math.max(board.columns.length, 1)}, minmax(285px, 1fr))` }}>
        {board.columns.map((column) => {
          const projects = filteredProjects.filter((project) => project.columnId === column.id);
          const draggedProject = draggedProjectId ? board.projects.find((project) => project.id === draggedProjectId) : undefined;
          const isDropTarget = dragTargetColumnId === column.id;
          return (
            <section
              className={`purchase-kanban-column color-${column.color}${isDropTarget ? " drop-target" : ""}`}
              key={column.id}
              onDragEnter={(event) => dragProjectOverColumn(event, column.id)}
              onDragOver={(event) => dragProjectOverColumn(event, column.id)}
              onDrop={(event) => dropProject(event, column.id)}
            >
              <header><span className="kanban-column-mark" /><h2>{columnLabel(column)}</h2><strong>{projects.length}</strong></header>
              <div className="purchase-kanban-column-body">
                {isDropTarget && draggedProject && (
                  <div className="purchase-kanban-drop-preview" aria-hidden="true">
                    <GripVertical size={15} />
                    <div><strong>{draggedProject.name}</strong><span><I18nText text="Solte para mover para esta etapa" /></span></div>
                  </div>
                )}
                {projects.map((project) => {
                  const requests = project.requestIds.map((id) => requestsById.get(id)).filter((item): item is PurchaseProjectKanbanRequest => Boolean(item));
                  const itemCount = requests.reduce((sum, request) => sum + request.itemCount, 0);
                  const quotationCount = new Set(requests.flatMap((request) => request.quotationIds)).size;
                  const quotedCount = requests.filter((request) => request.quotationCount > 0).length;
                  const coverage = requests.length ? Math.round((quotedCount / requests.length) * 100) : 0;
                  return (
                    <article className={`purchase-kanban-card${draggedProjectId === project.id ? " dragging" : ""}${project.closingDate && project.closingDate < todayIso && !completedColumnIds.has(project.columnId) ? " overdue" : ""}`} key={project.id} draggable onDragStart={(event) => startProjectDrag(event, project.id)} onDragEnd={finishProjectDrag} onClick={() => openProject(project)}>
                      <div className="purchase-kanban-card-head"><GripVertical size={15} /><div><h3>{project.name}</h3>{project.description && <p>{project.description}</p>}</div><button type="button" onClick={(event) => { event.stopPropagation(); openProject(project); }} title="Editar projeto" data-i18n-title="Editar projeto"><Pencil size={14} /></button></div>
                      {project.closingDate && <div className="purchase-kanban-deadline"><CalendarClock size={13} /><span><I18nText text="Previsão de encerramento" /></span><strong>{displayDate(project.closingDate)}</strong>{project.closingDate < todayIso && !completedColumnIds.has(project.columnId) && <em><I18nText text="Em atraso" /></em>}</div>}
                      <div className="purchase-kanban-card-metrics">
                        <span><strong>{requests.length}</strong><I18nText text="Solicitações" /></span>
                        <span><strong>{itemCount}</strong><I18nText text="Itens" /></span>
                        <span><strong>{quotationCount}</strong><I18nText text="Cotações" /></span>
                      </div>
                      <div className="purchase-kanban-coverage"><span><I18nText text="Cobertura de cotação" /><strong>{coverage}%</strong></span><i><b style={{ width: `${coverage}%` }} /></i></div>
                      <div className="purchase-kanban-request-summary">{requests.slice(0, 4).map((request) => <span key={request.id}><b>{request.code}</b><small>{request.quotationCount} <I18nText text={request.quotationCount === 1 ? "cotação" : "cotações"} /></small></span>)}{requests.length > 4 && <span><b>+{requests.length - 4}</b><small><I18nText text="solicitações" /></small></span>}</div>
                      <label onClick={(event) => event.stopPropagation()}><I18nText text="Etapa" /><select value={project.columnId} onChange={(event) => void moveProject(project.id, Number(event.target.value))} disabled={busy}>{board.columns.map((option) => <option key={option.id} value={option.id}>{columnLabel(option)}</option>)}</select></label>
                    </article>
                  );
                })}
                {projects.length === 0 && <div className="purchase-kanban-empty"><BriefcaseBusiness size={22} /><span><I18nText text={normalizedQuery ? "Nenhum projeto encontrado nesta etapa." : "Arraste um projeto para esta etapa."} /></span></div>}
              </div>
            </section>
          );
        })}
      </div>

      {modal === "create-project" && (
        <div className="settings-modal-backdrop" role="presentation" onMouseDown={() => !busy && setModal(null)}>
          <div className="settings-modal kanban-project-modal" role="dialog" aria-modal="true" aria-label="Novo projeto" data-i18n-aria-label="Novo projeto" onMouseDown={(event) => event.stopPropagation()}>
            <header className="settings-modal-head"><div><h2><I18nText text="Novo projeto" /></h2><span><I18nText text="Cadastre a obra ou iniciativa gerencialmente, sem criar registros no Sienge." /></span></div><button className="kanban-icon-button" onClick={() => setModal(null)} title="Fechar" data-i18n-title="Fechar"><X size={17} /></button></header>
            <div className="kanban-project-form"><label><span><I18nText text="Nome do projeto" /> *</span><input autoFocus value={projectName} onChange={(event) => setProjectName(event.target.value)} maxLength={80} /></label><label><span><I18nText text="Previsão de encerramento" /></span><input type="date" value={projectClosingDate} onChange={(event) => setProjectClosingDate(event.target.value)} /></label><label><span><I18nText text="Descrição" /></span><textarea value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} maxLength={300} rows={4} placeholder="Objetivo, fase da obra ou referência interna" data-i18n-placeholder="Objetivo, fase da obra ou referência interna" /></label></div>
            {message && <div className="kanban-feedback error"><I18nText text={message} /></div>}
            <footer className="settings-modal-actions"><button className="button secondary" onClick={() => setModal(null)}><I18nText text="Cancelar" /></button><button className="button" onClick={createProject} disabled={busy || !projectName.trim()}>{busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} <I18nText text="Criar projeto" /></button></footer>
          </div>
        </div>
      )}

      {modal === "columns" && (
        <div className="settings-modal-backdrop" role="presentation" onMouseDown={() => !busy && setModal(null)}>
          <div className="settings-modal kanban-columns-modal" role="dialog" aria-modal="true" aria-label="Gerenciar etapas" data-i18n-aria-label="Gerenciar etapas" onMouseDown={(event) => event.stopPropagation()}>
            <header className="settings-modal-head"><div><h2><I18nText text="Etapas do Kanban" /></h2><span><I18nText text="Crie, renomeie e ordene as colunas conforme o processo dos projetos." /></span></div><button className="kanban-icon-button" onClick={() => setModal(null)} title="Fechar" data-i18n-title="Fechar"><X size={17} /></button></header>
            <div className="kanban-column-editor">{board.columns.map((column, index) => <div key={column.id}><span className={`kanban-column-mark color-${column.color}`} /><input value={columnNames[column.id] ?? column.name} onChange={(event) => setColumnNames((current) => ({ ...current, [column.id]: event.target.value }))} maxLength={80} /><button onClick={() => void updateBoard({ action: actions.renameColumn, columnId: column.id, name: columnNames[column.id] ?? column.name })} disabled={busy || (columnNames[column.id] ?? column.name).trim() === column.name} title="Salvar nome" data-i18n-title="Salvar nome"><Check size={15} /></button><button onClick={() => void updateBoard({ action: actions.reorderColumn, columnId: column.id, direction: "left" })} disabled={busy || index === 0} title="Mover para a esquerda" data-i18n-title="Mover para a esquerda"><ArrowLeft size={15} /></button><button onClick={() => void updateBoard({ action: actions.reorderColumn, columnId: column.id, direction: "right" })} disabled={busy || index === board.columns.length - 1} title="Mover para a direita" data-i18n-title="Mover para a direita"><ArrowRight size={15} /></button><button className="danger" onClick={() => window.confirm(t("Excluir esta etapa?")) && void updateBoard({ action: actions.deleteColumn, columnId: column.id })} disabled={busy} title="Excluir etapa" data-i18n-title="Excluir etapa"><Trash2 size={15} /></button></div>)}</div>
            <div className="kanban-add-column"><input value={newColumnName} onChange={(event) => setNewColumnName(event.target.value)} placeholder="Nome da nova etapa" data-i18n-placeholder="Nome da nova etapa" maxLength={80} onKeyDown={(event) => { if (event.key === "Enter") void addColumn(); }} /><button className="button" onClick={addColumn} disabled={busy || !newColumnName.trim()}><Plus size={15} /> <I18nText text="Adicionar etapa" /></button></div>
            {message && <div className="kanban-feedback error"><I18nText text={message} /></div>}
            <footer className="settings-modal-actions"><button className="button secondary" onClick={() => setModal(null)}><I18nText text="Concluir" /></button></footer>
          </div>
        </div>
      )}

      {modal === "quotation-links" && (
        <div className="settings-modal-backdrop" role="presentation" onMouseDown={() => !busy && setModal(null)}>
          <div className="settings-modal kanban-quotation-links-modal" role="dialog" aria-modal="true" aria-label="Pendências de vínculo das cotações" data-i18n-aria-label="Pendências de vínculo das cotações" onMouseDown={(event) => event.stopPropagation()}>
            <header className="settings-modal-head"><div><h2><I18nText text="Pendências de vínculo" /></h2><span><I18nText text="Confira a solicitação de origem de cada cotação e em qual projeto ela está incluída." /></span></div><button className="kanban-icon-button" onClick={() => setModal(null)} title="Fechar" data-i18n-title="Fechar"><X size={17} /></button></header>
            <div className="kanban-link-summary">
              <span><strong>{pendingQuotations.filter((quotation) => quotation.requestIds.length === 0).length}</strong><I18nText text="Sem solicitação de origem" /></span>
              <span><strong>{pendingQuotations.filter((quotation) => quotation.requestIds.length > 0).length}</strong><I18nText text="Com solicitação fora de projeto" /></span>
            </div>
            <div className="kanban-quotation-pending-list">
              {pendingQuotations.map((quotation) => {
                const unassignedRequestIds = quotation.requestIds.filter((requestId) => !assignedRequestIds.has(requestId));
                return (
                  <article className="kanban-quotation-pending" key={quotation.id}>
                    <header><div><strong>#{quotation.id}</strong><span><I18nText text={quotation.status} /></span></div><small>{quotation.supplierCount} <I18nText text={quotation.supplierCount === 1 ? "fornecedor" : "fornecedores"} /> · {quotation.responseCount} <I18nText text={quotation.responseCount === 1 ? "resposta" : "respostas"} />{quotation.date ? ` · ${displayDate(quotation.date.slice(0, 10))}` : ""}</small></header>
                    {quotation.requestIds.length === 0 ? (
                      <div className="kanban-link-resolution">
                        <div><AlertTriangle size={15} /><span><strong><I18nText text="Cotação sem solicitação de origem" /></strong><small><I18nText text="Selecione a solicitação que gerou esta cotação." /></small></span></div>
                        <select value={quotationRequestSelections[quotation.id] || ""} onChange={(event) => setQuotationRequestSelections((current) => ({ ...current, [quotation.id]: event.target.value }))}>
                          <option value="">{t("Selecionar solicitação")}</option>
                          {requests.map((request) => <option key={request.id} value={request.id}>{request.code} · {request.quotationCount} {t(request.quotationCount === 1 ? "cotação" : "cotações")}</option>)}
                        </select>
                        <button className="button secondary" onClick={() => void linkQuotationToRequest(quotation.id)} disabled={busy || !quotationRequestSelections[quotation.id]}><Link2 size={14} /> <I18nText text="Vincular à solicitação" /></button>
                      </div>
                    ) : (
                      <div className="kanban-quotation-origins">
                        {quotation.requestIds.map((requestId) => {
                          const request = requestsById.get(requestId);
                          const assignedProject = board.projects.find((project) => project.requestIds.includes(requestId));
                          return (
                            <div className={assignedProject ? "resolved" : "pending"} key={requestId}>
                              <span><strong>{request?.code || `SC-${requestId}`}</strong><small>{request ? `${request.quotationCount} ${t(request.quotationCount === 1 ? "cotação" : "cotações")}` : t("Solicitação não encontrada no espelho local")}</small></span>
                              {assignedProject ? <em><Check size={13} /> {assignedProject.name}</em> : request ? <><select value={requestProjectSelections[requestId] || ""} onChange={(event) => setRequestProjectSelections((current) => ({ ...current, [requestId]: event.target.value }))}><option value="">{t("Selecionar projeto")}</option>{board.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><button className="button secondary" onClick={() => void updateBoard({ action: actions.linkRequest, projectId: Number(requestProjectSelections[requestId]), requestId })} disabled={busy || !requestProjectSelections[requestId]}><BriefcaseBusiness size={14} /> <I18nText text="Adicionar ao projeto" /></button></> : <em className="error"><AlertTriangle size={13} /> <I18nText text="Origem indisponível" /></em>}
                            </div>
                          );
                        })}
                        {unassignedRequestIds.length === 0 && <div className="kanban-list-empty"><I18nText text="Todas as solicitações desta cotação já estão em projetos." /></div>}
                      </div>
                    )}
                  </article>
                );
              })}
              {pendingQuotations.length === 0 && <div className="kanban-links-complete"><Check size={26} /><strong><I18nText text="Todos os vínculos estão organizados" /></strong><span><I18nText text="Todas as cotações possuem solicitação de origem e projeto definido." /></span></div>}
            </div>
            {message && <div className="kanban-feedback error"><I18nText text={message} /></div>}
            <footer className="settings-modal-actions"><button className="button secondary" onClick={() => setModal(null)}><I18nText text="Concluir" /></button></footer>
          </div>
        </div>
      )}

      {selectedProject && (
        <div className="settings-modal-backdrop" role="presentation" onMouseDown={() => !busy && setModal(null)}>
          <div className="settings-modal kanban-project-detail-modal" role="dialog" aria-modal="true" aria-label="Detalhes do projeto" data-i18n-aria-label="Detalhes do projeto" onMouseDown={(event) => event.stopPropagation()}>
            <header className="settings-modal-head"><div><h2>{selectedProject.name}</h2><span><I18nText text="Gerencie o projeto e as solicitações de compra vinculadas." /></span></div><button className="kanban-icon-button" onClick={() => setModal(null)} title="Fechar" data-i18n-title="Fechar"><X size={17} /></button></header>
            <div className="kanban-project-detail-grid">
              <section><h3><I18nText text="Dados do projeto" /></h3><div className="kanban-project-form"><label><span><I18nText text="Nome do projeto" /> *</span><input value={projectName} onChange={(event) => setProjectName(event.target.value)} maxLength={80} /></label><label><span><I18nText text="Previsão de encerramento" /></span><input type="date" value={projectClosingDate} onChange={(event) => setProjectClosingDate(event.target.value)} /></label><label><span><I18nText text="Descrição" /></span><textarea value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} maxLength={300} rows={4} /></label><label><span><I18nText text="Etapa atual" /></span><select value={selectedProject.columnId} onChange={(event) => void moveProject(selectedProject.id, Number(event.target.value))}>{board.columns.map((column) => <option key={column.id} value={column.id}>{columnLabel(column)}</option>)}</select></label><button className="button secondary" onClick={saveProject} disabled={busy || !projectName.trim()}><Check size={15} /> <I18nText text="Salvar dados" /></button></div></section>
              <section><div className="kanban-modal-section-head"><div><h3><I18nText text="Solicitações vinculadas" /></h3><small>{selectedRequests.length} <I18nText text={selectedRequests.length === 1 ? "solicitação" : "solicitações"} /></small></div></div><div className="kanban-request-list">{selectedRequests.map((request) => <ProjectRequestRow key={request.id} request={request} action={<button onClick={() => void updateBoard({ action: actions.unlinkRequest, projectId: selectedProject.id, requestId: request.id })} disabled={busy} title="Desvincular solicitação" data-i18n-title="Desvincular solicitação"><Unlink size={14} /></button>} />)}{selectedRequests.length === 0 && <div className="kanban-list-empty"><I18nText text="Nenhuma solicitação vinculada a este projeto." /></div>}</div></section>
              <section className="kanban-available-requests"><div className="kanban-modal-section-head"><div><h3><I18nText text="Adicionar solicitações" /></h3><small><I18nText text="Somente solicitações ainda não vinculadas a outro projeto." /></small></div><div className="purchase-kanban-search compact"><Search size={14} /><input value={requestQuery} onChange={(event) => setRequestQuery(event.target.value)} placeholder="Buscar solicitação" data-i18n-placeholder="Buscar solicitação" /></div></div><div className="kanban-request-list available">{availableRequests.slice(0, 100).map((request) => <ProjectRequestRow key={request.id} request={request} action={<button onClick={() => void updateBoard({ action: actions.linkRequest, projectId: selectedProject.id, requestId: request.id })} disabled={busy} title="Vincular solicitação" data-i18n-title="Vincular solicitação"><Link2 size={14} /></button>} />)}{availableRequests.length === 0 && <div className="kanban-list-empty"><I18nText text="Nenhuma solicitação disponível." /></div>}</div>{availableRequests.length > 100 && <small className="kanban-result-limit"><I18nText text="Refine a busca para ver outros resultados." /></small>}</section>
            </div>
            {message && <div className="kanban-feedback error"><I18nText text={message} /></div>}
            <footer className="settings-modal-actions split"><button className="button danger" onClick={deleteProject} disabled={busy}><Trash2 size={15} /> <I18nText text="Excluir projeto" /></button><button className="button secondary" onClick={() => setModal(null)}><I18nText text="Concluir" /></button></footer>
          </div>
        </div>
      )}
    </section>
  );
}
