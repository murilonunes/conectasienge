import { cookies } from "next/headers";
import { getAppSettings } from "@/lib/settings";
import { getSessionUserFromCookieValue } from "@/lib/app-users";
import { AppShellClient } from "@/components/ui/app-shell-client";

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
  const user = getSessionUserFromCookieValue(cookies().get("brasin_session")?.value);

  // Com usuário logado, a topbar mostra quem está operando (trilha visível);
  // sem sessão válida ainda renderizamos com os dados padrão das configurações.
  const shellSettings = user
    ? {
        responsibleName: user.name,
        responsibleRole: user.roles.map((role) => roleLabels[role] || role).join(", ") || "Usuário",
        responsibleInitials: initials(user.name)
      }
    : settings;

  return <AppShellClient settings={shellSettings}>{children}</AppShellClient>;
}
