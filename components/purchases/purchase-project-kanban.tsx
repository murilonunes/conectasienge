"use client";

import { I18nText } from "@/components/i18n/i18n-text";
import { useI18n } from "@/components/i18n/i18n-provider";
import type { PurchaseProjectKanbanData, PurchaseProjectKanbanQuotation, PurchaseProjectKanbanRequest } from "@/features/purchases/project-kanban-data";
import type { PurchaseProjectKanbanColumn, PurchaseProjectKanbanProject, PurchaseProjectKanbanState } from "@/lib/purchase-project-kanban";
import { purchaseProjectKanbanActions as actions } from "@/lib/purchase-project-kanban-actions";
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardList,
  Columns3,
  GripVertical,
  Flag,
  Link2,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Scale,
  Trash2,
  Unlink,
  X
} from "lucide-react";
import { useMemo, useState } from "react";

type Modal = "columns" | "create-project" | "quotation-links" | { projectId: number } | null;
type ProjectDetailView = "overview" | "edit" | "links";
type ApiInput = Record<string, string | number | undefined>;
type DragTarget = { columnId: number; beforeProjectId?: number };

function ProjectRequestRow({ request, stageControl, action }: { request: PurchaseProjectKanbanRequest; stageControl?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="kanban-request-row">
      <div className="kanban-request-main">
        <strong>{request.code}</strong>
        <span><I18nText text={request.status} /></span>
        {request.notes && <p>{request.notes}</p>}
      </div>
      <small className="kanban-request-item-count">{request.itemCount} <I18nText text={request.itemCount === 1 ? "item" : "itens"} /></small>
      <div className="kanban-request-quotations">
        <strong>{request.quotationCount} <I18nText text={request.quotationCount === 1 ? "cotação" : "cotações"} /></strong>
        {request.quotationIds.length > 0 && <span>{request.quotationIds.map((id) => `#${id}`).join(", ")}</span>}
      </div>
      {stageControl && <div className="kanban-request-stage-control">{stageControl}</div>}
      {action && <div className="kanban-request-action">{action}</div>}
    </div>
  );
}

function ProjectRequestOverview({ request, stage, stageControl, open, onOpenChange }: { request: PurchaseProjectKanbanRequest; stage?: PurchaseProjectKanbanColumn; stageControl?: React.ReactNode; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { formatDate, formatNumber } = useI18n();
  return (
    <details className="kanban-manager-record" open={open} onToggle={(event) => onOpenChange(event.currentTarget.open)}>
      <summary>
        <div><strong>{request.code}</strong><span><I18nText text={request.status} /></span>{stage && <em className="kanban-request-stage-badge"><i className={`kanban-column-mark color-${stage.color}`} />{stage.systemKey ? <I18nText text={stage.name} /> : stage.name}</em>}</div>
        <div className="kanban-manager-record-metrics"><span>{request.itemCount} <I18nText text={request.itemCount === 1 ? "item" : "itens"} /></span><span>{request.quotationCount} <I18nText text={request.quotationCount === 1 ? "cotação" : "cotações"} /></span>{stageControl && <div className="kanban-manager-record-stage-control" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>{stageControl}</div>}</div>
      </summary>
      <div className="kanban-manager-record-body">
        <div className="kanban-manager-meta">
          <span><small><I18nText text="Data da solicitação" /></small><strong>{request.date ? formatDate(`${request.date.slice(0, 10)}T12:00:00`) : <I18nText text="Não informada" />}</strong></span>
          <span><small><I18nText text="Solicitante" /></small><strong>{request.requester || <I18nText text="Não informado" />}</strong></span>
          <span><small><I18nText text="Cotações relacionadas" /></small><strong>{request.quotationIds.length ? request.quotationIds.map((id) => `#${id}`).join(", ") : <I18nText text="Nenhuma" />}</strong></span>
        </div>
        {request.notes && <div className="kanban-manager-note"><strong><I18nText text="Observações da solicitação" /></strong><p>{request.notes}</p></div>}
        <div className="kanban-manager-items">
          <header><strong><I18nText text="Itens solicitados" /></strong><span>{request.items.length}</span></header>
          {request.items.map((item) => (
            <div className="kanban-manager-item" key={`${request.id}:${item.number}`}>
              <span><small>{item.productId ? `#${item.productId}` : `#${item.number}`}</small><strong>{item.description}{item.detail ? ` - ${item.detail}` : ""}</strong>{item.notes && <em>{item.notes}</em>}</span>
              <span className="kanban-manager-item-values"><b>{formatNumber(item.quantity)} {item.unit || ""}</b>{item.deliveryDays !== undefined && <small><I18nText text="Prazo estimado" />: {item.deliveryDays} <I18nText text="dias" /></small>}</span>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

function ProjectQuotationOverview({ quotation, initiallyOpen = false }: { quotation: PurchaseProjectKanbanQuotation; initiallyOpen?: boolean }) {
  const { t, formatCurrency, formatDate, formatNumber } = useI18n();
  const pricedSuppliers = quotation.suppliers.filter((supplier) => supplier.totalValue > 0);
  const lowestValue = pricedSuppliers.length ? Math.min(...pricedSuppliers.map((supplier) => supplier.totalValue)) : 0;
  return (
    <details className="kanban-manager-record quotation" open={initiallyOpen || undefined}>
      <summary>
        <div><strong>#{quotation.id}</strong><span><I18nText text={quotation.status} /></span></div>
        <div className="kanban-manager-record-metrics"><span>{quotation.supplierCount} <I18nText text={quotation.supplierCount === 1 ? "fornecedor" : "fornecedores"} /></span><span>{quotation.responseCount} <I18nText text={quotation.responseCount === 1 ? "resposta" : "respostas"} /></span></div>
      </summary>
      <div className="kanban-manager-record-body">
        <div className="kanban-manager-meta two">
          <span><small><I18nText text="Data da cotação" /></small><strong>{quotation.date ? formatDate(`${quotation.date.slice(0, 10)}T12:00:00`) : <I18nText text="Não informada" />}</strong></span>
          <span><small><I18nText text="Menor proposta" /></small><strong>{lowestValue ? formatCurrency(lowestValue) : <I18nText text="Sem valor informado" />}</strong></span>
        </div>
        {quotation.notes && <div className="kanban-manager-note"><strong><I18nText text="Observações da cotação" /></strong><p>{quotation.notes}</p></div>}
        <div className="kanban-manager-items compact">
          <header><strong><I18nText text="Itens da cotação" /></strong><span>{quotation.items.length}</span></header>
          {quotation.items.map((item) => (
            <div className="kanban-manager-item" key={`${quotation.id}:${item.number}`}>
              <span><small>{item.productId ? `#${item.productId}` : `#${item.number}`}</small><strong>{item.description}{item.detail ? ` - ${item.detail}` : ""}</strong>{item.notes && <em>{item.notes}</em>}</span>
              <b>{formatNumber(item.quantity)} {item.unit || ""}</b>
            </div>
          ))}
          {quotation.items.length === 0 && <div className="kanban-list-empty"><I18nText text="Nenhum item disponível nesta cotação." /></div>}
        </div>
        <div className="kanban-manager-suppliers">
          <header><strong><I18nText text="Fornecedores e propostas" /></strong><span>{quotation.suppliers.length}</span></header>
          {quotation.suppliers.map((supplier, index) => {
            const supplierName = supplier.name || (supplier.id ? `${t("Fornecedor")} #${supplier.id}` : t("Fornecedor não informado"));
            return <div className={`kanban-manager-supplier${supplier.selected ? " selected" : ""}`} key={`${supplier.id || supplierName}:${index}`}>
              <span><strong>{supplierName}</strong><small>{supplier.responded ? <><I18nText text="Respondeu" /> · {supplier.quotedItems}/{quotation.items.length} <I18nText text="itens" /></> : <I18nText text="Aguardando resposta" />}</small></span>
              <span><b>{supplier.totalValue ? formatCurrency(supplier.totalValue) : <I18nText text="Sem valor" />}</b>{supplier.selected && <em><I18nText text="Selecionado" /></em>}{!supplier.selected && lowestValue > 0 && supplier.totalValue === lowestValue && <em><I18nText text="Menor proposta" /></em>}</span>
            </div>;
          })}
          {quotation.suppliers.length === 0 && <div className="kanban-list-empty"><I18nText text="Nenhum fornecedor vinculado à cotação." /></div>}
        </div>
      </div>
    </details>
  );
}

export function PurchaseProjectKanban({ initialBoard, catalog }: { initialBoard: PurchaseProjectKanbanState; catalog: PurchaseProjectKanbanData }) {
  const { t, formatDate } = useI18n();
  const [board, setBoard] = useState(initialBoard);
  const [requests, setRequests] = useState(catalog.requests);
  const [quotations, setQuotations] = useState(catalog.quotations);
  const [modal, setModal] = useState<Modal>(null);
  const [projectDetailView, setProjectDetailView] = useState<ProjectDetailView>("overview");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [draggedProjectId, setDraggedProjectId] = useState<number>();
  const [dragTarget, setDragTarget] = useState<DragTarget>();
  const [newColumnName, setNewColumnName] = useState("");
  const [columnNames, setColumnNames] = useState<Record<number, string>>({});
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectClosingDate, setProjectClosingDate] = useState("");
  const [requestQuery, setRequestQuery] = useState("");
  const [expandedRequestId, setExpandedRequestId] = useState<number>();
  const [quotationRequestSelections, setQuotationRequestSelections] = useState<Record<number, string>>({});
  const [requestProjectSelections, setRequestProjectSelections] = useState<Record<number, string>>({});

  const requestsById = useMemo(() => new Map(requests.map((request) => [request.id, request])), [requests]);
  const columnsById = useMemo(() => new Map(board.columns.map((column) => [column.id, column])), [board.columns]);
  const initialColumn = board.columns.find((column) => column.isInitial) || board.columns[0];
  const completedColumn = board.columns.find((column) => column.isCompleted) || board.columns[board.columns.length - 1];
  const assignedRequestIds = useMemo(() => new Set(board.projects.flatMap((project) => project.requestIds)), [board.projects]);
  const selectedProject = typeof modal === "object" && modal ? board.projects.find((project) => project.id === modal.projectId) : undefined;
  const selectedRequestEntries = (selectedProject?.requestLinks || []).map((link) => ({ link, request: requestsById.get(link.requestId), column: columnsById.get(link.columnId) }))
    .filter((entry): entry is { link: { requestId: number; columnId: number }; request: PurchaseProjectKanbanRequest; column: PurchaseProjectKanbanColumn | undefined } => Boolean(entry.request))
    .sort((left, right) => (left.column?.position ?? 0) - (right.column?.position ?? 0) || right.request.id - left.request.id);
  const selectedRequests = selectedRequestEntries.map((entry) => entry.request);
  const selectedRequestIds = new Set(selectedProject?.requestIds || []);
  const selectedQuotations = quotations.filter((quotation) => quotation.requestIds.some((requestId) => selectedRequestIds.has(requestId)));
  const expandedRequestEntry = selectedRequestEntries.find((entry) => entry.request.id === expandedRequestId);
  const expandedRequestQuotations = expandedRequestEntry
    ? selectedQuotations.filter((quotation) => quotation.requestIds.includes(expandedRequestEntry.request.id) || expandedRequestEntry.request.quotationIds.includes(quotation.id))
    : [];
  const selectedItemCount = selectedRequests.reduce((sum, request) => sum + request.itemCount, 0);
  const selectedSupplierCount = new Set(selectedQuotations.flatMap((quotation) => quotation.suppliers.map((supplier) => supplier.id ? `id:${supplier.id}` : `name:${supplier.name}`))).size;
  const selectedResponseCount = selectedQuotations.reduce((sum, quotation) => sum + quotation.responseCount, 0);
  const selectedCoverage = selectedRequests.length ? Math.round((selectedRequests.filter((request) => request.quotationCount > 0).length / selectedRequests.length) * 100) : 0;
  const selectedProjectColumn = selectedProject ? board.columns.find((column) => column.id === selectedProject.columnId) : undefined;
  const selectedBacklogRequests = selectedRequestEntries.filter((entry) => (entry.column?.position ?? 0) < (initialColumn?.position ?? 0)).length;
  const selectedCompletedRequests = selectedRequestEntries.filter((entry) => (entry.column?.position ?? 0) >= (completedColumn?.position ?? Number.MAX_SAFE_INTEGER)).length;
  const selectedStartedRequests = Math.max(0, selectedRequestEntries.length - selectedBacklogRequests - selectedCompletedRequests);
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
  const completedColumnIds = new Set(board.columns.filter((column) => column.position >= (completedColumn?.position ?? Number.MAX_SAFE_INTEGER)).map((column) => column.id));
  const backlogProjects = board.projects.filter((project) => (columnsById.get(project.columnId)?.position ?? 0) < (initialColumn?.position ?? 0));
  const completedProjects = board.projects.filter((project) => completedColumnIds.has(project.columnId));
  const startedProjects = board.projects.filter((project) => {
    const position = columnsById.get(project.columnId)?.position ?? 0;
    return position >= (initialColumn?.position ?? 0) && position < (completedColumn?.position ?? Number.MAX_SAFE_INTEGER);
  });
  const overdueProjects = board.projects.filter((project) => project.closingDate && project.closingDate < todayIso && !completedColumnIds.has(project.columnId));
  const pendingQuotations = quotations.filter((quotation) => quotation.requestIds.length === 0 || quotation.requestIds.some((requestId) => !assignedRequestIds.has(requestId)));
  const quotationsInProjects = quotations.filter((quotation) => quotation.requestIds.length > 0 && quotation.requestIds.every((requestId) => assignedRequestIds.has(requestId))).length;

  function withVisibleRequests(nextBoard: PurchaseProjectKanbanState): PurchaseProjectKanbanState {
    return {
      ...nextBoard,
      projects: nextBoard.projects.map((project) => ({
        ...project,
        requestIds: project.requestIds.filter((requestId) => requestsById.has(requestId)),
        requestLinks: project.requestLinks.filter((link) => requestsById.has(link.requestId))
      }))
    };
  }

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
      const nextBoard = withVisibleRequests({ columns: body.columns, projects: body.projects });
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
      setBoard(withVisibleRequests(body));
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
    setExpandedRequestId(undefined);
    setMessage("");
    setProjectDetailView("overview");
    setModal({ projectId: project.id });
  }

  async function createProject() {
    if (await updateBoard({ action: actions.createProject, name: projectName, description: projectDescription, closingDate: projectClosingDate })) setModal(null);
  }

  async function saveProject() {
    if (!selectedProject) return;
    if (await updateBoard({ action: actions.updateProject, projectId: selectedProject.id, name: projectName, description: projectDescription, closingDate: projectClosingDate })) setProjectDetailView("overview");
  }

  async function deleteProject() {
    if (!selectedProject || !window.confirm(t("Excluir este projeto? As solicitações serão apenas desvinculadas e continuarão no sistema."))) return;
    if (await updateBoard({ action: actions.deleteProject, projectId: selectedProject.id })) setModal(null);
  }

  async function moveProject(projectId: number, columnId: number, requestedPosition?: number) {
    const project = board.projects.find((item) => item.id === projectId);
    if (!project) return;
    const targetProjects = board.projects.filter((item) => item.columnId === columnId && item.id !== projectId);
    const position = Math.max(0, Math.min(requestedPosition ?? targetProjects.length, targetProjects.length));
    const currentProjects = board.projects.filter((item) => item.columnId === project.columnId);
    if (project.columnId === columnId && currentProjects.findIndex((item) => item.id === projectId) === position) return;
    const previousBoard = board;
    setBoard((current) => ({
      ...current,
      projects: current.columns.flatMap((column) => {
        const columnProjects = current.projects.filter((item) => item.columnId === column.id && item.id !== projectId);
        if (column.id !== columnId) return columnProjects.map((item, index) => ({ ...item, position: index }));
        columnProjects.splice(position, 0, { ...project, columnId, position, updatedAt: new Date().toISOString() });
        return columnProjects.map((item, index) => ({ ...item, position: index }));
      })
    }));
    if (!await updateBoard({ action: actions.moveProject, projectId, columnId, position })) setBoard(previousBoard);
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
    setDragTarget(undefined);
  }

  function finishProjectDrag() {
    setDraggedProjectId(undefined);
    setDragTarget(undefined);
  }

  function dragProjectOverColumn(event: React.DragEvent<HTMLElement>, columnId: number) {
    if (!draggedProjectId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const cards = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-kanban-project-id]"))
      .filter((card) => Number(card.dataset.kanbanProjectId) !== draggedProjectId);
    const beforeCard = cards.find((card) => {
      const bounds = card.getBoundingClientRect();
      return event.clientY < bounds.top + bounds.height / 2;
    });
    const nextTarget = { columnId, beforeProjectId: beforeCard ? Number(beforeCard.dataset.kanbanProjectId) : undefined };
    setDragTarget((current) => current?.columnId === nextTarget.columnId && current.beforeProjectId === nextTarget.beforeProjectId ? current : nextTarget);
  }

  function dropProject(event: React.DragEvent<HTMLElement>, columnId: number) {
    event.preventDefault();
    const projectId = Number(event.dataTransfer.getData("text/plain")) || draggedProjectId;
    const targetProjects = board.projects.filter((project) => project.columnId === columnId && project.id !== projectId);
    const beforeProjectId = dragTarget?.columnId === columnId ? dragTarget.beforeProjectId : undefined;
    const beforeIndex = beforeProjectId ? targetProjects.findIndex((project) => project.id === beforeProjectId) : -1;
    const position = beforeIndex >= 0 ? beforeIndex : targetProjects.length;
    finishProjectDrag();
    if (projectId) void moveProject(projectId, columnId, position);
  }

  async function addColumn() {
    const nextBoard = await updateBoard({ action: actions.createColumn, name: newColumnName });
    if (nextBoard) {
      setNewColumnName("");
      setColumnNames(Object.fromEntries(nextBoard.columns.map((column) => [column.id, column.name])));
    }
  }

  async function renameColumn(columnId: number) {
    const name = (columnNames[columnId] || "").trim();
    const column = board.columns.find((item) => item.id === columnId);
    if (!column || !name || name === column.name) return;
    const nextBoard = await updateBoard({ action: actions.renameColumn, columnId, name });
    const savedColumn = nextBoard?.columns.find((item) => item.id === columnId);
    if (savedColumn) setColumnNames((current) => ({ ...current, [columnId]: savedColumn.name }));
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
        <div><ClipboardList size={17} /><span><I18nText text="Backlog" /></span><strong>{backlogProjects.length}</strong></div>
        <div><Flag size={17} /><span><I18nText text="Projetos iniciados" /></span><strong>{startedProjects.length}</strong></div>
        <div><CheckCircle2 size={17} /><span><I18nText text="Projetos concluídos" /></span><strong>{completedProjects.length}</strong></div>
        <div><Link2 size={17} /><span><I18nText text="Solicitações vinculadas" /></span><strong>{linkedRequests}</strong></div>
        <div><Scale size={17} /><span><I18nText text="Cotações nos projetos" /></span><strong>{quotationsInProjects}</strong></div>
        <div className={pendingQuotations.length ? "warn" : ""}><AlertTriangle size={17} /><span><I18nText text="Cotações com vínculo pendente" /></span><strong>{pendingQuotations.length}</strong></div>
        <div className={overdueProjects.length ? "warn" : ""}><CalendarClock size={17} /><span><I18nText text="Encerramentos em atraso" /></span><strong>{overdueProjects.length}</strong></div>
      </div>

      <div className="purchase-kanban-board" style={{ gridTemplateColumns: `repeat(${Math.max(board.columns.length, 1)}, minmax(285px, 1fr))` }}>
        {board.columns.map((column) => {
          const projects = filteredProjects.filter((project) => project.columnId === column.id);
          const draggedProject = draggedProjectId ? board.projects.find((project) => project.id === draggedProjectId) : undefined;
          const isDropTarget = dragTarget?.columnId === column.id;
          const dropPreview = isDropTarget && draggedProject ? (
            <div className="purchase-kanban-drop-preview" aria-hidden="true">
              <GripVertical size={15} />
              <div><strong>{draggedProject.name}</strong><span><I18nText text="Solte nesta posição" /></span></div>
            </div>
          ) : null;
          return (
            <section
              className={`purchase-kanban-column color-${column.color}${isDropTarget ? " drop-target" : ""}`}
              key={column.id}
              onDragEnter={(event) => dragProjectOverColumn(event, column.id)}
              onDragOver={(event) => dragProjectOverColumn(event, column.id)}
              onDrop={(event) => dropProject(event, column.id)}
            >
              <header><span className="kanban-column-mark" /><h2>{columnLabel(column)}{column.isInitial && <em><Flag size={10} /><I18nText text="Inicial" /></em>}{column.isCompleted && <em><CheckCircle2 size={10} /><I18nText text="Finalizada" /></em>}</h2><strong>{projects.length}</strong></header>
              <div className="purchase-kanban-column-body">
                {projects.map((project) => {
                  const requests = project.requestIds.map((id) => requestsById.get(id)).filter((item): item is PurchaseProjectKanbanRequest => Boolean(item));
                  const itemCount = requests.reduce((sum, request) => sum + request.itemCount, 0);
                  const quotationCount = new Set(requests.flatMap((request) => request.quotationIds)).size;
                  const quotedCount = requests.filter((request) => request.quotationCount > 0).length;
                  const coverage = requests.length ? Math.round((quotedCount / requests.length) * 100) : 0;
                  const requestStages = new Map(project.requestLinks.map((link) => [link.requestId, columnsById.get(link.columnId)]));
                  return (
                    <div className="purchase-kanban-card-slot" key={project.id}>
                      {isDropTarget && dragTarget?.beforeProjectId === project.id && dropPreview}
                      <article data-kanban-project-id={project.id} className={`purchase-kanban-card${draggedProjectId === project.id ? " dragging" : ""}${project.closingDate && project.closingDate < todayIso && !completedColumnIds.has(project.columnId) ? " overdue" : ""}`} draggable={!busy} onDragStart={(event) => startProjectDrag(event, project.id)} onDragEnd={finishProjectDrag} onClick={() => openProject(project)}>
                        <div className="purchase-kanban-card-head"><GripVertical size={15} /><div><h3>{project.name}</h3>{project.description && <p>{project.description}</p>}</div><button type="button" onClick={(event) => { event.stopPropagation(); openProject(project); }} title="Editar projeto" data-i18n-title="Editar projeto"><Pencil size={14} /></button></div>
                        {project.closingDate && <div className="purchase-kanban-deadline"><CalendarClock size={13} /><span><I18nText text="Previsão de encerramento" /></span><strong>{displayDate(project.closingDate)}</strong>{project.closingDate < todayIso && !completedColumnIds.has(project.columnId) && <em><I18nText text="Em atraso" /></em>}</div>}
                        <div className="purchase-kanban-card-metrics">
                          <span><strong>{requests.length}</strong><small>S.C.</small></span>
                          <span><strong>{itemCount}</strong><small><I18nText text="Itens" /></small></span>
                          <span><strong>{quotationCount}</strong><small><I18nText text="Cotações" /></small></span>
                        </div>
                        <div className="purchase-kanban-coverage"><span><I18nText text="Cobertura de cotação" /><strong>{coverage}%</strong></span><i><b style={{ width: `${coverage}%` }} /></i></div>
                        <div className="purchase-kanban-request-summary">{requests.slice(0, 4).map((request) => { const requestStage = requestStages.get(request.id); return <span key={request.id}><b>{requestStage && <i className={`kanban-column-mark color-${requestStage.color}`} />}{request.code}</b><small>{requestStage ? <>{requestStage.systemKey ? <I18nText text={requestStage.name} /> : requestStage.name} · </> : null}{request.quotationCount} <I18nText text={request.quotationCount === 1 ? "cotação" : "cotações"} /></small></span>; })}{requests.length > 4 && <span><b>+{requests.length - 4}</b><small><I18nText text="solicitações" /></small></span>}</div>
                        <label onClick={(event) => event.stopPropagation()}><I18nText text="Etapa" /><select value={project.columnId} onChange={(event) => void moveProject(project.id, Number(event.target.value))} disabled={busy}>{board.columns.map((option) => <option key={option.id} value={option.id}>{columnLabel(option)}</option>)}</select></label>
                      </article>
                    </div>
                  );
                })}
                {isDropTarget && !dragTarget?.beforeProjectId && dropPreview}
                {projects.length === 0 && !isDropTarget && <div className="purchase-kanban-empty"><BriefcaseBusiness size={22} /><span><I18nText text={normalizedQuery ? "Nenhum projeto encontrado nesta etapa." : "Arraste um projeto para esta etapa."} /></span></div>}
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
            <header className="settings-modal-head"><div><h2><I18nText text="Etapas do Kanban" /></h2><span><I18nText text="Crie, renomeie e ordene as colunas e defina onde o trabalho começa e termina." /></span></div><button className="kanban-icon-button" onClick={() => setModal(null)} title="Fechar" data-i18n-title="Fechar"><X size={17} /></button></header>
            <div className="kanban-column-editor">
              {board.columns.map((column, index) => {
                const draftName = columnNames[column.id] ?? column.name;
                return (
                  <div key={column.id}>
                    <span className={`kanban-column-mark color-${column.color}`} />
                    <input aria-label={`${t("Nome da etapa")}: ${columnLabel(column)}`} value={draftName} onChange={(event) => setColumnNames((current) => ({ ...current, [column.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void renameColumn(column.id); } }} maxLength={80} />
                    <button className="kanban-column-save" type="button" onClick={() => void renameColumn(column.id)} disabled={busy || !draftName.trim() || draftName.trim() === column.name} title="Salvar nome" data-i18n-title="Salvar nome"><Save size={14} /><I18nText text="Salvar nome" /></button>
                    <div className="kanban-stage-markers">
                      <button className={`kanban-stage-flag initial${column.isInitial ? " active" : ""}`} type="button" onClick={() => void updateBoard({ action: actions.setColumnMarker, columnId: column.id, marker: "initial" })} disabled={busy || column.isInitial} title="Definir como etapa inicial" data-i18n-title="Definir como etapa inicial"><Flag size={13} /><I18nText text="Inicial" /></button>
                      <button className={`kanban-stage-flag completed${column.isCompleted ? " active" : ""}`} type="button" onClick={() => void updateBoard({ action: actions.setColumnMarker, columnId: column.id, marker: "completed" })} disabled={busy || column.isCompleted} title="Definir como etapa finalizada" data-i18n-title="Definir como etapa finalizada"><CheckCircle2 size={13} /><I18nText text="Finalizada" /></button>
                    </div>
                    <button className="kanban-column-left" type="button" onClick={() => void updateBoard({ action: actions.reorderColumn, columnId: column.id, direction: "left" })} disabled={busy || index === 0} title="Mover para a esquerda" data-i18n-title="Mover para a esquerda"><ArrowLeft size={15} /></button>
                    <button className="kanban-column-right" type="button" onClick={() => void updateBoard({ action: actions.reorderColumn, columnId: column.id, direction: "right" })} disabled={busy || index === board.columns.length - 1} title="Mover para a direita" data-i18n-title="Mover para a direita"><ArrowRight size={15} /></button>
                    <button className="kanban-column-delete danger" type="button" onClick={() => window.confirm(t("Excluir esta etapa?")) && void updateBoard({ action: actions.deleteColumn, columnId: column.id })} disabled={busy} title="Excluir etapa" data-i18n-title="Excluir etapa"><Trash2 size={15} /></button>
                  </div>
                );
              })}
            </div>
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
            <header className="settings-modal-head kanban-project-detail-head">
              <div><h2>{selectedProject.name}</h2><span><I18nText text={projectDetailView === "overview" ? "Visão gerencial consolidada do projeto." : projectDetailView === "edit" ? "Edite os dados e a etapa do projeto." : "Adicione ou remova solicitações vinculadas ao projeto."} /></span></div>
              <div className="kanban-project-detail-actions">
                {projectDetailView === "overview" ? <><button className="button secondary" onClick={() => setProjectDetailView("edit")}><Pencil size={14} /> <I18nText text="Editar dados" /></button><button className="button secondary" onClick={() => setProjectDetailView("links")}><Link2 size={14} /> <I18nText text="Gerenciar vínculos" /></button></> : <button className="button secondary" onClick={() => setProjectDetailView("overview")}><ArrowLeft size={14} /> <I18nText text="Voltar à visão gerencial" /></button>}
                <button className="kanban-icon-button" onClick={() => setModal(null)} title="Fechar" data-i18n-title="Fechar"><X size={17} /></button>
              </div>
            </header>

            {projectDetailView === "overview" && (
              <div className="kanban-manager-overview">
                <div className="kanban-manager-project-summary">
                  <div><span className={`kanban-column-mark color-${selectedProjectColumn?.color || "neutral"}`} /><strong>{selectedProjectColumn ? columnLabel(selectedProjectColumn) : <I18nText text="Etapa não encontrada" />}</strong></div>
                  <div><CalendarClock size={14} /><span><I18nText text="Previsão de encerramento" /></span><strong>{selectedProject.closingDate ? displayDate(selectedProject.closingDate) : <I18nText text="Não informada" />}</strong>{selectedProject.closingDate && selectedProject.closingDate < todayIso && !completedColumnIds.has(selectedProject.columnId) && <em><I18nText text="Em atraso" /></em>}</div>
                  {selectedProject.description && <p>{selectedProject.description}</p>}
                </div>
                <div className="kanban-manager-kpis">
                  <div><span><I18nText text="Solicitações" /></span><strong>{selectedRequests.length}</strong></div>
                  <div><span><I18nText text="Itens solicitados" /></span><strong>{selectedItemCount}</strong></div>
                  <div><span><I18nText text="Cotações relacionadas" /></span><strong>{selectedQuotations.length}</strong></div>
                  <div><span><I18nText text="Fornecedores" /></span><strong>{selectedSupplierCount}</strong></div>
                  <div><span><I18nText text="Respostas recebidas" /></span><strong>{selectedResponseCount}</strong></div>
                  <div><span><I18nText text="Cobertura de cotação" /></span><strong>{selectedCoverage}%</strong></div>
                </div>
                <div className="kanban-manager-request-stages">
                  <strong><I18nText text="Etapas das solicitações" /></strong>
                  <span><i className="backlog" /><small><I18nText text="Backlog" /></small><b>{selectedBacklogRequests}</b></span>
                  <span><i className="started" /><small><I18nText text="Iniciadas" /></small><b>{selectedStartedRequests}</b></span>
                  <span><i className="completed" /><small><I18nText text="Concluídas" /></small><b>{selectedCompletedRequests}</b></span>
                </div>
                <div className={`kanban-manager-columns${expandedRequestEntry ? "" : " single"}`}>
                  <section>
                    <header><div><h3><I18nText text="Solicitações do projeto" /></h3><span><I18nText text="Abra uma solicitação para consultar seus itens, observações e cotações relacionadas." /></span></div><strong>{selectedRequests.length}</strong></header>
                    <div className="kanban-manager-record-list">{selectedRequestEntries.map((entry) => <ProjectRequestOverview key={entry.request.id} request={entry.request} stage={entry.column} stageControl={<label><span><I18nText text="Etapa da solicitação" /></span><select aria-label={`${t("Etapa da solicitação")}: ${entry.request.code}`} value={entry.link.columnId} onChange={(event) => void updateBoard({ action: actions.moveRequest, projectId: selectedProject.id, requestId: entry.request.id, columnId: Number(event.target.value) })} disabled={busy}>{board.columns.map((column) => <option key={column.id} value={column.id}>{columnLabel(column)}</option>)}</select></label>} open={expandedRequestId === entry.request.id} onOpenChange={(open) => setExpandedRequestId((current) => open ? entry.request.id : current === entry.request.id ? undefined : current)} />)}{selectedRequests.length === 0 && <div className="kanban-list-empty"><I18nText text="Nenhuma solicitação vinculada a este projeto." /></div>}</div>
                  </section>
                  {expandedRequestEntry && <section>
                    <header><div><h3><I18nText text="Cotações relacionadas" /> · {expandedRequestEntry.request.code}</h3><span><I18nText text="Exibindo somente as cotações da solicitação aberta." /></span></div><strong>{expandedRequestQuotations.length}</strong></header>
                    <div className="kanban-manager-record-list">{expandedRequestQuotations.map((quotation, index) => <ProjectQuotationOverview key={quotation.id} quotation={quotation} initiallyOpen={index === 0} />)}{expandedRequestQuotations.length === 0 && <div className="kanban-list-empty"><I18nText text="Nenhuma cotação relacionada a esta solicitação." /></div>}</div>
                  </section>}
                </div>
              </div>
            )}

            {projectDetailView === "edit" && (
              <div className="kanban-project-edit-view">
                <section><h3><I18nText text="Dados do projeto" /></h3><div className="kanban-project-form"><label><span><I18nText text="Nome do projeto" /> *</span><input value={projectName} onChange={(event) => setProjectName(event.target.value)} maxLength={80} /></label><label><span><I18nText text="Previsão de encerramento" /></span><input type="date" value={projectClosingDate} onChange={(event) => setProjectClosingDate(event.target.value)} /></label><label><span><I18nText text="Descrição" /></span><textarea value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} maxLength={300} rows={5} /></label><label><span><I18nText text="Etapa atual" /></span><select value={selectedProject.columnId} onChange={(event) => void moveProject(selectedProject.id, Number(event.target.value))}>{board.columns.map((column) => <option key={column.id} value={column.id}>{columnLabel(column)}</option>)}</select></label><button className="button" onClick={saveProject} disabled={busy || !projectName.trim()}>{busy ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} <I18nText text="Salvar dados" /></button></div></section>
              </div>
            )}

            {projectDetailView === "links" && (
              <div className="kanban-project-links-view">
                <section><div className="kanban-modal-section-head"><div><h3><I18nText text="Solicitações vinculadas" /></h3><small>{selectedRequests.length} <I18nText text={selectedRequests.length === 1 ? "solicitação" : "solicitações"} /></small></div></div><div className="kanban-request-list">{selectedRequestEntries.map((entry) => <ProjectRequestRow key={entry.request.id} request={entry.request} stageControl={<label><span><I18nText text="Etapa da solicitação" /></span><select value={entry.link.columnId} onChange={(event) => void updateBoard({ action: actions.moveRequest, projectId: selectedProject.id, requestId: entry.request.id, columnId: Number(event.target.value) })} disabled={busy}>{board.columns.map((column) => <option key={column.id} value={column.id}>{columnLabel(column)}</option>)}</select></label>} action={<button onClick={() => void updateBoard({ action: actions.unlinkRequest, projectId: selectedProject.id, requestId: entry.request.id })} disabled={busy} title="Desvincular solicitação" data-i18n-title="Desvincular solicitação"><Unlink size={14} /></button>} />)}{selectedRequests.length === 0 && <div className="kanban-list-empty"><I18nText text="Nenhuma solicitação vinculada a este projeto." /></div>}</div></section>
                <section className="kanban-available-requests"><div className="kanban-modal-section-head"><div><h3><I18nText text="Adicionar solicitações" /></h3><small><I18nText text="Somente solicitações ainda não vinculadas a outro projeto." /></small></div><div className="purchase-kanban-search compact"><Search size={14} /><input value={requestQuery} onChange={(event) => setRequestQuery(event.target.value)} placeholder="Buscar solicitação" data-i18n-placeholder="Buscar solicitação" /></div></div><div className="kanban-request-list available">{availableRequests.slice(0, 100).map((request) => <ProjectRequestRow key={request.id} request={request} action={<button onClick={() => void updateBoard({ action: actions.linkRequest, projectId: selectedProject.id, requestId: request.id, columnId: board.columns[0]?.id })} disabled={busy} title="Vincular solicitação" data-i18n-title="Vincular solicitação"><Link2 size={14} /></button>} />)}{availableRequests.length === 0 && <div className="kanban-list-empty"><I18nText text="Nenhuma solicitação disponível." /></div>}</div>{availableRequests.length > 100 && <small className="kanban-result-limit"><I18nText text="Refine a busca para ver outros resultados." /></small>}</section>
              </div>
            )}
            {message && <div className="kanban-feedback error"><I18nText text={message} /></div>}
            <footer className={`settings-modal-actions${projectDetailView === "edit" ? " split" : ""}`}>{projectDetailView === "edit" && <button className="button danger" onClick={deleteProject} disabled={busy}><Trash2 size={15} /> <I18nText text="Excluir projeto" /></button>}<button className="button secondary" onClick={() => setModal(null)}><I18nText text="Concluir" /></button></footer>
          </div>
        </div>
      )}
    </section>
  );
}
