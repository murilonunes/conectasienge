import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { loadSiengeCoverageDashboard, type SiengeCoverageModule, type SiengeCoverageStatus } from "@/features/sienge-coverage/data";

export const dynamic = "force-dynamic";

const statusLabels: Record<SiengeCoverageStatus, string> = {
  active: "Em uso",
  partial: "Parcial",
  ready: "Preparado",
  unused: "Não usado"
};

const statusNotes: Record<SiengeCoverageStatus, string> = {
  active: "Dados salvos e tela usando",
  partial: "Parte dos dados está salva",
  ready: "Implementado, mas sem base local",
  unused: "Ainda não integrado"
};

function compactNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatDate(value?: string) {
  if (!value) return "Sem atualização";
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function statusClass(status: SiengeCoverageStatus) {
  return `sienge-status ${status}`;
}

function ModuleCard({ module }: { module: SiengeCoverageModule }) {
  return (
    <article className={`card sienge-module ${module.status}`}>
      <div className="sienge-module-head">
        <div>
          <span>{module.area}</span>
          <h2>{module.title}</h2>
          <p>{module.description}</p>
        </div>
        <div className={statusClass(module.status)}>
          <strong>{statusLabels[module.status]}</strong>
          <small>{module.coverage}%</small>
        </div>
      </div>

      <div className="sienge-module-metrics">
        <div>
          <strong>{compactNumber(module.totalRecords)}</strong>
          <span>registros salvos</span>
        </div>
        <div>
          <strong>{formatDate(module.lastUpdatedAt)}</strong>
          <span>última integração</span>
        </div>
        <div>
          <strong>{module.endpoints.filter((endpoint) => endpoint.implemented).length}/{module.endpoints.length}</strong>
          <span>fontes implementadas</span>
        </div>
      </div>

      <div className="sienge-module-purpose">
        <div>
          <strong>Melhor uso no Sienge</strong>
          <p>{module.bestUse}</p>
        </div>
        <div>
          <strong>Uso no sistema</strong>
          <p>{module.systemUse}</p>
        </div>
      </div>

      <div className="sienge-endpoints">
        {module.endpoints.map((endpoint) => (
          <div key={`${module.id}-${endpoint.endpoint}-${endpoint.label}`} className={endpoint.records > 0 ? "loaded" : endpoint.implemented ? "empty" : "unused"}>
            <div>
              <strong>{endpoint.label}</strong>
              <span>{endpoint.endpoint}</span>
              <small>{endpoint.role}</small>
            </div>
            <div>
              <b>{endpoint.implemented ? endpoint.records.toLocaleString("pt-BR") : "não usado"}</b>
              <small>{endpoint.implemented ? endpoint.database : "fora do fluxo atual"}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="sienge-module-footer">
        <div>
          <strong>Pontos fortes</strong>
          <span>{module.strengths.join(" • ")}</span>
        </div>
        <div>
          <strong>O que falta</strong>
          <span>{module.gaps.join(" • ")}</span>
        </div>
      </div>

      <div className="sienge-module-action">
        <span>{statusNotes[module.status]}</span>
        {module.route ? <Link className="button secondary" href={module.route}>Abrir tela</Link> : <Link className="button secondary" href="/configuracoes">Configurações</Link>}
      </div>
    </article>
  );
}

export default function SiengeCoveragePage() {
  const dashboard = loadSiengeCoverageDashboard();
  const { summary } = dashboard;
  const priority = dashboard.modules
    .filter((module) => module.status !== "active")
    .slice(0, 4);

  return (
    <>
      <PageHeading
        eyebrow="Mapa Sienge"
        title="Cobertura operacional"
        subtitle="Veja quais áreas do Sienge já alimentam o sistema, onde existem dados salvos e quais capacidades ainda não estão sendo usadas."
        action="Atualizar dados"
        actionHref="/configuracoes"
      />

      <section className="card reports-intro sienge-hero">
        <div>
          <span>Leitura executiva</span>
          <h2>{summary.coverage}% das fontes implementadas têm dados locais</h2>
          <p>
            Esta tela não consulta o Sienge. Ela olha para o repositório local e mostra o que já virou rotina operacional no sistema,
            o que está parcial e o que ainda é oportunidade.
          </p>
        </div>
        <div className="reports-intro-grid">
          <div><strong>{summary.activeModules}</strong><span>módulos em uso</span></div>
          <div><strong>{summary.partialModules + summary.readyModules}</strong><span>módulos a completar</span></div>
          <div><strong>{compactNumber(summary.totalRecords)}</strong><span>registros locais</span></div>
        </div>
      </section>

      <div className="stats sienge-stats">
        <StatCard label="Fontes com dados" value={`${summary.endpointsWithData}/${summary.implementedEndpoints}`} delta={`${summary.totalEndpoints} fontes mapeadas`} icon="S" />
        <StatCard label="Cobertura local" value={`${summary.coverage}%`} delta="Fontes implementadas com dados salvos" icon="%" warn={summary.coverage < 60} />
        <StatCard label="Sem uso atual" value={String(summary.unusedModules)} delta="Capacidades planejadas ou fora do fluxo" icon="!" warn={summary.unusedModules > 0} />
        <StatCard label="Última integração" value={formatDate(summary.lastUpdatedAt)} delta="Considerando todos os módulos" icon="I" />
      </div>

      {priority.length > 0 && (
        <section className="card panel sienge-priority">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Prioridades para aproveitar melhor o Sienge</h2>
              <span className="panel-note">Itens que mais ajudam a transformar dado salvo em gestão operacional.</span>
            </div>
          </div>
          <div className="sienge-priority-list">
            {priority.map((module) => (
              <div key={module.id}>
                <span className={statusClass(module.status)}>{statusLabels[module.status]}</span>
                <strong>{module.title}</strong>
                <p>{module.nextStep}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="sienge-module-grid">
        {dashboard.modules.map((module) => <ModuleCard key={module.id} module={module} />)}
      </section>
    </>
  );
}
