import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/ui/app-shell";

export const metadata: Metadata = {
  title: "Brasin Financeiro",
  description: "Gestão financeira integrada ao Sienge"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
