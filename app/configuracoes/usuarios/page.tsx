import { I18nText } from "@/components/i18n/i18n-text";
import Link from "next/link";
import { cookies } from "next/headers";
import { UsersManager } from "@/components/settings/users-manager";
import { getSessionUserFromCookieValue, listAppRoles, listAppUsers } from "@/lib/app-users";

export const dynamic = "force-dynamic";

export default function UsersPage() {
  const sessionUser = getSessionUserFromCookieValue(cookies().get("brasin_session")?.value);

  if (!sessionUser?.permissions.includes("users.manage")) {
    return (
      <main className="users-page">
        <div className="card panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title"><I18nText text={"Usuários e alçadas"} /></h2>
              <span className="panel-note"><I18nText text={"Acesso restrito"} /></span>
            </div>
          </div>
          <div className="empty-state">
            <I18nText text={"Seu perfil não tem permissão para gerenciar usuários. Peça a um administrador."} />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="users-page">
      <div className="page-actions">
        <Link className="button secondary" href="/configuracoes"><I18nText text={"Voltar para configurações"} /></Link>
      </div>
      <UsersManager initialUsers={listAppUsers()} roles={listAppRoles()} currentUserId={sessionUser.id} />
    </main>
  );
}
