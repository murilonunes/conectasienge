"use client";

import { useMemo, useState } from "react";
import { operationalPermissionDefinitions, screenPermissionDefinitions } from "@/lib/app-permissions";
import type { AppRole, AppUser } from "@/lib/app-users";
import { formatCurrency } from "@/lib/formatters";

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  aprovador: "Aprovador",
  comprador: "Comprador"
};

const approvalModeLabels: Record<AppUser["approvalLimitMode"], string> = {
  role: "Usar alçada do papel",
  limited: "Limite por valor",
  unlimited: "Sem limite"
};

function roleLabel(name: string) {
  return roleLabels[name] || name;
}

function approvalText(user: AppUser) {
  if (user.approvalLimitMode === "role") {
    return user.roleApprovalLimit !== null ? `Papel: ${formatCurrency(user.roleApprovalLimit)}` : "Papel: sem limite";
  }
  if (user.approvalLimitMode === "unlimited") return "Sem limite";
  return user.approvalLimit !== null ? formatCurrency(user.approvalLimit) : "R$ 0,00";
}

function permissionsFromRole(roles: AppRole[], roleName: string) {
  return roles.find((role) => role.name === roleName)?.permissions || [];
}

function UserAccessEditor({
  user,
  roles,
  saving,
  onSave
}: {
  user: AppUser;
  roles: AppRole[];
  saving: boolean;
  onSave: (body: Record<string, unknown>, successMessage: string) => Promise<boolean>;
}) {
  const [role, setRole] = useState(user.roles[0] || "comprador");
  const [permissions, setPermissions] = useState<string[]>(user.permissions);
  const [approvalLimitMode, setApprovalLimitMode] = useState<AppUser["approvalLimitMode"]>(user.approvalLimitMode);
  const [approvalLimit, setApprovalLimit] = useState(user.approvalLimit !== null ? String(user.approvalLimit) : "");
  const selected = useMemo(() => new Set(permissions), [permissions]);
  const currentRole = roles.find((current) => current.name === role);

  function togglePermission(permission: string) {
    setPermissions((current) => {
      const next = new Set(current);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return Array.from(next).sort();
    });
  }

  function useRolePermissions() {
    setPermissions(permissionsFromRole(roles, role));
    setApprovalLimitMode("role");
    setApprovalLimit("");
  }

  async function saveAccess() {
    const ok = await onSave({
      id: user.id,
      role,
      permissions,
      approvalLimitMode,
      approvalLimit: approvalLimitMode === "limited" ? Number(approvalLimit || 0) : null
    }, `Acessos de ${user.name} atualizados.`);
    if (!ok) return;
  }

  return (
    <div className="user-access-editor">
      <div className="user-access-head">
        <label>
          <span>Papel</span>
          <select value={role} disabled={saving} onChange={(event) => setRole(event.target.value)}>
            {roles.map((current) => (
              <option value={current.name} key={current.id}>
                {roleLabel(current.name)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Alçada</span>
          <select value={approvalLimitMode} disabled={saving} onChange={(event) => setApprovalLimitMode(event.target.value as AppUser["approvalLimitMode"])}>
            {Object.entries(approvalModeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>

        <label>
          <span>Valor da alçada</span>
          <input
            disabled={saving || approvalLimitMode !== "limited"}
            min="0"
            step="0.01"
            type="number"
            value={approvalLimit}
            onChange={(event) => setApprovalLimit(event.target.value)}
            placeholder={currentRole?.approvalLimit !== null ? String(currentRole?.approvalLimit || 0) : "Sem limite"}
          />
        </label>

        <div className="user-access-actions">
          <button className="payable-review-button compact" type="button" disabled={saving} onClick={useRolePermissions}>
            Usar padrão do papel
          </button>
          <button className="button" type="button" disabled={saving || (approvalLimitMode === "limited" && Number(approvalLimit || 0) < 0)} onClick={() => void saveAccess()}>
            {saving ? "Salvando..." : "Salvar acessos"}
          </button>
        </div>
      </div>

      <div className="permission-matrix">
        <div>
          <h3>Telas liberadas</h3>
          <div className="permission-grid">
            {screenPermissionDefinitions.map((permission) => (
              <label className="permission-toggle" key={permission.permission}>
                <input
                  checked={selected.has(permission.permission)}
                  disabled={saving}
                  type="checkbox"
                  onChange={() => togglePermission(permission.permission)}
                />
                <span>
                  <strong>{permission.label}</strong>
                  <small>{permission.description}</small>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3>Permissões operacionais</h3>
          <div className="permission-grid compact">
            {operationalPermissionDefinitions.map((permission) => (
              <label className="permission-toggle" key={permission.permission}>
                <input
                  checked={selected.has(permission.permission)}
                  disabled={saving}
                  type="checkbox"
                  onChange={() => togglePermission(permission.permission)}
                />
                <span>
                  <strong>{permission.label}</strong>
                  <small>{permission.description}</small>
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function UsersManager({ initialUsers, roles, currentUserId }: { initialUsers: AppUser[]; roles: AppRole[]; currentUserId: number }) {
  const [users, setUsers] = useState(initialUsers);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("comprador");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function callUsersApi(method: "POST" | "PATCH", body: Record<string, unknown>, successMessage: string) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/users", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await response.json() as { users?: AppUser[]; message?: string };
      if (!response.ok) throw new Error(json.message || "Não foi possível salvar.");
      if (json.users) setUsers(json.users);
      setMessage(successMessage);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function createUser() {
    const created = await callUsersApi("POST", { name, email, password, role }, "Usuário criado com sucesso.");
    if (created) {
      setName("");
      setEmail("");
      setPassword("");
      setRole("comprador");
    }
  }

  async function resetPassword(user: AppUser) {
    const newPassword = window.prompt(`Nova senha para ${user.name} (mínimo 8 caracteres):`);
    if (!newPassword) return;
    await callUsersApi("PATCH", { id: user.id, password: newPassword }, `Senha de ${user.name} atualizada.`);
  }

  return (
    <section className="users-manager">
      <div className="card panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Novo usuário</h2>
            <span className="panel-note">Crie o usuário com um papel inicial; depois ajuste telas, operações e alçada no card dele</span>
          </div>
        </div>
        <div className="users-manager-form">
          <label><span>Nome</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome completo" /></label>
          <label><span>E-mail</span><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="pessoa@brasin.com.br" /></label>
          <label><span>Senha inicial</span><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Mínimo 8 caracteres" /></label>
          <label>
            <span>Papel inicial</span>
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              {roles.map((current) => (
                <option value={current.name} key={current.id}>
                  {roleLabel(current.name)}{current.approvalLimit !== null ? ` - alçada ${formatCurrency(current.approvalLimit)}` : " - sem limite"}
                </option>
              ))}
            </select>
          </label>
          <button className="button" type="button" disabled={saving || !name || !email || !password} onClick={() => void createUser()}>
            {saving ? "Salvando..." : "Criar usuário"}
          </button>
        </div>
        {message && <div className="settings-inline-message">{message}</div>}
      </div>

      <div className="users-list">
        {users.map((user) => (
          <article className="card panel user-card" key={user.id}>
            <div className="user-card-head">
              <div>
                <h2 className="panel-title">
                  {user.name}
                  {user.id === currentUserId && <i className="badge">você</i>}
                  {!user.active && <i className="badge muted">inativo</i>}
                </h2>
                <span className="panel-note">{user.email}</span>
              </div>
              <div className="user-card-summary">
                <span><strong>{roleLabel(user.roles[0] || "Sem papel")}</strong><small>Papel atual</small></span>
                <span><strong>{approvalText(user)}</strong><small>Alçada efetiva</small></span>
                <span><strong>{user.permissions.length}</strong><small>Permissões</small></span>
              </div>
              <div className="users-manager-actions">
                <button className="payable-review-button compact" type="button" disabled={saving} onClick={() => void resetPassword(user)}>
                  Redefinir senha
                </button>
                <button
                  className={`payable-review-button compact ${user.active ? "warn" : ""}`}
                  type="button"
                  disabled={saving || user.id === currentUserId}
                  onClick={() => void callUsersApi("PATCH", { id: user.id, active: !user.active }, `${user.name} ${user.active ? "desativado" : "reativado"}.`)}
                >
                  {user.active ? "Desativar" : "Reativar"}
                </button>
              </div>
            </div>

            <UserAccessEditor user={user} roles={roles} saving={saving} onSave={(body, success) => callUsersApi("PATCH", body, success)} />
          </article>
        ))}
      </div>

      <div className="advanced-search-hint">
        A lista "Telas liberadas" controla quais páginas aparecem no menu e quais URLs podem ser abertas. As permissões operacionais controlam ações sensíveis, como aprovar cotação, gerar links, gerenciar usuários e gravar no Sienge.
      </div>
    </section>
  );
}
