import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { I18nProvider } from "@/components/i18n/i18n-provider";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { AppShell } from "@/components/ui/app-shell";
import { localeCookieName, localeLanguage, resolveLocale } from "@/lib/i18n/config";

export function generateMetadata(): Metadata {
  const locale = resolveLocale(cookies().get(localeCookieName)?.value);
  return {
    title: locale === "en-US" ? "Brasin Finance" : "Brasin Financeiro",
    description: locale === "en-US"
      ? "Financial management integrated with Sienge"
      : "Gestão financeira integrada ao Sienge"
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const path = headers().get("x-current-path") || "";
  const locale = resolveLocale(cookies().get(localeCookieName)?.value);
  // Os relatórios continuam protegidos por sessão, mas renderizam sem o shell
  // (menu/topbar) para saírem limpos na impressão em PDF.
  const publicExperience = path.startsWith("/portal-cotacao")
    || path.startsWith("/login")
    || path.endsWith("/relatorio-decisao")
    || path.endsWith("/mapa-pdf")
    || path.endsWith("/solicitacao-fornecedor")
    || path.endsWith("/solicitacao-fornecedor-resumida");

  return (
    <html lang={localeLanguage(locale)}>
      <body>
        <I18nProvider initialLocale={locale}>
          {publicExperience ? (
            <>
              <div className="public-language-switcher"><LanguageSwitcher compact /></div>
              {children}
            </>
          ) : (
            <AppShell>{children}</AppShell>
          )}
        </I18nProvider>
      </body>
    </html>
  );
}
