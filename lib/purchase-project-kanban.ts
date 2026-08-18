import "server-only";
import { randomUUID } from "crypto";
import { mkdirSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";

export type PurchaseProjectKanbanColumn = { id: number; name: string; color: string; position: number; isInitial: boolean; isCompleted: boolean; systemKey?: string };
export type PurchaseProjectKanbanRequestLink = { requestId: number; columnId: number };
export type PurchaseProjectKanbanProject = {
  id: number;
  key: string;
  name: string;
  description: string;
  closingDate?: string;
  columnId: number;
  position: number;
  requestIds: number[];
  requestLinks: PurchaseProjectKanbanRequestLink[];
  createdAt: string;
  updatedAt: string;
};
export type PurchaseProjectKanbanState = {
  columns: PurchaseProjectKanbanColumn[];
  projects: PurchaseProjectKanbanProject[];
};

const dataDir = path.join(process.cwd(), ".sienge-data");
const databasePath = path.join(dataDir, "purchase-project-kanban.sqlite");
const defaultColumns = [
  { key: "unclassified", name: "Não classificado", color: "neutral", isInitial: false, isCompleted: false },
  { key: "planning", name: "Planejamento", color: "blue", isInitial: true, isCompleted: false },
  { key: "quotation", name: "Em cotação", color: "amber", isInitial: false, isCompleted: false },
  { key: "contracting", name: "Contratação", color: "violet", isInitial: false, isCompleted: false },
  { key: "completed", name: "Concluído", color: "teal", isInitial: false, isCompleted: true }
];
const columnColors = ["neutral", "blue", "amber", "violet", "teal", "rose"];

function nowIso() { return new Date().toISOString(); }

function openDatabase() {
  mkdirSync(dataDir, { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 8000;
    CREATE TABLE IF NOT EXISTS purchase_project_kanban_columns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      system_key TEXT,
      position INTEGER NOT NULL,
      is_initial INTEGER NOT NULL DEFAULT 0,
      is_completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_project_kanban_columns_position
      ON purchase_project_kanban_columns(position);
    CREATE TABLE IF NOT EXISTS purchase_project_kanban_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      closing_date TEXT,
      column_id INTEGER NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(column_id) REFERENCES purchase_project_kanban_columns(id) ON DELETE RESTRICT
    );
    CREATE TABLE IF NOT EXISTS purchase_project_kanban_requests (
      project_id INTEGER NOT NULL,
      purchase_request_id INTEGER NOT NULL UNIQUE,
      column_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY(project_id, purchase_request_id),
      FOREIGN KEY(project_id) REFERENCES purchase_project_kanban_projects(id) ON DELETE CASCADE,
      FOREIGN KEY(column_id) REFERENCES purchase_project_kanban_columns(id) ON DELETE RESTRICT
    );
    CREATE INDEX IF NOT EXISTS idx_purchase_project_kanban_projects_column
      ON purchase_project_kanban_projects(column_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_project_kanban_requests_project
      ON purchase_project_kanban_requests(project_id);
    CREATE TABLE IF NOT EXISTS purchase_project_kanban_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  const columnFields = database.prepare("PRAGMA table_info(purchase_project_kanban_columns)").all() as Array<{ name: string }>;
  if (!columnFields.some((field) => field.name === "system_key")) {
    database.exec("ALTER TABLE purchase_project_kanban_columns ADD COLUMN system_key TEXT");
  }
  if (!columnFields.some((field) => field.name === "is_initial")) {
    database.exec("ALTER TABLE purchase_project_kanban_columns ADD COLUMN is_initial INTEGER NOT NULL DEFAULT 0");
  }
  if (!columnFields.some((field) => field.name === "is_completed")) {
    database.exec("ALTER TABLE purchase_project_kanban_columns ADD COLUMN is_completed INTEGER NOT NULL DEFAULT 0");
  }
  const projectFields = database.prepare("PRAGMA table_info(purchase_project_kanban_projects)").all() as Array<{ name: string }>;
  if (!projectFields.some((field) => field.name === "closing_date")) {
    database.exec("ALTER TABLE purchase_project_kanban_projects ADD COLUMN closing_date TEXT");
  }
  if (!projectFields.some((field) => field.name === "position")) {
    database.exec("ALTER TABLE purchase_project_kanban_projects ADD COLUMN position INTEGER NOT NULL DEFAULT 0");
    const rows = database.prepare("SELECT id, column_id AS columnId FROM purchase_project_kanban_projects ORDER BY column_id, updated_at DESC, id DESC")
      .all() as Array<{ id: number; columnId: number }>;
    const nextPosition = new Map<number, number>();
    const updatePosition = database.prepare("UPDATE purchase_project_kanban_projects SET position = ? WHERE id = ?");
    rows.forEach((row) => {
      const position = nextPosition.get(row.columnId) || 0;
      updatePosition.run(position, row.id);
      nextPosition.set(row.columnId, position + 1);
    });
  }
  database.exec("CREATE INDEX IF NOT EXISTS idx_purchase_project_kanban_projects_position ON purchase_project_kanban_projects(column_id, position)");
  const count = Number((database.prepare("SELECT COUNT(*) AS count FROM purchase_project_kanban_columns").get() as { count: number }).count);
  if (count === 0) {
    const insert = database.prepare("INSERT INTO purchase_project_kanban_columns (name, color, system_key, position, is_initial, is_completed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    const stamp = nowIso();
    defaultColumns.forEach((column, index) => insert.run(column.name, column.color, column.key, index, Number(column.isInitial), Number(column.isCompleted), stamp, stamp));
  }
  const systemKeyMigration = database.prepare("SELECT value FROM purchase_project_kanban_metadata WHERE key = 'system-key-migration'").get();
  if (!systemKeyMigration) {
    const restoreSystemKey = database.prepare(`
      UPDATE purchase_project_kanban_columns
      SET system_key = ?
      WHERE system_key IS NULL AND name = ? AND color = ? AND position = ?
    `);
    defaultColumns.forEach((column, index) => restoreSystemKey.run(column.key, column.name, column.color, index));
    database.prepare("INSERT INTO purchase_project_kanban_metadata (key, value) VALUES ('system-key-migration', '1')").run();
  }
  const initialCount = Number((database.prepare("SELECT COUNT(*) AS count FROM purchase_project_kanban_columns WHERE is_initial = 1").get() as { count: number }).count);
  if (initialCount === 0) {
    database.prepare(`UPDATE purchase_project_kanban_columns SET is_initial = 1 WHERE id = COALESCE(
      (SELECT id FROM purchase_project_kanban_columns WHERE system_key = 'planning' LIMIT 1),
      (SELECT id FROM purchase_project_kanban_columns ORDER BY position, id LIMIT 1)
    )`).run();
  }
  const completedCount = Number((database.prepare("SELECT COUNT(*) AS count FROM purchase_project_kanban_columns WHERE is_completed = 1").get() as { count: number }).count);
  if (completedCount === 0) {
    database.prepare(`UPDATE purchase_project_kanban_columns SET is_completed = 1 WHERE id = COALESCE(
      (SELECT id FROM purchase_project_kanban_columns WHERE system_key = 'completed' LIMIT 1),
      (SELECT id FROM purchase_project_kanban_columns ORDER BY position DESC, id DESC LIMIT 1)
    )`).run();
  }
  const requestFields = database.prepare("PRAGMA table_info(purchase_project_kanban_requests)").all() as Array<{ name: string }>;
  if (!requestFields.some((field) => field.name === "column_id")) {
    database.exec("ALTER TABLE purchase_project_kanban_requests ADD COLUMN column_id INTEGER");
    database.exec(`UPDATE purchase_project_kanban_requests
      SET column_id = (SELECT projects.column_id FROM purchase_project_kanban_projects projects WHERE projects.id = purchase_project_kanban_requests.project_id)`);
  }
  database.exec(`UPDATE purchase_project_kanban_requests SET column_id = (
    SELECT id FROM purchase_project_kanban_columns ORDER BY position, id LIMIT 1
  ) WHERE column_id IS NULL OR column_id NOT IN (SELECT id FROM purchase_project_kanban_columns)`);
  database.exec("CREATE INDEX IF NOT EXISTS idx_purchase_project_kanban_requests_column ON purchase_project_kanban_requests(column_id)");
  return database;
}

function normalizeName(value: string, kind: "etapa" | "projeto" = "etapa") {
  const name = value.trim().replace(/\s+/g, " ");
  if (!name) throw new Error(`Informe o nome ${kind === "projeto" ? "do projeto" : "da etapa"}.`);
  if (name.length > 80) throw new Error(`O nome ${kind === "projeto" ? "do projeto" : "da etapa"} deve ter no máximo 80 caracteres.`);
  return name;
}

function normalizeDescription(value: string) {
  const description = value.trim().replace(/\s+/g, " ");
  if (description.length > 300) throw new Error("A descrição deve ter no máximo 300 caracteres.");
  return description;
}

function normalizeClosingDate(value: string) {
  const closingDate = value.trim();
  if (!closingDate) return undefined;
  const parsed = new Date(`${closingDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(closingDate) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== closingDate) {
    throw new Error("Informe uma data de encerramento válida.");
  }
  return closingDate;
}

function readState(database: DatabaseSync): PurchaseProjectKanbanState {
  const columnRows = database.prepare("SELECT id, name, color, system_key AS systemKey, position, is_initial AS isInitial, is_completed AS isCompleted FROM purchase_project_kanban_columns ORDER BY position, id").all() as Array<Omit<PurchaseProjectKanbanColumn, "isInitial" | "isCompleted" | "systemKey"> & { systemKey: string | null; isInitial: number; isCompleted: number }>;
  const columns = columnRows.map((column) => ({ ...column, isInitial: Boolean(column.isInitial), isCompleted: Boolean(column.isCompleted), systemKey: column.systemKey || undefined }));
  const projects = database.prepare(`
    SELECT id, project_key AS key, name, description, closing_date AS closingDate,
           column_id AS columnId, position, created_at AS createdAt, updated_at AS updatedAt
    FROM purchase_project_kanban_projects ORDER BY column_id, position, id
  `).all() as Array<Omit<PurchaseProjectKanbanProject, "requestIds">>;
  const links = database.prepare(`
    SELECT project_id AS projectId, purchase_request_id AS requestId, column_id AS columnId
    FROM purchase_project_kanban_requests ORDER BY purchase_request_id DESC
  `).all() as Array<{ projectId: number; requestId: number; columnId: number }>;
  const requestsByProject = new Map<number, PurchaseProjectKanbanRequestLink[]>();
  links.forEach((link) => requestsByProject.set(link.projectId, [...(requestsByProject.get(link.projectId) || []), { requestId: link.requestId, columnId: link.columnId }]));
  return { columns, projects: projects.map((project) => {
    const requestLinks = requestsByProject.get(project.id) || [];
    return { ...project, requestIds: requestLinks.map((link) => link.requestId), requestLinks };
  }) };
}

export function loadPurchaseProjectKanban() {
  const database = openDatabase();
  try { return readState(database); } finally { database.close(); }
}

export function createPurchaseProjectKanbanColumn(nameValue: string) {
  const name = normalizeName(nameValue);
  const database = openDatabase();
  try {
    if (database.prepare("SELECT id FROM purchase_project_kanban_columns WHERE lower(name) = lower(?)").get(name)) throw new Error("Já existe uma etapa com esse nome.");
    const position = Number((database.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS position FROM purchase_project_kanban_columns").get() as { position: number }).position);
    const stamp = nowIso();
    database.prepare("INSERT INTO purchase_project_kanban_columns (name, color, system_key, position, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?)")
      .run(name, columnColors[position % columnColors.length], position, stamp, stamp);
    return readState(database);
  } finally { database.close(); }
}

export function renamePurchaseProjectKanbanColumn(columnId: number, nameValue: string) {
  const name = normalizeName(nameValue);
  const database = openDatabase();
  try {
    if (database.prepare("SELECT id FROM purchase_project_kanban_columns WHERE lower(name) = lower(?) AND id <> ?").get(name, columnId)) throw new Error("Já existe uma etapa com esse nome.");
    if (database.prepare("UPDATE purchase_project_kanban_columns SET name = ?, system_key = NULL, updated_at = ? WHERE id = ?").run(name, nowIso(), columnId).changes === 0) throw new Error("Etapa não encontrada.");
    return readState(database);
  } finally { database.close(); }
}

export function setPurchaseProjectKanbanColumnMarker(columnId: number, marker: "initial" | "completed") {
  const database = openDatabase();
  try {
    const columns = readState(database).columns;
    const column = columns.find((item) => item.id === columnId);
    if (!column) throw new Error("Etapa não encontrada.");
    const otherMarker = marker === "initial"
      ? columns.find((item) => item.isCompleted)
      : columns.find((item) => item.isInitial);
    if (otherMarker && (marker === "initial" ? column.position >= otherMarker.position : column.position <= otherMarker.position)) {
      throw new Error(marker === "initial" ? "A etapa inicial deve ficar antes da etapa finalizada." : "A etapa finalizada deve ficar depois da etapa inicial.");
    }
    const field = marker === "initial" ? "is_initial" : "is_completed";
    database.exec("BEGIN IMMEDIATE");
    try {
      database.prepare(`UPDATE purchase_project_kanban_columns SET ${field} = 0`).run();
      database.prepare(`UPDATE purchase_project_kanban_columns SET ${field} = 1, updated_at = ? WHERE id = ?`).run(nowIso(), columnId);
      database.exec("COMMIT");
    } catch (error) { database.exec("ROLLBACK"); throw error; }
    return readState(database);
  } finally { database.close(); }
}

export function reorderPurchaseProjectKanbanColumn(columnId: number, direction: "left" | "right") {
  const database = openDatabase();
  try {
    const columns = readState(database).columns;
    const index = columns.findIndex((column) => column.id === columnId);
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (index < 0) throw new Error("Etapa não encontrada.");
    if (targetIndex < 0 || targetIndex >= columns.length) return readState(database);
    const current = columns[index];
    const target = columns[targetIndex];
    const reorderedColumns = [...columns];
    [reorderedColumns[index], reorderedColumns[targetIndex]] = [reorderedColumns[targetIndex], reorderedColumns[index]];
    if (reorderedColumns.findIndex((column) => column.isInitial) >= reorderedColumns.findIndex((column) => column.isCompleted)) {
      throw new Error("A etapa inicial deve permanecer antes da etapa finalizada.");
    }
    database.exec("BEGIN IMMEDIATE");
    try {
      database.prepare("UPDATE purchase_project_kanban_columns SET position = -1 WHERE id = ?").run(current.id);
      database.prepare("UPDATE purchase_project_kanban_columns SET position = ?, updated_at = ? WHERE id = ?").run(current.position, nowIso(), target.id);
      database.prepare("UPDATE purchase_project_kanban_columns SET position = ?, updated_at = ? WHERE id = ?").run(target.position, nowIso(), current.id);
      database.exec("COMMIT");
    } catch (error) { database.exec("ROLLBACK"); throw error; }
    return readState(database);
  } finally { database.close(); }
}

export function deletePurchaseProjectKanbanColumn(columnId: number) {
  const database = openDatabase();
  try {
    const state = readState(database);
    if (state.columns.length <= 1) throw new Error("O quadro precisa ter pelo menos uma etapa.");
    const assigned = Number((database.prepare("SELECT COUNT(*) AS count FROM purchase_project_kanban_projects WHERE column_id = ?").get(columnId) as { count: number }).count);
    if (assigned > 0) throw new Error("Mova os projetos desta etapa antes de excluí-la.");
    const column = state.columns.find((item) => item.id === columnId);
    if (!column) throw new Error("Etapa não encontrada.");
    if (column.isInitial || column.isCompleted) throw new Error("Defina outra etapa como inicial ou finalizada antes de excluir esta etapa.");
    const linkedRequests = Number((database.prepare("SELECT COUNT(*) AS count FROM purchase_project_kanban_requests WHERE column_id = ?").get(columnId) as { count: number }).count);
    if (linkedRequests > 0) throw new Error("Mova as solicitações desta etapa antes de excluí-la.");
    database.exec("BEGIN IMMEDIATE");
    try {
      database.prepare("DELETE FROM purchase_project_kanban_columns WHERE id = ?").run(columnId);
      database.prepare("UPDATE purchase_project_kanban_columns SET position = position - 1, updated_at = ? WHERE position > ?").run(nowIso(), column.position);
      database.exec("COMMIT");
    } catch (error) { database.exec("ROLLBACK"); throw error; }
    return readState(database);
  } finally { database.close(); }
}

export function createPurchaseProjectKanbanProject(nameValue: string, descriptionValue: string, closingDateValue: string) {
  const name = normalizeName(nameValue, "projeto");
  const description = normalizeDescription(descriptionValue);
  const closingDate = normalizeClosingDate(closingDateValue);
  const database = openDatabase();
  try {
    if (database.prepare("SELECT id FROM purchase_project_kanban_projects WHERE lower(name) = lower(?)").get(name)) throw new Error("Já existe um projeto com esse nome.");
    const firstColumn = database.prepare("SELECT id FROM purchase_project_kanban_columns ORDER BY position, id LIMIT 1").get() as { id: number } | undefined;
    if (!firstColumn) throw new Error("Crie uma etapa antes de cadastrar o projeto.");
    const position = Number((database.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS position FROM purchase_project_kanban_projects WHERE column_id = ?").get(firstColumn.id) as { position: number }).position);
    const stamp = nowIso();
    const key = `project:${randomUUID()}`;
    database.prepare("INSERT INTO purchase_project_kanban_projects (project_key, name, description, closing_date, column_id, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(key, name, description, closingDate || null, firstColumn.id, position, stamp, stamp);
    return readState(database);
  } finally { database.close(); }
}

export function updatePurchaseProjectKanbanProject(projectId: number, nameValue: string, descriptionValue: string, closingDateValue: string) {
  const name = normalizeName(nameValue, "projeto");
  const description = normalizeDescription(descriptionValue);
  const closingDate = normalizeClosingDate(closingDateValue);
  const database = openDatabase();
  try {
    if (database.prepare("SELECT id FROM purchase_project_kanban_projects WHERE lower(name) = lower(?) AND id <> ?").get(name, projectId)) throw new Error("Já existe um projeto com esse nome.");
    if (database.prepare("UPDATE purchase_project_kanban_projects SET name = ?, description = ?, closing_date = ?, updated_at = ? WHERE id = ?")
      .run(name, description, closingDate || null, nowIso(), projectId).changes === 0) throw new Error("Projeto não encontrado.");
    return readState(database);
  } finally { database.close(); }
}

export function deletePurchaseProjectKanbanProject(projectId: number) {
  const database = openDatabase();
  try {
    if (database.prepare("DELETE FROM purchase_project_kanban_projects WHERE id = ?").run(projectId).changes === 0) throw new Error("Projeto não encontrado.");
    return readState(database);
  } finally { database.close(); }
}

export function movePurchaseProjectKanbanProject(projectId: number, columnId: number, positionValue?: number) {
  const database = openDatabase();
  try {
    if (!database.prepare("SELECT id FROM purchase_project_kanban_columns WHERE id = ?").get(columnId)) throw new Error("Etapa não encontrada.");
    database.exec("BEGIN IMMEDIATE");
    try {
      const project = database.prepare("SELECT id, column_id AS columnId FROM purchase_project_kanban_projects WHERE id = ?").get(projectId) as { id: number; columnId: number } | undefined;
      if (!project) throw new Error("Projeto não encontrado.");
      const targetProjects = database.prepare("SELECT id FROM purchase_project_kanban_projects WHERE column_id = ? AND id <> ? ORDER BY position, id")
        .all(columnId, projectId) as Array<{ id: number }>;
      const requestedPosition = Number.isInteger(positionValue) ? Number(positionValue) : targetProjects.length;
      const position = Math.max(0, Math.min(requestedPosition, targetProjects.length));
      targetProjects.splice(position, 0, { id: projectId });

      const updateOrder = database.prepare("UPDATE purchase_project_kanban_projects SET column_id = ?, position = ? WHERE id = ?");
      if (project.columnId !== columnId) {
        const sourceProjects = database.prepare("SELECT id FROM purchase_project_kanban_projects WHERE column_id = ? AND id <> ? ORDER BY position, id")
          .all(project.columnId, projectId) as Array<{ id: number }>;
        sourceProjects.forEach((item, index) => updateOrder.run(project.columnId, index, item.id));
      }
      targetProjects.forEach((item, index) => updateOrder.run(columnId, index, item.id));
      database.prepare("UPDATE purchase_project_kanban_projects SET updated_at = ? WHERE id = ?").run(nowIso(), projectId);
      database.exec("COMMIT");
    } catch (error) { database.exec("ROLLBACK"); throw error; }
    return readState(database);
  } finally { database.close(); }
}

export function linkPurchaseRequestToKanbanProject(projectId: number, requestId: number, columnIdValue?: number) {
  if (!Number.isInteger(requestId) || requestId <= 0) throw new Error("Solicitação inválida.");
  const database = openDatabase();
  try {
    if (!database.prepare("SELECT id FROM purchase_project_kanban_projects WHERE id = ?").get(projectId)) throw new Error("Projeto não encontrado.");
    const firstColumn = database.prepare("SELECT id FROM purchase_project_kanban_columns ORDER BY position, id LIMIT 1").get() as { id: number } | undefined;
    const columnId = Number.isInteger(columnIdValue) && database.prepare("SELECT id FROM purchase_project_kanban_columns WHERE id = ?").get(columnIdValue)
      ? Number(columnIdValue)
      : firstColumn?.id;
    if (!columnId) throw new Error("Etapa não encontrada.");
    const existing = database.prepare(`SELECT projects.name FROM purchase_project_kanban_requests links JOIN purchase_project_kanban_projects projects ON projects.id = links.project_id WHERE links.purchase_request_id = ?`)
      .get(requestId) as { name: string } | undefined;
    if (existing) throw new Error("Esta solicitação já está vinculada a outro projeto.");
    const inserted = database.prepare("INSERT OR IGNORE INTO purchase_project_kanban_requests (project_id, purchase_request_id, column_id, created_at) VALUES (?, ?, ?, ?)").run(projectId, requestId, columnId, nowIso());
    if (inserted.changes === 0) {
      throw new Error("Esta solicitação já está vinculada a outro projeto.");
    }
    database.prepare("UPDATE purchase_project_kanban_projects SET updated_at = ? WHERE id = ?").run(nowIso(), projectId);
    return readState(database);
  } finally { database.close(); }
}

export function movePurchaseRequestInKanbanProject(projectId: number, requestId: number, columnId: number) {
  const database = openDatabase();
  try {
    if (!database.prepare("SELECT id FROM purchase_project_kanban_columns WHERE id = ?").get(columnId)) throw new Error("Etapa não encontrada.");
    const changed = database.prepare("UPDATE purchase_project_kanban_requests SET column_id = ? WHERE project_id = ? AND purchase_request_id = ?")
      .run(columnId, projectId, requestId).changes;
    if (changed === 0) throw new Error("Vínculo da solicitação não encontrado.");
    database.prepare("UPDATE purchase_project_kanban_projects SET updated_at = ? WHERE id = ?").run(nowIso(), projectId);
    return readState(database);
  } finally { database.close(); }
}

export function unlinkPurchaseRequestFromKanbanProject(projectId: number, requestId: number) {
  const database = openDatabase();
  try {
    if (database.prepare("DELETE FROM purchase_project_kanban_requests WHERE project_id = ? AND purchase_request_id = ?").run(projectId, requestId).changes === 0) throw new Error("Vínculo da solicitação não encontrado.");
    database.prepare("UPDATE purchase_project_kanban_projects SET updated_at = ? WHERE id = ?").run(nowIso(), projectId);
    return readState(database);
  } finally { database.close(); }
}
