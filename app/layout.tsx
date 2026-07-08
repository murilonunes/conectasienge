import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { AppShell } from "@/components/ui/app-shell";

export const metadata: Metadata = {
  title: "Brasin Financeiro",
  description: "Gestão financeira integrada ao Sienge"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const path = headers().get("x-current-path") || "";
  // O relatório de decisão e o mapa em PDF continuam protegidos por sessão, mas
  // renderizam sem o shell (menu/topbar) para sair limpos na impressão em PDF.
  const publicExperience = path.startsWith("/portal-cotacao") || path.startsWith("/login") || path.endsWith("/relatorio-decisao") || path.endsWith("/mapa-pdf");

  return (
    <html lang="pt-BR">
      <body>{publicExperience ? children : <AppShell>{children}</AppShell>}</body>
    </html>
  );
}
