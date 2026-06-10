"use client";

import { useEffect, useMemo, useState } from "react";
import { StatCard } from "@/components/ui/stat-card";
import { ReconciliationExplorer } from "@/components/reconciliation/reconciliation-explorer";
import type { BankMovement, ReconciliationSummary } from "@/features/reconciliation/types";
import { formatCompactCurrency } from "@/lib/formatters";

type SiengeErrorDetails = {
  status?: number;
  statusText?: string;
  method: string;
  endpoint: string;
  rateLimitType?: "BULK" | "REST";
  rateLimitDescription?: string;
  title: string;
  explanation: string;
  suggestion: string;
  apiMessage?: string;
  requestId?: string;
  occurredAt: string;
};

type ReconciliationPayload = {
  movements: BankMovement[];
  totalCount: number;
  summary: ReconciliationSummary;
  loadedAt: string;
  error?: SiengeErrorDetails;
};

type ServerProgress = {
  active: boolean;
  stage: string;
  message: string;
  detail?: string;
  current?: number;
  total?: number;
  updatedAt?: string;
  completedAt?: string;
};

const steps = [
  { label: "Preparar consulta", stages: ["start", "prepare-query"] },
  { label: "Verificar memória e SQLite", stages: ["memory-cache-read", "memory-cache-hit", "sqlite-cache-read", "sqlite-cache-hit"] },
  { label: "Consultar Sienge se necessário", stages: ["sienge-request", "sienge-json-read", "sienge-error-body"] },
  { label: "Gravar dados no SQLite", stages: ["sqlite-cache-write", "sqlite-records-write", "sqlite-bulk-write"] },
  { label: "Montar indicadores e filtros", stages: ["analyze", "summary"] }
];

function stepIndex(stage?: string) {
  const index = steps.findIndex((step) => step.stages.includes(stage || ""));
  return index >= 0 ? index : 0;
}

function stepStatus(index: number, progress?: ServerProgress, hasPayload = false) {
  if (hasPayload || progress?.stage === "done") return "done";
  const current = stepIndex(progress?.stage);
  if (index < current) return "done";
  if (index === current && progress?.active) return "active";
  return "pending";
}

function statusLabel(status: string) {
  if (status === "done") return "Feita";
  if (status === "active") return "Em andamento";
  return "Pendente";
}

function LoadingPanel({ progress, elapsed, hasPayload }: { progress?: ServerProgress; elapsed: number; hasPayload?: boolean }) {
  return (
    <section className="card reconciliation-loading" aria-live="polite">
      <div>
        <strong>Carregando conciliação</strong>
        <span>{progress?.message || "Aguardando início da carga no servidor."}</span>
        {progress?.detail && <small>{progress.detail}</small>}
      </div>
      <div className="reconciliation-step-list">
        {steps.map((step, index) => {
          const status = stepStatus(index, progress, hasPayload);
          return (
            <div className={`reconciliation-step ${status}`} key={step.label}>
              <i>{status === "done" ? "OK" : status === "active" ? "..." : "-"}</i>
              <span>{step.label}</span>
              <strong>{statusLabel(status)}</strong>
            </div>
          );
        })}
      </div>
      <div className="reconciliation-loading-meta">
        <span>{elapsed}s em andamento</span>
        {progress?.current && progress.total && <span>{progress.current} de {progress.total} registros</span>}
        {progress?.updatedAt && <span>Atualizado às {new Date(progress.updatedAt).toLocaleTimeString("pt-BR")}</span>}
      </div>
      <p>Esta lista mostra a etapa real informada pelo servidor. Se parar em uma etapa, é exatamente ali que a carga está aguardando ou gravando dados.</p>
    </section>
  );
}

function ErrorPanel({ error }: { error: SiengeErrorDetails }) {
  return (
    <section className="card api-error" aria-live="polite">
      <div className="api-error-heading">
        <span className="api-error-code">{error.status || "ERRO"}</span>
        <div>
          <h2>{error.title}</h2>
          <p>{error.explanation}</p>
        </div>
      </div>
      <div className="api-error-action">
        <strong>Como resolver</strong>
        <span>{error.suggestion}</span>
      </div>
      <details>
        <summary>Ver detalhes técnicos</summary>
        <dl className="api-error-details">
          <div><dt>Requisição</dt><dd>{error.method} {error.endpoint}</dd></div>
          <div><dt>Status</dt><dd>{error.status ? `${error.status} ${error.statusText || ""}` : "Sem resposta HTTP"}</dd></div>
          {error.rateLimitType && <div><dt>Limite</dt><dd>{error.rateLimitType} {error.rateLimitDescription || ""}</dd></div>}
          {error.apiMessage && <div><dt>Resposta da API</dt><dd>{error.apiMessage}</dd></div>}
          {error.requestId && <div><dt>ID da requisição</dt><dd>{error.requestId}</dd></div>}
        </dl>
      </details>
    </section>
  );
}

export function ReconciliationPortal() {
  const [payload, setPayload] = useState<ReconciliationPayload>();
  const [error, setError] = useState<SiengeErrorDetails>();
  const [progress, setProgress] = useState<ServerProgress>();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let active = true;
    const id = crypto.randomUUID();
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (!active) return;
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      fetch(`/api/sienge/reconciliation/status?id=${encodeURIComponent(id)}`, { cache: "no-store" })
        .then((response) => response.json())
        .then((body: ServerProgress) => {
          if (active) setProgress(body);
        })
        .catch(() => undefined);
    }, 1000);

    fetch(`/api/sienge/reconciliation?id=${encodeURIComponent(id)}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw body;
        return body as ReconciliationPayload;
      })
      .then((body) => {
        if (!active) return;
        setProgress({ active: false, stage: "done", message: "Dados prontos.", completedAt: new Date().toISOString() });
        if (body.error) setError(body.error);
        setPayload(body);
      })
      .catch((caught) => {
        if (!active) return;
        setProgress({ active: false, stage: "done", message: "Não foi possível carregar a conciliação.", completedAt: new Date().toISOString() });
        setError(caught);
      })
      .finally(() => window.clearInterval(timer));

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const summary = payload?.summary;
  const loadedMessage = useMemo(() => {
    if (!payload) return "";
    return `${payload.totalCount} movimentos carregados em ${new Date(payload.loadedAt).toLocaleString("pt-BR")}.`;
  }, [payload]);

  if (error && !payload?.movements.length) {
    return (
      <>
        <LoadingPanel progress={progress} elapsed={elapsed} hasPayload={Boolean(payload)} />
        <ErrorPanel error={error} />
      </>
    );
  }

  if (!payload || !summary) {
    return <LoadingPanel progress={progress} elapsed={elapsed} />;
  }

  return (
    <>
      <LoadingPanel progress={progress} elapsed={elapsed} hasPayload />
      <div className="card data-notice"><strong>Dados carregados</strong><span>{loadedMessage} A próxima abertura usa o SQLite/cache diário quando possível.</span></div>
      <div className="stats">
        <StatCard label="Movimentos conciliados" value={String(summary.reconciledCount)} delta={formatCompactCurrency(summary.reconciledAmount)} icon="C" />
        <StatCard label="A conciliar" value={String(summary.unreconciledCount)} delta={formatCompactCurrency(summary.unreconciledAmount)} warn icon="!" />
        <StatCard label="Movimentos vinculados" value={String(summary.linkedCount)} delta="Possuem título, parcela, credor ou cliente" icon="V" />
        <StatCard label="Avulsos" value={String(summary.detachedCount)} delta="Sem vínculo aparente na resposta bulk" warn icon="A" />
      </div>
      {error && <ErrorPanel error={error} />}
      <div className="grid-main equal-grid">
        <section className="card panel">
          <div className="panel-head"><div><h2 className="panel-title">Contas com maior movimento</h2><span className="panel-note">Volume absoluto por conta bancária</span></div></div>
          <div className="ranking-list">
            {summary.byAccount.map((item) => {
              const max = Math.max(...summary.byAccount.map((account) => Math.abs(account.value)), 1);
              return <div className="ranking-row" key={item.label}><div><span>{item.label}</span><strong>{item.count} movimento(s)</strong></div><div className="ranking-track"><i style={{ width: `${Math.max(4, (Math.abs(item.value) / max) * 100)}%` }} /></div><small>{formatCompactCurrency(item.value)}</small></div>;
            })}
            {!summary.byAccount.length && <div className="empty-state">Nenhuma conta carregada.</div>}
          </div>
        </section>
        <section className="card panel reconciliation-method">
          <div className="panel-head"><div><h2 className="panel-title">O que esta tela faz</h2><span className="panel-note">Conferência antes da efetivação no Sienge</span></div></div>
          <p>O portal lê movimentos de Caixa e Bancos, identifica o status de conciliação informado pelo Sienge e separa movimentos avulsos ou vinculados a títulos.</p>
          <p>A especificação pública permite consultar e auditar esses dados. Não há endpoint público para efetivar a conciliação automaticamente, então esta tela funciona como painel de análise e priorização.</p>
        </section>
      </div>
      <ReconciliationExplorer movements={payload.movements} />
    </>
  );
}
