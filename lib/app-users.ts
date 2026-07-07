import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { existsSync, mkdirSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { appPermissions, screenPermissionDefinitions } from "@/lib/app-permissions";

// Usuários, papéis e permissões com a mesma modelagem do spatie/laravel-permission:
// users, roles, permissions, model_has_roles, model_has_permissions e
// role_has_permissions. A única extensão é a coluna roles.approval_limit,
// que guarda a alçada de aprovação (NULL = sem limite).

export type AppUser = {
  id: number;
  name: string;
  email: string;
  active: boolean;
  roles: string[];
  permissions: string[];
  permissionsMode: "role" | "custom";
  // Alçada efetiva: valor do usuário, do papel ou null = ilimitado.
  approvalLimit: number | null;
  approvalLimitMode: "role" | "limited" | "unlimited";
  roleApprovalLimit: number | null;
  createdAt: string;
};

export type AppRole = {
  id: number;
  name: string;
  approvalLimit: number | null;
  permissions: string[];
};

const dataDir = path.join(process.cwd(), ".sienge-data");
const databasePath = path.join(dataDir, "app-users.sqlite");
const modelType = "user";
const guardName = "web";
const sessionMaxAgeSeconds = 60 * 60 * 12;
const userSelectColumns = "id, name, email, password, active, permissions_mode, approval_limit, approval_limit_mode, created_at";

// Papéis padrão: admin gerencia tudo; aprovador decide sem limite; comprador
// opera o dia a dia com alçada de aprovação limitada.
const defaultRoles: Array<{ name: string; approvalLimit: number | null; permissions: string[] }> = [
  { name: "admin", approvalLimit: null, permissions: [...appPermissions] },
  {
    name: "aprovador",
    approvalLimit: null,
    permissions: [
      ...screenPermissionDefinitions
        .filter((screen) => screen.permission !== "screen.usuarios")
        .map((screen) => screen.permission),
      "quotations.view",
      "quotations.manage",
      "quotations.approve",
      "sienge.write"
    ]
  },
  {
    name: "comprador",
    approvalLimit: 50000,
    permissions: [
      "screen.dashboard",
      "screen.compras",
      "screen.solicitacoes",
      "screen.cotacoes",
      "screen.relatorios",
      "screen.sienge",
      "quotations.view",
      "quotations.manage",
      "quotations.approve",
      "sienge.write"
    ]
  }
];

function authSecret() {
  return process.env.APP_AUTH_SECRET || process.env.APP_ACCESS_PASSWORD || "";
}

function nowIso() {
  return new Date().toISOString();
}

function database() {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      permissions_mode TEXT NOT NULL DEFAULT 'role',
      approval_limit REAL,
      approval_limit_mode TEXT NOT NULL DEFAULT 'role',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      guard_name TEXT NOT NULL DEFAULT 'web',
      approval_limit REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(name, guard_name)
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      guard_name TEXT NOT NULL DEFAULT 'web',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(name, guard_name)
    );

    CREATE TABLE IF NOT EXISTS model_has_roles (
      role_id INTEGER NOT NULL,
      model_type TEXT NOT NULL,
      model_id INTEGER NOT NULL,
      PRIMARY KEY (role_id, model_id, model_type)
    );

    CREATE TABLE IF NOT EXISTS model_has_permissions (
      permission_id INTEGER NOT NULL,
      model_type TEXT NOT NULL,
      model_id INTEGER NOT NULL,
      PRIMARY KEY (permission_id, model_id, model_type)
    );

    CREATE TABLE IF NOT EXISTS role_has_permissions (
      permission_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      PRIMARY KEY (permission_id, role_id)
    );
  `);
  try {
    db.exec("ALTER TABLE users ADD COLUMN permissions_mode TEXT NOT NULL DEFAULT 'role'");
  } catch {
    // Coluna já existe.
  }
  try {
    db.exec("ALTER TABLE users ADD COLUMN approval_limit REAL");
  } catch {
    // Coluna já existe.
  }
  try {
    db.exec("ALTER TABLE users ADD COLUMN approval_limit_mode TEXT NOT NULL DEFAULT 'role'");
  } catch {
    // Coluna já existe.
  }
  seed(db);
  return db;
}

function seed(db: DatabaseSync) {
  const stamp = nowIso();
  appPermissions.forEach((name) => {
    db.prepare("INSERT OR IGNORE INTO permissions (name, guard_name, created_at, updated_at) VALUES (?, ?, ?, ?)")
      .run(name, guardName, stamp, stamp);
  });

  defaultRoles.forEach((role) => {
    db.prepare("INSERT OR IGNORE INTO roles (name, guard_name, approval_limit, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(role.name, guardName, role.approvalLimit, stamp, stamp);
    const roleId = Number((db.prepare("SELECT id FROM roles WHERE name = ? AND guard_name = ?").get(role.name, guardName) as { id: number }).id);
    role.permissions.forEach((permission) => {
      const permissionId = Number((db.prepare("SELECT id FROM permissions WHERE name = ? AND guard_name = ?").get(permission, guardName) as { id: number }).id);
      db.prepare("INSERT OR IGNORE INTO role_has_permissions (permission_id, role_id) VALUES (?, ?)").run(permissionId, roleId);
    });
  });

  // Primeiro acesso: cria o administrador com a senha mestre já configurada,
  // para ninguém ficar trancado para fora na migração.
  const hasUsers = db.prepare("SELECT id FROM users LIMIT 1").get();
  const masterPassword = process.env.APP_ACCESS_PASSWORD || "";
  if (!hasUsers && masterPassword.length >= 12) {
    const email = (process.env.APP_ADMIN_EMAIL || "admin@brasin.local").trim().toLowerCase();
    const result = db.prepare("INSERT INTO users (name, email, password, active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)")
      .run("Administrador", email, hashPassword(masterPassword), stamp, stamp);
    const adminRoleId = Number((db.prepare("SELECT id FROM roles WHERE name = 'admin' AND guard_name = ?").get(guardName) as { id: number }).id);
    db.prepare("INSERT OR IGNORE INTO model_has_roles (role_id, model_type, model_id) VALUES (?, ?, ?)")
      .run(adminRoleId, modelType, Number(result.lastInsertRowid));
  }
}

export function hashPassword(plain: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(plain: string, stored: string) {
  const [scheme, salt, hash] = String(stored || "").split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(plain, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

type UserRow = {
  id: number;
  name: string;
  email: string;
  password: string;
  active: number;
  permissions_mode: string | null;
  approval_limit: number | null;
  approval_limit_mode: string | null;
  created_at: string;
};

function loadUserPermissions(db: DatabaseSync, row: UserRow) {
  const roles = db.prepare(`
    SELECT roles.name, roles.approval_limit
    FROM model_has_roles
    JOIN roles ON roles.id = model_has_roles.role_id
    WHERE model_has_roles.model_type = ? AND model_has_roles.model_id = ?
    ORDER BY roles.name
  `).all(modelType, row.id) as Array<{ name: string; approval_limit: number | null }>;

  const rolePermissions = db.prepare(`
    SELECT DISTINCT permissions.name
    FROM model_has_roles
    JOIN role_has_permissions ON role_has_permissions.role_id = model_has_roles.role_id
    JOIN permissions ON permissions.id = role_has_permissions.permission_id
    WHERE model_has_roles.model_type = ? AND model_has_roles.model_id = ?
  `).all(modelType, row.id) as Array<{ name: string }>;

  const directPermissions = db.prepare(`
    SELECT DISTINCT permissions.name
    FROM model_has_permissions
    JOIN permissions ON permissions.id = model_has_permissions.permission_id
    WHERE model_has_permissions.model_type = ? AND model_has_permissions.model_id = ?
  `).all(modelType, row.id) as Array<{ name: string }>;

  const permissionsMode: AppUser["permissionsMode"] = row.permissions_mode === "custom" ? "custom" : "role";
  const permissionsSource = permissionsMode === "custom" ? directPermissions : [...rolePermissions, ...directPermissions];
  const permissions = Array.from(new Set(permissionsSource.map((permission) => permission.name))).sort();
  // Alçada do papel: qualquer papel sem limite libera; senão vale o maior limite.
  const roleApprovalLimit = roles.length && roles.every((role) => role.approval_limit !== null)
    ? Math.max(...roles.map((role) => Number(role.approval_limit)))
    : roles.some((role) => role.approval_limit === null) ? null : 0;
  const approvalLimitMode: AppUser["approvalLimitMode"] = row.approval_limit_mode === "limited" || row.approval_limit_mode === "unlimited" ? row.approval_limit_mode : "role";
  const approvalLimit = approvalLimitMode === "unlimited"
    ? null
    : approvalLimitMode === "limited"
      ? Math.max(0, Number(row.approval_limit) || 0)
      : roleApprovalLimit;

  return { roles: roles.map((role) => role.name), permissions, permissionsMode, approvalLimit, approvalLimitMode, roleApprovalLimit };
}

function userSummary(db: DatabaseSync, row: UserRow): AppUser {
  const access = loadUserPermissions(db, row);
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    active: row.active === 1,
    roles: access.roles,
    permissions: access.permissions,
    permissionsMode: access.permissionsMode,
    approvalLimit: access.approvalLimit,
    approvalLimitMode: access.approvalLimitMode,
    roleApprovalLimit: access.roleApprovalLimit,
    createdAt: row.created_at
  };
}

export function authenticateUser(email: string, password: string): AppUser | undefined {
  const db = database();
  try {
    const row = db.prepare(`SELECT ${userSelectColumns} FROM users WHERE email = ? AND active = 1`)
      .get(String(email || "").trim().toLowerCase()) as UserRow | undefined;
    if (!row || !verifyPassword(password, row.password)) return undefined;
    return userSummary(db, row);
  } finally {
    db.close();
  }
}

// Compatibilidade com o fluxo antigo de senha única: entra como o administrador.
export function authenticateLegacyMaster(password: string): AppUser | undefined {
  const master = process.env.APP_ACCESS_PASSWORD || "";
  if (master.length < 12 || password.length !== master.length) return undefined;
  if (!timingSafeEqual(Buffer.from(password), Buffer.from(master))) return undefined;

  const db = database();
  try {
    const row = db.prepare(`
      SELECT users.id, users.name, users.email, users.password, users.active, users.permissions_mode, users.approval_limit, users.approval_limit_mode, users.created_at
      FROM users
      JOIN model_has_roles ON model_has_roles.model_id = users.id AND model_has_roles.model_type = ?
      JOIN roles ON roles.id = model_has_roles.role_id AND roles.name = 'admin'
      WHERE users.active = 1
      ORDER BY users.id
      LIMIT 1
    `).get(modelType) as UserRow | undefined;
    return row ? userSummary(db, row) : undefined;
  } finally {
    db.close();
  }
}

export function getAppUserById(id: number): AppUser | undefined {
  if (!Number.isFinite(id) || id <= 0) return undefined;
  const db = database();
  try {
    const row = db.prepare(`SELECT ${userSelectColumns} FROM users WHERE id = ?`).get(id) as UserRow | undefined;
    return row ? userSummary(db, row) : undefined;
  } finally {
    db.close();
  }
}

export function listAppUsers(): AppUser[] {
  const db = database();
  try {
    const rows = db.prepare(`SELECT ${userSelectColumns} FROM users ORDER BY name`).all() as UserRow[];
    return rows.map((row) => userSummary(db, row));
  } finally {
    db.close();
  }
}

export function listAppRoles(): AppRole[] {
  const db = database();
  try {
    const rows = db.prepare("SELECT id, name, approval_limit FROM roles WHERE guard_name = ? ORDER BY name").all(guardName) as Array<{ id: number; name: string; approval_limit: number | null }>;
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      approvalLimit: row.approval_limit,
      permissions: (db.prepare(`
        SELECT permissions.name FROM role_has_permissions
        JOIN permissions ON permissions.id = role_has_permissions.permission_id
        WHERE role_has_permissions.role_id = ?
        ORDER BY permissions.name
      `).all(row.id) as Array<{ name: string }>).map((permission) => permission.name)
    }));
  } finally {
    db.close();
  }
}

function normalizedPermissions(input?: string[]) {
  if (!Array.isArray(input)) return undefined;
  const allowed = new Set<string>(appPermissions);
  return Array.from(new Set(input.map((permission) => String(permission || "").trim()).filter((permission) => allowed.has(permission)))).sort();
}

function replaceUserPermissions(db: DatabaseSync, userId: number, permissions: string[]) {
  db.prepare("DELETE FROM model_has_permissions WHERE model_type = ? AND model_id = ?").run(modelType, userId);
  const statement = db.prepare("INSERT OR IGNORE INTO model_has_permissions (permission_id, model_type, model_id) VALUES (?, ?, ?)");
  permissions.forEach((permission) => {
    const row = db.prepare("SELECT id FROM permissions WHERE name = ? AND guard_name = ?").get(permission, guardName) as { id: number } | undefined;
    if (row) statement.run(row.id, modelType, userId);
  });
}

function normalizeApprovalMode(value?: string) {
  return value === "limited" || value === "unlimited" ? value : value === "role" ? "role" : undefined;
}

function normalizedApprovalLimit(mode: "role" | "limited" | "unlimited" | undefined, value?: number | null) {
  if (mode !== "limited") return null;
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit < 0) throw new Error("Informe uma alçada válida.");
  return limit;
}

function activeUsersWithPermissionExcept(db: DatabaseSync, excludedUserId: number, permission: string) {
  const rows = db.prepare(`SELECT ${userSelectColumns} FROM users WHERE active = 1 AND id != ?`).all(excludedUserId) as UserRow[];
  return rows.filter((current) => userSummary(db, current).permissions.includes(permission)).length;
}

function assertKeepsUserManager(db: DatabaseSync, current: UserRow, nextActive: boolean, nextPermissions: string[]) {
  const currentHasAccess = current.active === 1 && userSummary(db, current).permissions.includes("users.manage");
  const nextHasAccess = nextActive && nextPermissions.includes("users.manage");
  if (currentHasAccess && !nextHasAccess && activeUsersWithPermissionExcept(db, current.id, "users.manage") === 0) {
    throw new Error("Mantenha ao menos um usuário ativo com permissão para gerenciar usuários.");
  }
}

export function createAppUser(input: {
  name: string;
  email: string;
  password: string;
  role: string;
  permissions?: string[];
  approvalLimitMode?: "role" | "limited" | "unlimited";
  approvalLimit?: number | null;
}): AppUser {
  const name = String(input.name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe nome e e-mail válidos.");
  if (String(input.password || "").length < 8) throw new Error("A senha deve ter ao menos 8 caracteres.");

  const db = database();
  try {
    const role = db.prepare("SELECT id FROM roles WHERE name = ? AND guard_name = ?").get(String(input.role || "").trim(), guardName) as { id: number } | undefined;
    if (!role) throw new Error("Papel inválido. Use admin, aprovador ou comprador.");

    const stamp = nowIso();
    let result;
    try {
      result = db.prepare("INSERT INTO users (name, email, password, active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)")
        .run(name, email, hashPassword(input.password), stamp, stamp);
    } catch (error) {
      if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) {
        throw new Error("Já existe um usuário com este e-mail.");
      }
      throw error;
    }
    const userId = Number(result.lastInsertRowid);
    db.prepare("INSERT INTO model_has_roles (role_id, model_type, model_id) VALUES (?, ?, ?)").run(role.id, modelType, userId);
    const permissions = normalizedPermissions(input.permissions);
    if (permissions) {
      replaceUserPermissions(db, userId, permissions);
      db.prepare("UPDATE users SET permissions_mode = 'custom', updated_at = ? WHERE id = ?").run(stamp, userId);
    }
    const approvalLimitMode = normalizeApprovalMode(input.approvalLimitMode);
    if (approvalLimitMode) {
      db.prepare("UPDATE users SET approval_limit_mode = ?, approval_limit = ?, updated_at = ? WHERE id = ?")
        .run(approvalLimitMode, normalizedApprovalLimit(approvalLimitMode, input.approvalLimit), stamp, userId);
    }
    const row = db.prepare(`SELECT ${userSelectColumns} FROM users WHERE id = ?`).get(userId) as UserRow;
    return userSummary(db, row);
  } finally {
    db.close();
  }
}

function userHasRole(db: DatabaseSync, userId: number, roleName: string) {
  return Boolean(db.prepare(`
    SELECT roles.id
    FROM model_has_roles
    JOIN roles ON roles.id = model_has_roles.role_id
    WHERE model_has_roles.model_type = ? AND model_has_roles.model_id = ? AND roles.name = ?
    LIMIT 1
  `).get(modelType, userId, roleName));
}

function activeAdminCountExcept(db: DatabaseSync, userId: number) {
  const row = db.prepare(`
    SELECT COUNT(*) AS total FROM users
    JOIN model_has_roles ON model_has_roles.model_id = users.id AND model_has_roles.model_type = ?
    JOIN roles ON roles.id = model_has_roles.role_id AND roles.name = 'admin'
    WHERE users.active = 1 AND users.id != ?
  `).get(modelType, userId) as { total: number };
  return Number(row.total) || 0;
}

function permissionsForRole(db: DatabaseSync, roleName: string) {
  return (db.prepare(`
    SELECT permissions.name
    FROM roles
    JOIN role_has_permissions ON role_has_permissions.role_id = roles.id
    JOIN permissions ON permissions.id = role_has_permissions.permission_id
    WHERE roles.name = ? AND roles.guard_name = ?
    ORDER BY permissions.name
  `).all(roleName, guardName) as Array<{ name: string }>).map((permission) => permission.name);
}

export function updateAppUser(id: number, input: {
  name?: string;
  role?: string;
  active?: boolean;
  password?: string;
  permissions?: string[];
  approvalLimitMode?: "role" | "limited" | "unlimited";
  approvalLimit?: number | null;
}): AppUser {
  const db = database();
  try {
    const row = db.prepare(`SELECT ${userSelectColumns} FROM users WHERE id = ?`).get(id) as UserRow | undefined;
    if (!row) throw new Error("Usuário não encontrado.");

    const stamp = nowIso();
    const roleName = typeof input.role === "string" && input.role.trim() ? input.role.trim() : undefined;
    const permissions = normalizedPermissions(input.permissions);
    const approvalLimitMode = normalizeApprovalMode(input.approvalLimitMode);
    const nextActive = typeof input.active === "boolean" ? input.active : row.active === 1;
    let nextPermissions = userSummary(db, row).permissions;
    if (roleName && row.permissions_mode !== "custom" && !permissions) {
      nextPermissions = permissionsForRole(db, roleName);
    }
    if (permissions) {
      nextPermissions = permissions;
    }
    assertKeepsUserManager(db, row, nextActive, nextPermissions);

    if (typeof input.name === "string" && input.name.trim()) {
      db.prepare("UPDATE users SET name = ?, updated_at = ? WHERE id = ?").run(input.name.trim(), stamp, id);
    }
    if (typeof input.password === "string" && input.password) {
      if (input.password.length < 8) throw new Error("A senha deve ter ao menos 8 caracteres.");
      db.prepare("UPDATE users SET password = ?, updated_at = ? WHERE id = ?").run(hashPassword(input.password), stamp, id);
    }
    if (typeof input.active === "boolean") {
      if (!input.active && row.active === 1 && userHasRole(db, id, "admin") && activeAdminCountExcept(db, id) === 0) {
        throw new Error("Mantenha ao menos um administrador ativo.");
      }
      db.prepare("UPDATE users SET active = ?, updated_at = ? WHERE id = ?").run(input.active ? 1 : 0, stamp, id);
    }
    if (roleName) {
      const role = db.prepare("SELECT id FROM roles WHERE name = ? AND guard_name = ?").get(roleName, guardName) as { id: number } | undefined;
      if (!role) throw new Error("Papel inválido. Use admin, aprovador ou comprador.");
      if (row.active === 1 && roleName !== "admin" && userHasRole(db, id, "admin") && activeAdminCountExcept(db, id) === 0) {
        throw new Error("Mantenha ao menos um administrador ativo.");
      }
      db.prepare("DELETE FROM model_has_roles WHERE model_type = ? AND model_id = ?").run(modelType, id);
      db.prepare("INSERT INTO model_has_roles (role_id, model_type, model_id) VALUES (?, ?, ?)").run(role.id, modelType, id);
    }
    if (permissions) {
      replaceUserPermissions(db, id, permissions);
      db.prepare("UPDATE users SET permissions_mode = 'custom', updated_at = ? WHERE id = ?").run(stamp, id);
    }
    if (approvalLimitMode) {
      db.prepare("UPDATE users SET approval_limit_mode = ?, approval_limit = ?, updated_at = ? WHERE id = ?")
        .run(approvalLimitMode, normalizedApprovalLimit(approvalLimitMode, input.approvalLimit), stamp, id);
    }

    const updated = db.prepare(`SELECT ${userSelectColumns} FROM users WHERE id = ?`).get(id) as UserRow;
    return userSummary(db, updated);
  } finally {
    db.close();
  }
}

// --- Sessão assinada (cookie): userId.expira.hmac(userId.expira) ---

export function createSessionValue(userId: number, now = new Date()) {
  const expires = String(Math.floor(now.getTime() / 1000) + sessionMaxAgeSeconds);
  const payload = `${userId}.${expires}`;
  return `${payload}.${createHmac("sha256", authSecret()).update(payload).digest("hex")}`;
}

export function sessionMaxAge() {
  return sessionMaxAgeSeconds;
}

function parseSessionValue(raw?: string): number | undefined {
  if (!raw || !authSecret()) return undefined;
  const [id, expires, signature] = raw.split(".");
  if (!id || !expires || !signature) return undefined;
  const expected = createHmac("sha256", authSecret()).update(`${id}.${expires}`).digest("hex");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return undefined;
  if (Number(expires) < Math.floor(Date.now() / 1000)) return undefined;
  return Number(id) > 0 ? Number(id) : undefined;
}

export function getSessionUserFromCookieValue(raw?: string): AppUser | undefined {
  const userId = parseSessionValue(raw);
  if (!userId) return undefined;
  const user = getAppUserById(userId);
  return user?.active ? user : undefined;
}

export function getSessionUserFromRequest(request: Request): AppUser | undefined {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)brasin_session=([^;]+)/);
  return getSessionUserFromCookieValue(match ? decodeURIComponent(match[1]) : undefined);
}

// Guarda para rotas de API: retorna o usuário ou o NextResponse de erro pronto.
export function guardPermission(request: Request, permission: string): { user?: AppUser; status?: number; message?: string } {
  const user = getSessionUserFromRequest(request);
  if (!user) return { status: 401, message: "Sessão expirada ou inválida. Entre novamente." };
  if (!user.permissions.includes(permission)) {
    return { user, status: 403, message: "Seu perfil não tem permissão para esta ação." };
  }
  return { user };
}

export function appUsersDatabaseExists() {
  return existsSync(databasePath);
}
