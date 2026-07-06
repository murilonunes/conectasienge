"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ShellSettings = {
  responsibleName: string;
  responsibleRole: string;
  responsibleInitials: string;
};

type NavigationItem = {
  label: string;
  href: string;
  icon: string;
};

type NavigationSection = {
  key: string;
  label: string;
  icon: string;
  items: NavigationItem[];
};

const navigationSections: NavigationSection[] = [
  {
    key: "overview",
    label: "Visao geral",
    icon: "VG",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "D" },
      { label: "Central financeira", href: "/financeiro", icon: "F" }
    ]
  },
  {
    key: "purchases",
    label: "Compras",
    icon: "CP",
    items: [
      { label: "Portal de compras", href: "/compras", icon: "PC" },
      { label: "Solicitacoes", href: "/solicitacoes-compra", icon: "SC" },
      { label: "Cotacoes", href: "/cotacoes", icon: "CT" }
    ]
  },
  {
    key: "finance",
    label: "Financeiro",
    icon: "FI",
    items: [
      { label: "Contas a pagar", href: "/contas-pagar", icon: "PG" },
      { label: "Contas a receber", href: "/contas-receber", icon: "RC" },
      { label: "Baixa a pagar", href: "/lancamentos/baixa", icon: "BP" },
      { label: "Baixa a receber", href: "/lancamentos/baixa-receber", icon: "BR" },
      { label: "Conciliacao", href: "/conciliacao", icon: "CC" }
    ]
  },
  {
    key: "commercial",
    label: "Comercial e estoque",
    icon: "CE",
    items: [
      { label: "Portal de vendas", href: "/sales", icon: "VD" },
      { label: "Contratos", href: "/contratos", icon: "CO" },
      { label: "Bens em estoque", href: "/estoque", icon: "ES" }
    ]
  },
  {
    key: "analysis",
    label: "Analises",
    icon: "AN",
    items: [
      { label: "Relatorios", href: "/relatorios", icon: "RL" },
      { label: "DRE POC", href: "/dre-gerencial", icon: "DR" },
      { label: "Mapa Sienge", href: "/sienge", icon: "SI" }
    ]
  },
  {
    key: "settings",
    label: "Administracao",
    icon: "AD",
    items: [
      { label: "Configuracoes", href: "/configuracoes", icon: "CF" }
    ]
  }
];

const collapsedStorageKey = "brasin-sidebar-collapsed-v2";
const sectionsStorageKey = "brasin-sidebar-sections-v2";

function defaultOpenSections() {
  return Object.fromEntries(navigationSections.map((section) => [section.key, false])) as Record<string, boolean>;
}

function isPathActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShellClient({ children, settings }: { children: React.ReactNode; settings: ShellSettings }) {
  const pathname = usePathname() || "/";
  const [collapsed, setCollapsed] = useState(true);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(defaultOpenSections);

  const activeSectionKey = useMemo(() => {
    return navigationSections.find((section) => section.items.some((item) => isPathActive(pathname, item.href)))?.key;
  }, [pathname]);

  useEffect(() => {
    try {
      const storedCollapsed = window.localStorage.getItem(collapsedStorageKey);
      setCollapsed(storedCollapsed === null ? true : storedCollapsed === "true");
      const storedSections = window.localStorage.getItem(sectionsStorageKey);
      if (storedSections) {
        setOpenSections({ ...defaultOpenSections(), ...JSON.parse(storedSections) });
      }
    } catch {
      setOpenSections(defaultOpenSections());
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(collapsedStorageKey, String(collapsed));
    } catch {
      // Ignore storage restrictions.
    }
  }, [collapsed]);

  useEffect(() => {
    try {
      window.localStorage.setItem(sectionsStorageKey, JSON.stringify(openSections));
    } catch {
      // Ignore storage restrictions.
    }
  }, [openSections]);

  function toggleSection(sectionKey: string) {
    setOpenSections((current) => ({ ...current, [sectionKey]: !current[sectionKey] }));
  }

  return (
    <div className={`shell${collapsed ? " sidebar-collapsed" : ""}`}>
      <aside className="sidebar" aria-label="Menu principal">
        <div className="sidebar-top">
          <Link className="brand" href="/" aria-label="Ir para a tela inicial">
            <div className="brand-mark">B</div>
            <div className="brand-text"><strong>Brasin</strong><span>GESTAO FINANCEIRA</span></div>
          </Link>
          <button
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            className="sidebar-toggle"
            onClick={() => setCollapsed((current) => !current)}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            type="button"
          >
            {collapsed ? ">>" : "<<"}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navigationSections.map((section) => {
            const expanded = openSections[section.key];
            const sectionActive = activeSectionKey === section.key;

            return (
              <div className={`nav-section${sectionActive ? " active" : ""}`} key={section.key}>
                <button
                  aria-expanded={expanded}
                  className="nav-section-button"
                  onClick={() => toggleSection(section.key)}
                  title={section.label}
                  type="button"
                >
                  <span className="nav-section-icon">{section.icon}</span>
                  <span className="nav-section-title">{section.label}</span>
                  <span className="nav-caret" aria-hidden="true">{expanded ? "-" : "+"}</span>
                </button>

                <div className={`nav-submenu${expanded ? " open" : ""}`}>
                  {section.items.map((item) => {
                    const active = isPathActive(pathname, item.href);
                    return (
                      <Link
                        aria-current={active ? "page" : undefined}
                        className={`nav-link${active ? " active" : ""}`}
                        href={item.href}
                        key={item.href}
                        title={item.label}
                      >
                        <span className="nav-icon">{item.icon}</span>
                        <span className="nav-link-text">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="user">
            <span className="integration-dot" aria-hidden="true" />
            <div><strong>Sienge</strong><br /><span className="panel-note">Integracao</span></div>
            <div><strong>{settings.responsibleName}</strong><br /><span className="panel-note">{settings.responsibleRole}</span></div>
            <div className="avatar">{settings.responsibleInitials}</div>
            <form action="/api/auth/logout" method="post">
              <button className="logout-button" type="submit">Sair</button>
            </form>
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
