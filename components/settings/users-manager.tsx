"use client";

import { I18nText } from "@/components/i18n/i18n-text";
import { useState } from "react";
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

type ModalState =
  | { type: "create" }
  | { type: "roles" }
  | { type: "profile"; user: AppUser }
  | { type: "screens"; user: AppUser }
  | { type: "operations"; user: AppUser }
  | null;

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

function ModalShell({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="settings-modal-backdrop" role="presentation">
      <section className="settings-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="settings-modal-head">
          <div>
            <h2>{title}</h2>
            <span>{subtitle}</span>
          </div>
          <button className="payable-review-button compact" type="button" onClick={onClose}><I18nText text={"Fechar"} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

function CreateUserModal({
  roles,
  saving,
  onClose,
  onCreate
}: {
  roles: AppRole[];
  saving: boolean;
  onClose: () => void;
  onCreate: (body: Record<string, unknown>, successMessage: string) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("comprador");

  async function submit() {
    const created = await onCreate({ name, email, password, role }, "Usuário criado com sucesso.");
    if (created) onClose();
  }

  return (
    <ModalShell title="Novo usuário" subtitle="Crie o acesso inicial; permissões finas podem ser editadas depois" onClose={onClose}>
      <div className="settings-modal-form">
        <label><span><I18nText text={"Nome"} /></span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome completo" data-i18n-placeholder={"Nome completo"} /></label>
        <label><span><I18nText text={"E-mail"} /></span><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="pessoa@brasin.com.br" data-i18n-placeholder={"pessoa@brasin.com.br"} /></label>
        <label><span><I18nText text={"Senha inicial"} /></span><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Mínimo 8 caracteres" data-i18n-placeholder={"Mínimo 8 caracteres"} /></label>
        <label>
          <span><I18nText text={"Papel inicial"} /></span>
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            {roles.map((current) => (
              <option value={current.name} key={current.id}>
                {roleLabel(current.name)}{current.approvalLimit !== null ? ` - alçada ${formatCurrency(current.approvalLimit)}` : <I18nText text={" - sem limite"} />}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="settings-modal-actions">
        <button className="payable-review-button compact" type="button" onClick={onClose}><I18nText text={"Cancelar"} /></button>
        <button className="button" type="button" disabled={saving || !name || !email || !password} onClick={() => void submit()}>
          <I18nText text={saving ? "Salvando..." : "Criar usuário"} />
        </button>
      </div>
    </ModalShell>
  );
}

function ProfileModal({
  user,
  roles,
  saving,
  onClose,
  onSave
}: {
  user: AppUser;
  roles: AppRole[];
  saving: boolean;
  onClose: () => void;
  onSave: (body: Record<string, unknown>, successMessage: string) => Promise<boolean>;
}) {
  const [role, setRole] = useState(user.roles[0] || "comprador");
  const [approvalLimitMode, setApprovalLimitMode] = useState<AppUser["approvalLimitMode"]>(user.approvalLimitMode);
  const [approvalLimit, setApprovalLimit] = useState(user.approvalLimit !== null ? String(user.approvalLimit) : "");
  const [inheritGroupPermissions, setInheritGroupPermissions] = useState(user.permissionsMode === "role");
  const currentRole = roles.find((current) => current.name === role);

  async function save() {
    const ok = await onSave({
      id: user.id,
      role,
      permissionsMode: inheritGroupPermissions ? "role" : undefined,
      approvalLimitMode,
      approvalLimit: approvalLimitMode === "limited" ? Number(approvalLimit || 0) : null
    }, `Perfil e alçada de ${user.name} atualizados.`);
    if (ok) onClose();
  }

  return (
    <ModalShell title="Perfil e alçada" subtitle={user.name} onClose={onClose}>
      <div className="settings-modal-form">
        <label>
          <span><I18nText text={"Papel"} /></span>
          <select value={role} disabled={saving} onChange={(event) => setRole(event.target.value)}>
            {roles.map((current) => <option value={current.name} key={current.id}>{roleLabel(current.name)}</option>)}
          </select>
        </label>
        <label>
          <span><I18nText text={"Alçada"} /></span>
          <select value={approvalLimitMode} disabled={saving} onChange={(event) => setApprovalLimitMode(event.target.value as AppUser["approvalLimitMode"])}>
            {Object.entries(approvalModeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span><I18nText text={"Valor da alçada"} /></span>
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
        <label className="settings-checkline">
          <input type="checkbox" checked={inheritGroupPermissions} disabled={saving} onChange={(event) => setInheritGroupPermissions(event.target.checked)} />
          <span><I18nText text={"Usar permissões do grupo selecionado"} /></span>
        </label>
      </div>
      <div className="settings-modal-actions">
        <button className="payable-review-button compact" type="button" onClick={onClose}><I18nText text={"Cancelar"} /></button>
        <button className="button" type="button" disabled={saving || (approvalLimitMode === "limited" && Number(approvalLimit || 0) < 0)} onClick={() => void save()}>
          <I18nText text={saving ? "Salvando..." : "Salvar perfil"} />
        </button>
      </div>
    </ModalShell>
  );
}

function PermissionModal({
  user,
  type,
  saving,
  onClose,
  onSave
}: {
  user: AppUser;
  type: "screens" | "operations";
  saving: boolean;
  onClose: () => void;
  onSave: (body: Record<string, unknown>, successMessage: string) => Promise<boolean>;
}) {
  const definitions = type === "screens" ? screenPermissionDefinitions : operationalPermissionDefinitions;
  const title = type === "screens" ? "Telas liberadas" : "Permissões operacionais";
  const subtitle = type === "screens"
    ? "Controle quais páginas aparecem no menu e podem ser abertas"
    : "Controle ações sensíveis dentro das telas liberadas";
  const [permissions, setPermissions] = useState<string[]>(user.permissions);
  const selected = new Set(permissions);

  function togglePermission(permission: string) {
    setPermissions((current) => {
      const next = new Set(current);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return Array.from(next).sort();
    });
  }

  async function save() {
    const ok = await onSave({ id: user.id, permissions }, `${title} de ${user.name} atualizadas.`);
    if (ok) onClose();
  }

  return (
    <ModalShell title={title} subtitle={`${user.name} - ${subtitle}`} onClose={onClose}>
      <div className={`permission-grid modal-grid${type === "operations" ? " compact" : ""}`}>
        {definitions.map((permission) => (
          <label className="permission-toggle" key={permission.permission}>
            <input
              checked={selected.has(permission.permission)}
              disabled={saving}
              type="checkbox"
              onChange={() => togglePermission(permission.permission)}
            />
            <span>
              <strong><I18nText text={permission.label} /></strong>
              <small>{permission.description}</small>
            </span>
          </label>
        ))}
      </div>
      <div className="settings-modal-actions">
        <button className="payable-review-button compact" type="button" onClick={onClose}><I18nText text={"Cancelar"} /></button>
        <button className="button" type="button" disabled={saving} onClick={() => void save()}>
          <I18nText text={saving ? "Salvando..." : "Salvar permissões"} />
        </button>
      </div>
    </ModalShell>
  );
}

function RolesModal({
  roles,
  saving,
  onClose,
  onSave
}: {
  roles: AppRole[];
  saving: boolean;
  onClose: () => void;
  onSave: (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, successMessage: string) => Promise<boolean>;
}) {
  const [selectedId, setSelectedId] = useState<number | "new">("new");
  const selectedRole = selectedId === "new" ? undefined : roles.find((role) => role.id === selectedId);
  const [name, setName] = useState("");
  const [approvalLimit, setApprovalLimit] = useState("");
  const [unlimited, setUnlimited] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);
  const selected = new Set(permissions);

  function editRole(role: AppRole) {
    setSelectedId(role.id);
    setName(role.name);
    setUnlimited(role.approvalLimit === null);
    setApprovalLimit(role.approvalLimit !== null ? String(role.approvalLimit) : "");
    setPermissions(role.permissions);
  }

  function newRole() {
    setSelectedId("new");
    setName("");
    setUnlimited(true);
    setApprovalLimit("");
    setPermissions([]);
  }

  function togglePermission(permission: string) {
    setPermissions((current) => {
      const next = new Set(current);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return Array.from(next).sort();
    });
  }

  async function saveRole() {
    const body = {
      id: selectedId === "new" ? undefined : selectedId,
      name,
      permissions,
      approvalLimit: unlimited ? null : Number(approvalLimit || 0)
    };
    const ok = await onSave(selectedId === "new" ? "POST" : "PATCH", body, selectedId === "new" ? "Grupo criado com sucesso." : "Grupo atualizado com sucesso.");
    if (ok && selectedId === "new") newRole();
  }

  async function deleteRole() {
    if (selectedId === "new" || !selectedRole) return;
    const ok = await onSave("DELETE", { id: selectedId }, "Grupo excluído com sucesso.");
    if (ok) newRole();
  }

  return (
    <ModalShell title="Papéis e grupos" subtitle="Crie grupos com alçada e permissões próprias para atribuir aos usuários" onClose={onClose}>
      <div className="roles-modal-layout">
        <div className="roles-list">
          <button className={`role-list-item ${selectedId === "new" ? "active" : ""}`} type="button" onClick={newRole}>
            <strong><I18nText text={"Novo grupo"} /></strong>
            <small><I18nText text={"Cadastro em branco"} /></small>
          </button>
          {roles.map((role) => (
            <button className={`role-list-item ${selectedId === role.id ? "active" : ""}`} type="button" key={role.id} onClick={() => editRole(role)}>
              <strong>{roleLabel(role.name)}</strong>
              <small>{role.userCount} <I18nText text={"usuário(s) -"} /> {role.approvalLimit !== null ? formatCurrency(role.approvalLimit) : <I18nText text={"sem limite"} />}</small>
            </button>
          ))}
        </div>

        <div className="role-editor">
          <div className="settings-modal-form">
            <label>
              <span><I18nText text={"Nome do grupo"} /></span>
              <input value={name} disabled={saving || Boolean(selectedRole?.system)} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Compras obra norte" data-i18n-placeholder={"Ex.: Compras obra norte"} />
            </label>
            <label>
              <span><I18nText text={"Alçada do grupo"} /></span>
              <select value={unlimited ? "unlimited" : "limited"} disabled={saving} onChange={(event) => setUnlimited(event.target.value === "unlimited")}>
                <option value="unlimited"><I18nText text={"Sem limite"} /></option>
                <option value="limited"><I18nText text={"Limite por valor"} /></option>
              </select>
            </label>
            <label>
              <span><I18nText text={"Valor da alçada"} /></span>
              <input disabled={saving || unlimited} min="0" step="0.01" type="number" value={approvalLimit} onChange={(event) => setApprovalLimit(event.target.value)} placeholder="50000" data-i18n-placeholder={"50000"} />
            </label>
          </div>

          <div className="permission-grid modal-grid">
            {[...screenPermissionDefinitions, ...operationalPermissionDefinitions].map((permission) => (
              <label className="permission-toggle" key={permission.permission}>
                <input
                  checked={selected.has(permission.permission)}
                  disabled={saving}
                  type="checkbox"
                  onChange={() => togglePermission(permission.permission)}
                />
                <span>
                  <strong><I18nText text={permission.label} /></strong>
                  <small>{permission.description}</small>
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="settings-modal-actions">
        {selectedRole && !selectedRole.system && (
          <button className="payable-review-button compact warn" type="button" disabled={saving || selectedRole.userCount > 0} onClick={() => void deleteRole()}>
            <I18nText text={"Excluir grupo"} />
          </button>
        )}
        <button className="payable-review-button compact" type="button" onClick={onClose}><I18nText text={"Fechar"} /></button>
        <button className="button" type="button" disabled={saving || !name.trim()} onClick={() => void saveRole()}>
          {saving ? <I18nText text={"Salvando..."} /> : selectedId === "new" ? <I18nText text={"Criar grupo"} /> : <I18nText text={"Salvar grupo"} />}
        </button>
      </div>
    </ModalShell>
  );
}

export function UsersManager({ initialUsers, roles, currentUserId }: { initialUsers: AppUser[]; roles: AppRole[]; currentUserId: number }) {
  const [users, setUsers] = useState(initialUsers);
  const [roleList, setRoleList] = useState(roles);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);

  async function callUsersApi(method: "POST" | "PATCH", body: Record<string, unknown>, successMessage: string) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/users", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await response.json() as { users?: AppUser[]; roles?: AppRole[]; message?: string };
      if (!response.ok) throw new Error(json.message || "Não foi possível salvar.");
      if (json.users) setUsers(json.users);
      if (json.roles) setRoleList(json.roles);
      setMessage(successMessage);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(user: AppUser) {
    const newPassword = window.prompt(`Nova senha para ${user.name} (mínimo 8 caracteres):`);
    if (!newPassword) return;
    await callUsersApi("PATCH", { id: user.id, password: newPassword }, `Senha de ${user.name} atualizada.`);
  }

  async function callRolesApi(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, successMessage: string) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/users/roles", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const json = await response.json() as { users?: AppUser[]; roles?: AppRole[]; message?: string };
      if (!response.ok) throw new Error(json.message || "Não foi possível salvar o grupo.");
      if (json.users) setUsers(json.users);
      if (json.roles) setRoleList(json.roles);
      setMessage(successMessage);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="users-manager">
      <div className="users-toolbar card panel">
        <div>
          <h2 className="panel-title"><I18nText text={"Usuários e acessos"} /></h2>
          <span className="panel-note"><I18nText text={"Edite cada responsabilidade em uma janela própria"} /></span>
        </div>
        <div className="users-toolbar-actions">
          <button className="button secondary" type="button" onClick={() => setModal({ type: "roles" })}><I18nText text={"Papéis e grupos"} /></button>
          <button className="button" type="button" onClick={() => setModal({ type: "create" })}><I18nText text={"Novo usuário"} /></button>
        </div>
      </div>

      {message && <div className="settings-inline-message"><I18nText text={message} /></div>}

      <div className="users-list">
        {users.map((user) => (
          <article className="card panel user-card compact" key={user.id}>
            <div className="user-card-head compact">
              <div>
                <h2 className="panel-title">
                  {user.name}
                  {user.id === currentUserId && <i className="badge"><I18nText text={"você"} /></i>}
                  {!user.active && <i className="badge muted"><I18nText text={"inativo"} /></i>}
                </h2>
                <span className="panel-note">{user.email}</span>
              </div>
              <div className="user-card-summary">
                <span><strong>{roleLabel(user.roles[0] || "Sem papel")}</strong><small><I18nText text={"Papel"} /></small></span>
                <span><strong>{approvalText(user)}</strong><small><I18nText text={"Alçada"} /></small></span>
                <span><strong>{user.permissions.filter((permission) => permission.startsWith("screen.")).length}</strong><small><I18nText text={"Telas"} /></small></span>
              </div>
              <div className="users-manager-actions">
                <button className="payable-review-button compact" type="button" disabled={saving} onClick={() => setModal({ type: "profile", user })}>
                  <I18nText text={"Perfil e alçada"} />
                </button>
                <button className="payable-review-button compact" type="button" disabled={saving} onClick={() => setModal({ type: "screens", user })}>
                  <I18nText text={"Telas"} />
                </button>
                <button className="payable-review-button compact" type="button" disabled={saving} onClick={() => setModal({ type: "operations", user })}>
                  <I18nText text={"Operações"} />
                </button>
                <button className="payable-review-button compact" type="button" disabled={saving} onClick={() => void resetPassword(user)}>
                  <I18nText text={"Senha"} />
                </button>
                <button
                  className={`payable-review-button compact ${user.active ? "warn" : ""}`}
                  type="button"
                  disabled={saving || user.id === currentUserId}
                  onClick={() => void callUsersApi("PATCH", { id: user.id, active: !user.active }, `${user.name} ${user.active ? "desativado" : "reativado"}.`)}
                >
                  <I18nText text={user.active ? "Desativar" : "Reativar"} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="advanced-search-hint">
        <I18nText text={"Telas controlam menu e acesso por URL. Operações controlam ações sensíveis dentro das telas, como aprovar cotação, gerar links, gerenciar usuários e gravar no Sienge."} />
      </div>

      {modal?.type === "create" && (
        <CreateUserModal roles={roleList} saving={saving} onClose={() => setModal(null)} onCreate={(body, success) => callUsersApi("POST", body, success)} />
      )}
      {modal?.type === "roles" && (
        <RolesModal roles={roleList} saving={saving} onClose={() => setModal(null)} onSave={(method, body, success) => callRolesApi(method, body, success)} />
      )}
      {modal?.type === "profile" && (
        <ProfileModal user={modal.user} roles={roleList} saving={saving} onClose={() => setModal(null)} onSave={(body, success) => callUsersApi("PATCH", body, success)} />
      )}
      {modal?.type === "screens" && (
        <PermissionModal user={modal.user} type="screens" saving={saving} onClose={() => setModal(null)} onSave={(body, success) => callUsersApi("PATCH", body, success)} />
      )}
      {modal?.type === "operations" && (
        <PermissionModal user={modal.user} type="operations" saving={saving} onClose={() => setModal(null)} onSave={(body, success) => callUsersApi("PATCH", body, success)} />
      )}
    </section>
  );
}
