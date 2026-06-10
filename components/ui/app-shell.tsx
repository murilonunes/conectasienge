import Link from "next/link";

const navigation = [
  ["Dashboard", "/dashboard", "D"],
  ["Financeiro", "/financeiro", "F"],
  ["Portal de vendas", "/sales", "V"],
  ["Portal de compras", "/compras", "CP"],
  ["Bens em estoque", "/estoque", "E"],
  ["Contratos", "/contratos", "C"],
  ["Conciliação", "/conciliacao", "CC"],
  ["Contas a pagar", "/contas-pagar", "P"],
  ["Contas a receber", "/contas-receber", "R"],
  ["Novo lançamento", "/lancamentos/novo", "+"],
  ["Baixa de parcela", "/lancamentos/baixa", "B"],
  ["Relatórios", "/relatorios", "G"]
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">B</div>
          <div><strong>Brasin</strong><span>GESTÃO FINANCEIRA</span></div>
        </div>
        <nav>
          <p className="nav-label">VISÃO GERAL</p>
          {navigation.slice(0, 5).map(([label, href, icon]) => (
            <Link className="nav-link" href={href} key={href}><span className="nav-icon">{icon}</span>{label}</Link>
          ))}
          <p className="nav-label">OPERAÇÕES</p>
          {navigation.slice(5, 11).map(([label, href, icon]) => (
            <Link className="nav-link" href={href} key={href}><span className="nav-icon">{icon}</span>{label}</Link>
          ))}
          <p className="nav-label">ANÁLISE</p>
          {navigation.slice(11).map(([label, href, icon]) => (
            <Link className="nav-link" href={href} key={href}><span className="nav-icon">{icon}</span>{label}</Link>
          ))}
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="user">
            <span className="integration-dot" aria-hidden="true" />
            <div><strong>Sienge</strong><br /><span className="panel-note">Integração API</span></div>
            <div className="avatar">API</div>
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
