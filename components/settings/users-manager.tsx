"use client";

import { useState } from "react";
import type { AppRole, AppUser } from "@/lib/app-users";
import { formatCurrency } from "@/lib/formatters";

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  aprovador: "Aprovador",
  comprador: "Comprador"
};

function roleLabel(name: string) {
  return roleLabels[name] || name;
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
            <span className="panel-note">Cada pessoa entra com o próprio e-mail; o papel define permissões e alçada</span>
          </div>
        </div>
        <div className="users-manager-form">
          <label><span>Nome</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome completo" /></label>
          <label><span>E-mail</span><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="pessoa@brasin.com.br" /></label>
          <label><span>Senha inicial</span><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Mínimo 8 caracteres" /></label>
          <label>
            <span>Papel</span>
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              {roles.map((current) => (
                <option value={current.name} key={current.id}>
                  {roleLabel(current.name)}{current.approvalLimit !== null ? ` — alçada ${formatCurrency(current.approvalLimit)}` : " — sem limite"}
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

      <div className="card panel">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Usuários cadastrados</h2>
            <span className="panel-note">Papéis e alçadas seguem a modelagem de permissões por papel</span>
          </div>
          <i className="badge">{users.filter((user) => user.active).length} ativos</i>
        </div>
        <table className="users-manager-table">
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Papel</th>
              <th>Alçada</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <strong>{user.name}</strong>{user.id === currentUserId && <i className="badge">você</i>}
                  <br /><span className="table-muted">{user.email}</span>
                </td>
                <td>
                  <select
                    value={user.roles[0] || ""}
                    disabled={saving}
                    onChange={(event) => void callUsersApi("PATCH", { id: user.id, role: event.target.value }, `Papel de ${user.name} atualizado.`)}
                  >
                    {roles.map((current) => <option value={current.name} key={current.id}>{roleLabel(current.name)}</option>)}
                  </select>
                </td>
                <td>{user.approvalLimit !== null ? formatCurrency(user.approvalLimit) : "Sem limite"}</td>
                <td><i className={`badge ${user.active ? "" : "muted"}`}>{user.active ? "Ativo" : "Inativo"}</i></td>
                <td>
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="advanced-search-hint">
        Papéis padrão: Administrador (tudo, inclusive usuários), Aprovador (decide sem limite) e Comprador (opera cotações e aprova até a alçada do papel).
        As decisões salvas registram o nome de quem aprovou e aparecem no relatório de decisão.
      </div>
    </section>
  );
}
