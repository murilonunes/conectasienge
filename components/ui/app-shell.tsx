import { cookies } from "next/headers";
import { headers } from "next/headers";
import { I18nText } from "@/components/i18n/i18n-text";
import { screenPermissionForPath } from "@/lib/app-permissions";
import { getAppSettings } from "@/lib/settings";
import { getSessionUserFromCookieValue } from "@/lib/app-users";
import { AppShellClient } from "@/components/ui/app-shell-client";
import { localeCookieName, resolveLocale } from "@/lib/i18n/config";
import { translateUiText } from "@/lib/i18n/messages";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "BR";
}

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  aprovador: "Aprovador",
  comprador: "Comprador"
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const settings = getAppSettings();
  const locale = resolveLocale(cookies().get(localeCookieName)?.value);
  const user = getSessionUserFromCookieValue(cookies().get("brasin_session")?.value);
  const path = headers().get("x-current-path") || "/";
  const requiredScreenPermission = screenPermissionForPath(path);
  const blocked = Boolean(user && requiredScreenPermission && !user.permissions.includes(requiredScreenPermission));

  // Com usuário logado, a topbar mostra quem está operando (trilha visível);
  // sem sessão válida ainda renderizamos com os dados padrão das configurações.
  const shellSettings = user
    ? {
        responsibleName: user.name,
        responsibleRole: user.roles
          .map((role) => roleLabels[role] ? translateUiText(roleLabels[role], locale) : role)
          .join(", ") || translateUiText("Usuário", locale),
        responsibleInitials: initials(user.name)
      }
    : settings;

  return (
    <AppShellClient settings={shellSettings} allowedPermissions={user?.permissions}>
      {blocked ? (
        <div className="card panel access-denied-panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title"><I18nText text="Acesso não liberado" /></h2>
              <span className="panel-note"><I18nText text="Seu usuário não tem permissão para esta tela" /></span>
            </div>
          </div>
          <div className="empty-state"><I18nText text="Peça para um administrador liberar esta tela no cadastro de usuários." /></div>
        </div>
      ) : children}
    </AppShellClient>
  );
}
