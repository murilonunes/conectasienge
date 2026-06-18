import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";

export default function Home() {
  const shortcuts = [
    { title: "Dashboard", href: "/dashboard", note: "Visão geral com gráficos e indicadores" },
    { title: "Central financeira", href: "/financeiro", note: "Atalhos para rotinas financeiras" },
    { title: "Contas a pagar", href: "/contas-pagar", note: "Agenda de pagamentos e vencimentos" },
    { title: "Contas a receber", href: "/contas-receber", note: "Previsão de recebimentos" },
    { title: "Vendas", href: "/sales", note: "Contratos e vendas por mês" },
    { title: "Configurações", href: "/configuracoes", note: "Parâmetros e histórico de atualização" }
  ];

  return (
    <>
      <PageHeading
        eyebrow="Bem-vindo"
        title="Brasin Financeiro"
        subtitle="Entrada rápida do sistema. Esta tela não carrega dados pesados, para abrir sempre sem demora."
      />

      <section className="card welcome-hero">
        <div>
          <span>Início rápido</span>
          <h2>Escolha onde quer começar</h2>
          <p>
            Use esta abertura para acessar os portais com calma. As atualizações do Sienge ficam concentradas em Configurações.
          </p>
        </div>
        <Link className="button" href="/dashboard">Abrir dashboard</Link>
      </section>

      <section className="welcome-shortcuts">
        {shortcuts.map((shortcut) => (
          <Link className="card welcome-shortcut" href={shortcut.href} key={shortcut.href}>
            <strong>{shortcut.title}</strong>
            <span>{shortcut.note}</span>
          </Link>
        ))}
      </section>
    </>
  );
}
