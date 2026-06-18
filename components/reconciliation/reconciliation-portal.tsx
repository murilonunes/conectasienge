"use client";

import { useEffect, useMemo, useState } from "react";
import { ReconciliationExplorer } from "@/components/reconciliation/reconciliation-explorer";
import { StatCard } from "@/components/ui/stat-card";
import type { BankMovement, ReconciliationMonthlySummary, ReconciliationSummary } from "@/features/reconciliation/types";
import { isLinked, isReconciled, movementAmount } from "@/features/reconciliation/utils";
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

const reconciliationSteps = [
  { label: "Preparar leitura", stages: ["start", "prepare-query"] },
  { label: "Ler dados salvos", stages: ["local-mirror-read", "local-mirror-hit", "sqlite-cache-latest-read", "sqlite-cache-latest-hit"] },
  { label: "Consultar Sienge quando solicitado", stages: ["sienge-request", "sienge-json-read", "sienge-error-body"] },
  { label: "Salvar dados atualizados", stages: ["local-mirror-write", "sqlite-records-write", "sqlite-bulk-write"] },
  { label: "Montar indicadores e filtros", stages: ["analyze", "summary"] }
];

const emptyMonthSummary: ReconciliationMonthlySummary = {
  key: "empty",
  label: "Sem movimentos",
  totalAmount: 0,
  totalCount: 0,
  reconciledAmount: 0,
  reconciledCount: 0,
  unreconciledAmount: 0,
  unreconciledCount: 0,
  linkedCount: 0,
  detachedCount: 0
};

function stepIndex(stage?: string) {
  const index = reconciliationSteps.findIndex((step) => step.stages.includes(stage || ""));
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

function movementMonthKey(movement: BankMovement) {
  const date = movement.bankMovementDate || movement.billDate;
  return date ? date.slice(0, 7) : "sem-data";
}

function movementMonthLabel(key: string) {
  if (key === "sem-data") return "Sem data";
  const date = new Date(`${key}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return key;
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(date);
}

function monthSortValue(key: string) {
  if (key === "sem-data") return 0;
  const [year, month] = key.split("-").map(Number);
  return (year || 0) * 12 + (month || 0);
}

function monthPercent(month?: ReconciliationMonthlySummary) {
  if (!month?.totalCount) return 0;
  return Math.round((month.reconciledCount / month.totalCount) * 100);
}

function aggregateMonths(months: ReconciliationMonthlySummary[]): ReconciliationMonthlySummary {
  return months.reduce<ReconciliationMonthlySummary>((total, month) => ({
    key: "all",
    label: "Todos os meses",
    totalAmount: total.totalAmount + month.totalAmount,
    totalCount: total.totalCount + month.totalCount,
    reconciledAmount: total.reconciledAmount + month.reconciledAmount,
    reconciledCount: total.reconciledCount + month.reconciledCount,
    unreconciledAmount: total.unreconciledAmount + month.unreconciledAmount,
    unreconciledCount: total.unreconciledCount + month.unreconciledCount,
    linkedCount: total.linkedCount + month.linkedCount,
    detachedCount: total.detachedCount + month.detachedCount
  }), {
    key: "all",
    label: "Todos os meses",
    totalAmount: 0,
    totalCount: 0,
    reconciledAmount: 0,
    reconciledCount: 0,
    unreconciledAmount: 0,
    unreconciledCount: 0,
    linkedCount: 0,
    detachedCount: 0
  });
}

function emptyMonth(key: string): ReconciliationMonthlySummary {
  return {
    key,
    label: movementMonthLabel(key),
    totalAmount: 0,
    totalCount: 0,
    reconciledAmount: 0,
    reconciledCount: 0,
    unreconciledAmount: 0,
    unreconciledCount: 0,
    linkedCount: 0,
    detachedCount: 0
  };
}

function buildMonthlySummary(movements: BankMovement[]) {
  const months = new Map<string, ReconciliationMonthlySummary>();
  movements.forEach((movement) => {
    const key = movementMonthKey(movement);
    const month = months.get(key) || emptyMonth(key);
    const amount = Math.abs(movementAmount(movement));
    month.totalAmount += amount;
    month.totalCount += 1;
    if (isReconciled(movement)) {
      month.reconciledAmount += amount;
      month.reconciledCount += 1;
    } else {
      month.unreconciledAmount += amount;
      month.unreconciledCount += 1;
    }
    if (isLinked(movement)) month.linkedCount += 1;
    else month.detachedCount += 1;
    months.set(key, month);
  });
  return Array.from(months.values()).sort((left, right) => monthSortValue(right.key) - monthSortValue(left.key));
}

function buildAccountRanking(movements: BankMovement[]) {
  const accounts = new Map<string, { label: string; value: number; count: number }>();
  movements.forEach((movement) => {
    const label = movement.accountNumber || "Conta não informada";
    const current = accounts.get(label) || { label, value: 0, count: 0 };
    current.value += movementAmount(movement);
    current.count += 1;
    accounts.set(label, current);
  });
  return Array.from(accounts.values()).sort((left, right) => Math.abs(right.value) - Math.abs(left.value)).slice(0, 8);
}

function LoadingPanel({ progress, elapsed, hasPayload }: { progress?: ServerProgress; elapsed: number; hasPayload?: boolean }) {
  if (hasPayload) {
    return (
      <section className="card reconciliation-loaded-note" aria-live="polite">
        <strong>Leitura concluída</strong>
        <span>{progress?.completedAt ? `Concluída às ${new Date(progress.completedAt).toLocaleTimeString("pt-BR")}` : "Dados carregados"}</span>
      </section>
    );
  }

  return (
    <section className="card reconciliation-loading" aria-live="polite">
      <div>
        <strong>Carregando conciliação</strong>
        <span>{progress?.message || "Aguardando leitura dos dados salvos."}</span>
        {progress?.detail && <small>{progress.detail}</small>}
      </div>
      <div className="reconciliation-step-list">
        {reconciliationSteps.map((step, index) => {
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
        <span>{`${elapsed}s em andamento`}</span>
        {progress?.current !== undefined && progress.total !== undefined && <span>{progress.current} de {progress.total} registros</span>}
        {progress?.updatedAt && <span>Atualizado às {new Date(progress.updatedAt).toLocaleTimeString("pt-BR")}</span>}
      </div>
      <p>A abertura normal usa os dados já salvos. Novas buscas no Sienge são feitas pela tela de Configurações.</p>
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
        <summary>Ver detalhes do erro</summary>
        <dl className="api-error-details">
          <div><dt>Consulta técnica</dt><dd>{error.method} {error.endpoint}</dd></div>
          <div><dt>Status</dt><dd>{error.status ? `${error.status} ${error.statusText || ""}` : "Sem resposta HTTP"}</dd></div>
          {error.rateLimitType && <div><dt>Limite</dt><dd>{error.rateLimitType} {error.rateLimitDescription || ""}</dd></div>}
          {error.apiMessage && <div><dt>Resposta do Sienge</dt><dd>{error.apiMessage}</dd></div>}
          {error.requestId && <div><dt>ID da consulta</dt><dd>{error.requestId}</dd></div>}
        </dl>
      </details>
    </section>
  );
}

function MonthlyReconciliationPanel({
  months,
  selectedMonth,
  accountLabel,
  onSelect
}: {
  months: ReconciliationMonthlySummary[];
  selectedMonth: string;
  accountLabel: string;
  onSelect: (month: string) => void;
}) {
  return (
    <section className="card panel reconciliation-monthly-panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Visão mensal da conciliação</h2>
          <span className="panel-note">Conta analisada: {accountLabel}. Clique em um mês para ver cards e registros daquele período</span>
        </div>
        {months.length > 0 && (
          <select value={selectedMonth} onChange={(event) => onSelect(event.target.value)}>
            <option value="all">Todos os meses</option>
            {months.map((month) => <option value={month.key} key={month.key}>{month.label}</option>)}
          </select>
        )}
      </div>

      {months.length ? <div className="reconciliation-month-grid">
        {months.slice(0, 18).map((month) => {
          const percent = monthPercent(month);
          const doneWidth = month.totalAmount ? (month.reconciledAmount / month.totalAmount) * 100 : 0;
          const pendingWidth = month.totalAmount ? (month.unreconciledAmount / month.totalAmount) * 100 : 0;
          return (
            <button
              type="button"
              className={selectedMonth === month.key ? "active" : ""}
              key={month.key}
              onClick={() => onSelect(month.key)}
            >
              <div><strong>{month.label}</strong><span>{percent}% conciliado</span></div>
              <div className="reconciliation-month-track">
                <i className="done" style={{ width: `${doneWidth}%` }} />
                <i className="pending" style={{ width: `${pendingWidth}%` }} />
              </div>
              <small>{month.reconciledCount} conciliados - {month.unreconciledCount} a conciliar</small>
            </button>
          );
        })}
      </div> : <div className="empty-state">Nenhum movimento mensal encontrado nos dados salvos.</div>}
    </section>
  );
}

function configuredAccounts(value: string) {
  return value
    .split(",")
    .map((account) => account.trim())
    .filter(Boolean);
}

function configuredAccountsLabel(accounts: string[]) {
  if (!accounts.length) return "Todas as contas";
  if (accounts.length === 1) return accounts[0];
  return `${accounts.length} contas selecionadas`;
}

export function ReconciliationPortal({ configuredAccountNumbers = "" }: { configuredAccountNumbers?: string }) {
  const [payload, setPayload] = useState<ReconciliationPayload>();
  const [error, setError] = useState<SiengeErrorDetails>();
  const [progress, setProgress] = useState<ServerProgress>();
  const [elapsed, setElapsed] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState("");

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
  const selectedAccounts = useMemo(() => configuredAccounts(configuredAccountNumbers), [configuredAccountNumbers]);
  const accountMovements = useMemo(() => {
    if (!payload) return [];
    if (!selectedAccounts.length) return payload.movements;
    const accountSet = new Set(selectedAccounts);
    return payload.movements.filter((movement) => movement.accountNumber && accountSet.has(movement.accountNumber));
  }, [payload, selectedAccounts]);
  const accountLabel = configuredAccountsLabel(selectedAccounts);
  const months = useMemo(() => buildMonthlySummary(accountMovements), [accountMovements]);
  const accountRanking = useMemo(() => buildAccountRanking(accountMovements), [accountMovements]);

  useEffect(() => {
    if (!months.length) return;
    setSelectedMonth((current) => current && (current === "all" || months.some((month) => month.key === current)) ? current : months[0].key);
  }, [months]);

  const selectedMonthSummary = useMemo(() => {
    if (!months.length) return emptyMonthSummary;
    if (selectedMonth === "all") return aggregateMonths(months);
    return months.find((month) => month.key === selectedMonth) || months[0];
  }, [months, selectedMonth]);

  const visibleMovements = useMemo(() => {
    if (!selectedMonth || selectedMonth === "all") return accountMovements;
    return accountMovements.filter((movement) => movementMonthKey(movement) === selectedMonth);
  }, [accountMovements, selectedMonth]);

  const loadedMessage = useMemo(() => {
    if (!payload) return "";
    return `${payload.totalCount} movimentos lidos em ${new Date(payload.loadedAt).toLocaleString("pt-BR")}.`;
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

  const selectedLabel = selectedMonthSummary.label;
  const monthDonePercent = monthPercent(selectedMonthSummary);
  const linkedInView = visibleMovements.filter(isLinked).length;
  const reconciledInView = visibleMovements.filter(isReconciled).length;

  return (
    <>
      <LoadingPanel progress={progress} elapsed={elapsed} hasPayload />
      <div className="card data-notice">
        <strong>Dados carregados</strong>
        <span>{loadedMessage} Conta em análise: {accountLabel}. Para trocar, ajuste em Configurações.</span>
      </div>

      <MonthlyReconciliationPanel months={months} selectedMonth={selectedMonth || selectedMonthSummary.key} accountLabel={accountLabel} onSelect={setSelectedMonth} />

      <div className="reconciliation-period-head">
        <div>
          <span>Período selecionado</span>
          <strong>{selectedLabel}</strong>
        </div>
        <div>
          <span>Progresso</span>
          <strong>{monthDonePercent}% conciliado</strong>
        </div>
      </div>

      <div className="stats">
        <StatCard label="Conciliados" value={String(selectedMonthSummary.reconciledCount)} delta={formatCompactCurrency(selectedMonthSummary.reconciledAmount)} icon="C" />
        <StatCard label="A conciliar" value={String(selectedMonthSummary.unreconciledCount)} delta={formatCompactCurrency(selectedMonthSummary.unreconciledAmount)} warn={selectedMonthSummary.unreconciledCount > 0} icon="!" />
        <StatCard label="Vinculados" value={String(selectedMonthSummary.linkedCount)} delta="Ligados a título, parcela, credor ou cliente" icon="V" />
        <StatCard label="Avulsos" value={String(selectedMonthSummary.detachedCount)} delta="Sem vínculo aparente para conferência" warn={selectedMonthSummary.detachedCount > 0} icon="A" />
      </div>

      {error && <ErrorPanel error={error} />}

      <div className="grid-main equal-grid">
        <section className="card panel">
          <div className="panel-head"><div><h2 className="panel-title">Contas com maior movimento</h2><span className="panel-note">Volume dentro da seleção atual</span></div></div>
          <div className="ranking-list">
            {accountRanking.map((item) => {
              const max = Math.max(...accountRanking.map((account) => Math.abs(account.value)), 1);
              return <div className="ranking-row" key={item.label}><div><span>{item.label}</span><strong>{item.count} movimentos</strong></div><div className="ranking-track"><i style={{ width: `${Math.max(4, (Math.abs(item.value) / max) * 100)}%` }} /></div><small>{formatCompactCurrency(item.value)}</small></div>;
            })}
            {!accountRanking.length && <div className="empty-state">Nenhuma conta encontrada para a seleção atual.</div>}
          </div>
        </section>
        <section className="card panel reconciliation-method">
          <div className="panel-head"><div><h2 className="panel-title">Como usar</h2><span className="panel-note">Leitura operacional</span></div></div>
          <p>Use o mês selecionado para acompanhar o que já foi conciliado e o que ainda precisa de conferência. A lista abaixo fica filtrada pelo mesmo período.</p>
          <p>A conciliação efetiva continua sendo feita no Sienge. Esta tela ajuda a acompanhar o que já está conferido e o que ainda precisa de atenção.</p>
          <div className="reconciliation-mini-stats">
            <span>{visibleMovements.length} movimentos no recorte</span>
            <span>{reconciledInView} conciliados</span>
            <span>{linkedInView} vinculados</span>
          </div>
        </section>
      </div>

      <ReconciliationExplorer movements={visibleMovements} periodLabel={selectedLabel} />
    </>
  );
}
