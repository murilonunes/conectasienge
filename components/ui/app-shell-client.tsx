"use client";

import { I18nText } from "@/components/i18n/i18n-text";
import {
  ArrowLeftRight,
  Boxes,
  ChartColumnBig,
  ChartLine,
  ChartPie,
  CircleCheckBig,
  ClipboardList,
  Columns3,
  FileSignature,
  Files,
  Gauge,
  HandCoins,
  Landmark,
  LayoutDashboard,
  Map,
  Receipt,
  Search,
  Scale,
  Settings,
  Shield,
  ShoppingBag,
  ShoppingCart,
  SquareCheckBig,
  Store,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useI18n } from "@/components/i18n/i18n-provider";

type ShellSettings = {
  responsibleName: string;
  responsibleRole: string;
  responsibleInitials: string;
};

type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: string;
};

type NavigationSection = {
  key: string;
  label: string;
  icon: LucideIcon;
  items: NavigationItem[];
};

const navigationSections: NavigationSection[] = [
  {
    key: "overview",
    label: "Visao geral",
    icon: Gauge,
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "screen.dashboard" },
      { label: "Central financeira", href: "/financeiro", icon: Landmark, permission: "screen.financeiro" }
    ]
  },
  {
    key: "purchases",
    label: "Compras",
    icon: ShoppingCart,
    items: [
      { label: "Portal de compras", href: "/compras", icon: ShoppingBag, permission: "screen.compras" },
      { label: "Rastreabilidade de insumos", href: "/rastreabilidade-insumos", icon: Search, permission: "screen.rastreabilidade-insumos" },
      { label: "Solicitacoes", href: "/solicitacoes-compra", icon: ClipboardList, permission: "screen.solicitacoes" },
      { label: "Kanban de projetos", href: "/kanban-compras", icon: Columns3, permission: "screen.kanban-compras" },
      { label: "Cotacoes", href: "/cotacoes", icon: Scale, permission: "screen.cotacoes" }
    ]
  },
  {
    key: "finance",
    label: "Financeiro",
    icon: Wallet,
    items: [
      { label: "Títulos", href: "/titulos", icon: Files, permission: "screen.titulos" },
      { label: "Contas a pagar", href: "/contas-pagar", icon: Receipt, permission: "screen.contas-pagar" },
      { label: "Contas a receber", href: "/contas-receber", icon: HandCoins, permission: "screen.contas-receber" },
      { label: "Baixa a pagar", href: "/lancamentos/baixa", icon: SquareCheckBig, permission: "screen.baixa-pagar" },
      { label: "Baixa a receber", href: "/lancamentos/baixa-receber", icon: CircleCheckBig, permission: "screen.baixa-receber" },
      { label: "Conciliacao", href: "/conciliacao", icon: ArrowLeftRight, permission: "screen.conciliacao" }
    ]
  },
  {
    key: "commercial",
    label: "Comercial e estoque",
    icon: Store,
    items: [
      { label: "Portal de vendas", href: "/sales", icon: TrendingUp, permission: "screen.vendas" },
      { label: "Contratos", href: "/contratos", icon: FileSignature, permission: "screen.contratos" },
      { label: "Bens em estoque", href: "/estoque", icon: Boxes, permission: "screen.estoque" }
    ]
  },
  {
    key: "analysis",
    label: "Analises",
    icon: ChartColumnBig,
    items: [
      { label: "Relatorios", href: "/relatorios", icon: ChartPie, permission: "screen.relatorios" },
      { label: "DRE financeiro", href: "/dre-financeiro", icon: ChartLine, permission: "screen.dre-financeiro" },
      { label: "DRE POC", href: "/dre-gerencial", icon: TrendingUp, permission: "screen.dre" },
      { label: "Mapa Sienge", href: "/sienge", icon: Map, permission: "screen.sienge" }
    ]
  },
  {
    key: "settings",
    label: "Administracao",
    icon: Shield,
    items: [
      { label: "Configuracoes", href: "/configuracoes", icon: Settings, permission: "screen.configuracoes" },
      { label: "Usuarios", href: "/configuracoes/usuarios", icon: Users, permission: "screen.usuarios" }
    ]
  }
];

const pinnedStorageKey = "brasin-sidebar-pinned-v1";
const legacyCollapsedStorageKey = "brasin-sidebar-collapsed-v2";
const sectionsStorageKey = "brasin-sidebar-sections-v2";

function defaultOpenSections() {
  return Object.fromEntries(navigationSections.map((section) => [section.key, false])) as Record<string, boolean>;
}

function isPathActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShellClient({ children, settings, allowedPermissions }: { children: React.ReactNode; settings: ShellSettings; allowedPermissions?: string[] }) {
  const pathname = usePathname() || "/";
  const { t } = useI18n();
  const [pinned, setPinned] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(defaultOpenSections);
  const expanded = pinned || hovering;
  const allowed = useMemo(() => new Set(allowedPermissions || []), [allowedPermissions]);
  const visibleSections = useMemo(() => {
    if (!allowedPermissions) return navigationSections;
    return navigationSections
      .map((section) => ({ ...section, items: section.items.filter((item) => allowed.has(item.permission)) }))
      .filter((section) => section.items.length > 0);
  }, [allowed, allowedPermissions]);

  const activeSectionKey = useMemo(() => {
    return visibleSections.find((section) => section.items.some((item) => isPathActive(pathname, item.href)))?.key;
  }, [pathname, visibleSections]);

  useEffect(() => {
    try {
      const storedPinned = window.localStorage.getItem(pinnedStorageKey);
      if (storedPinned !== null) {
        setPinned(storedPinned === "true");
      } else {
        // Migração da preferência antiga: quem mantinha o menu aberto vira "fixado".
        const legacyCollapsed = window.localStorage.getItem(legacyCollapsedStorageKey);
        setPinned(legacyCollapsed === "false");
      }
      const storedSections = window.localStorage.getItem(sectionsStorageKey);
      if (storedSections) {
        setOpenSections({ ...defaultOpenSections(), ...JSON.parse(storedSections) });
      }
    } catch {
      setOpenSections(defaultOpenSections());
    }
    setHydrated(true);
  }, []);

  // Só persiste depois de carregar o valor salvo: sem o guard, o efeito roda no
  // mount com o estado inicial e sobrescreve a preferência gravada.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(pinnedStorageKey, String(pinned));
    } catch {
      // Ignore storage restrictions.
    }
  }, [hydrated, pinned]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(sectionsStorageKey, JSON.stringify(openSections));
    } catch {
      // Ignore storage restrictions.
    }
  }, [hydrated, openSections]);

  function toggleSection(sectionKey: string) {
    setOpenSections((current) => ({ ...current, [sectionKey]: !current[sectionKey] }));
  }

  return (
    <div className={`shell${pinned ? "" : " sidebar-collapsed"}${!pinned && hovering ? " sidebar-hover-open" : ""}`}>
      <aside
        className="sidebar"
        aria-label={t("Menu principal")}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onFocusCapture={() => setHovering(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHovering(false);
        }}
      >
        <div className="sidebar-top">
          <Link className="brand" href="/" aria-label={t("Ir para a tela inicial")}>
            <div className="brand-mark"><I18nText text={"B"} /></div>
            <div className="brand-text"><strong><I18nText text={"Brasin"} /></strong><span>{t("GESTAO FINANCEIRA")}</span></div>
          </Link>
          {expanded && (
            <button
              aria-label={t(pinned ? "Soltar menu (expande ao passar o mouse)" : "Fixar menu aberto")}
              aria-pressed={pinned}
              className={`sidebar-toggle${pinned ? " pinned" : ""}`}
              onClick={() => setPinned((current) => !current)}
              title={t(pinned ? "Soltar menu (expande ao passar o mouse)" : "Fixar menu aberto")}
              type="button"
            >
              {t(pinned ? "Soltar" : "Fixar")}
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {visibleSections.map((section) => {
            const expanded = openSections[section.key];
            const sectionActive = activeSectionKey === section.key;

            return (
              <div className={`nav-section${sectionActive ? " active" : ""}`} key={section.key}>
                <button
                  aria-expanded={expanded}
                  className="nav-section-button"
                  onClick={() => toggleSection(section.key)}
                  title={t(section.label)}
                  type="button"
                >
                  <span className="nav-section-icon"><section.icon aria-hidden="true" size={16} strokeWidth={2.1} /></span>
                  <span className="nav-section-title">{t(section.label)}</span>
                  <span className="nav-caret" aria-hidden="true"><I18nText text={expanded ? "-" : "+"} /></span>
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
                        title={t(item.label)}
                      >
                        <span className="nav-icon"><item.icon aria-hidden="true" size={14} strokeWidth={2} /></span>
                        <span className="nav-link-text">{t(item.label)}</span>
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
            <LanguageSwitcher compact />
            <span className="integration-dot" aria-hidden="true" />
            <div><strong><I18nText text={"Sienge"} /></strong><br /><span className="panel-note">{t("Integracao")}</span></div>
            <div><strong>{settings.responsibleName}</strong><br /><span className="panel-note">{settings.responsibleRole}</span></div>
            <div className="avatar">{settings.responsibleInitials}</div>
            <form action="/api/auth/logout" method="post">
              <button className="logout-button" type="submit">{t("Sair")}</button>
            </form>
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
