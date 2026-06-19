import Link from "next/link";
import { getAppSettings } from "@/lib/settings";

const overviewNavigation = [
  ["Início", "/", "I"],
  ["Dashboard", "/dashboard", "D"],
  ["Central financeira", "/financeiro", "F"],
  ["Portal de vendas", "/sales", "V"],
  ["Portal de compras", "/compras", "CP"],
  ["Bens em estoque", "/estoque", "E"]
] as const;

const operationNavigation = [
  ["Contratos", "/contratos", "C"],
  ["Conciliação", "/conciliacao", "CC"],
  ["Contas a pagar", "/contas-pagar", "P"],
  ["Contas a receber", "/contas-receber", "R"],
  ["Novo lançamento", "/lancamentos/novo", "+"],
  ["Baixa de parcela", "/lancamentos/baixa", "B"]
] as const;

const analysisNavigation = [
  ["Relatórios", "/relatorios", "G"],
  ["DRE gerencial", "/dre-gerencial", "="]
] as const;
const settingsNavigation = [["Configurações", "/configuracoes", "CF"]] as const;

function NavigationGroup({ label, items }: { label: string; items: readonly (readonly [string, string, string])[] }) {
  return (
    <>
      <p className="nav-label">{label}</p>
      {items.map(([itemLabel, href, icon]) => (
        <Link className="nav-link" href={href} key={href}><span className="nav-icon">{icon}</span>{itemLabel}</Link>
      ))}
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const settings = getAppSettings();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">B</div>
          <div><strong>Brasin</strong><span>GESTÃO FINANCEIRA</span></div>
        </div>
        <nav>
          <NavigationGroup label="VISÃO GERAL" items={overviewNavigation} />
          <NavigationGroup label="OPERAÇÕES" items={operationNavigation} />
          <NavigationGroup label="ANÁLISE" items={analysisNavigation} />
          <NavigationGroup label="CONFIGURAÇÕES" items={settingsNavigation} />
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="user">
            <span className="integration-dot" aria-hidden="true" />
            <div><strong>Sienge</strong><br /><span className="panel-note">Integração</span></div>
            <div><strong>{settings.responsibleName}</strong><br /><span className="panel-note">{settings.responsibleRole}</span></div>
            <div className="avatar">{settings.responsibleInitials}</div>
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
