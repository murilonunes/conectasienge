"use client";

import { I18nText } from "@/components/i18n/i18n-text";
import { useEffect, useMemo, useState } from "react";
import { ReconciliationExplorer } from "@/components/reconciliation/reconciliation-explorer";
import { LocalDataList } from "@/components/ui/local-data-list";
import { StatCard } from "@/components/ui/stat-card";
import type { BankMovement, ReconciliationMonthlySummary, ReconciliationSummary } from "@/features/reconciliation/types";
import { hasTitleLink, isLinked, isReconciled, movementAmount, movementDocument, movementParty } from "@/features/reconciliation/utils";
import { formatCompactCurrency, formatCurrency, formatDate } from "@/lib/formatters";

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

export type ReconciliationPayload = {
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

function monthYearKey(key: string) {
  const year = Number(key.slice(0, 4));
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? String(year) : "sem-data";
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

function buildYearOptions(months: ReconciliationMonthlySummary[]) {
  return Array.from(new Set(months.map((month) => monthYearKey(month.key))))
    .sort((left, right) => {
      if (left === "sem-data") return 1;
      if (right === "sem-data") return -1;
      return Number(right) - Number(left);
    });
}

function yearLabel(year: string) {
  return year === "sem-data" ? "Sem data" : year;
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

function LoadingPanel({ progress, elapsed, hasPayload, refreshing }: { progress?: ServerProgress; elapsed: number; hasPayload?: boolean; refreshing?: boolean }) {
  if (hasPayload) {
    return (
      <section className="card reconciliation-loaded-note" aria-live="polite">
        <strong><I18nText text={refreshing ? "Recarregando leitura" : "Leitura local pronta"} /></strong>
        <span>{progress?.completedAt ? `Concluída às ${new Date(progress.completedAt).toLocaleTimeString("pt-BR")}` : <I18nText text={"Dados carregados do SQLite local"} />}</span>
      </section>
    );
  }

  return (
    <section className="card reconciliation-loading" aria-live="polite">
      <div>
        <strong><I18nText text={"Carregando conciliação"} /></strong>
        <span>{progress?.message || <I18nText text={"Aguardando leitura dos dados salvos."} />}</span>
        {progress?.detail && <small>{progress.detail}</small>}
      </div>
      <div className="reconciliation-step-list">
        {reconciliationSteps.map((step, index) => {
          const status = stepStatus(index, progress, hasPayload);
          return (
            <div className={`reconciliation-step ${status}`} key={step.label}>
              <i>{status === "done" ? <I18nText text={"OK"} /> : status === "active" ? <I18nText text={"..."} /> : <I18nText text={"-"} />}</i>
              <span>{step.label}</span>
              <strong>{statusLabel(status)}</strong>
            </div>
          );
        })}
      </div>
      <div className="reconciliation-loading-meta">
        <span>{`${elapsed}s em andamento`}</span>
        {progress?.current !== undefined && progress.total !== undefined && <span>{progress.current} <I18nText text={"de"} /> {progress.total} <I18nText text={"registros"} /></span>}
        {progress?.updatedAt && <span><I18nText text={"Atualizado às"} /> {new Date(progress.updatedAt).toLocaleTimeString("pt-BR")}</span>}
      </div>
      <p><I18nText text={"A abertura normal usa os dados já salvos. Novas buscas no Sienge são feitas pela tela de Configurações."} /></p>
    </section>
  );
}

function ErrorPanel({ error }: { error: SiengeErrorDetails }) {
  return (
    <section className="card api-error" aria-live="polite">
      <div className="api-error-heading">
        <span className="api-error-code">{error.status || <I18nText text={"ERRO"} />}</span>
        <div>
          <h2>{error.title}</h2>
          <p>{error.explanation}</p>
        </div>
      </div>
      <div className="api-error-action">
        <strong><I18nText text={"Como resolver"} /></strong>
        <span>{error.suggestion}</span>
      </div>
      <details>
        <summary><I18nText text={"Ver detalhes do erro"} /></summary>
        <dl className="api-error-details">
          <div><dt><I18nText text={"Origem da informação"} /></dt><dd>{error.method} {error.endpoint}</dd></div>
          <div><dt><I18nText text={"Status"} /></dt><dd>{error.status ? `${error.status} ${error.statusText || ""}` : <I18nText text={"Sem resposta HTTP"} />}</dd></div>
          {error.rateLimitType && <div><dt><I18nText text={"Limite"} /></dt><dd>{error.rateLimitType} {error.rateLimitDescription || <I18nText text={""} />}</dd></div>}
          {error.apiMessage && <div><dt><I18nText text={"Resposta do Sienge"} /></dt><dd>{error.apiMessage}</dd></div>}
          {error.requestId && <div><dt><I18nText text={"ID da consulta"} /></dt><dd>{error.requestId}</dd></div>}
        </dl>
      </details>
    </section>
  );
}

function MonthlyReconciliationPanel({
  months,
  years,
  selectedYear,
  selectedMonth,
  accountLabel,
  onSelectYear,
  onSelect
}: {
  months: ReconciliationMonthlySummary[];
  years: string[];
  selectedYear: string;
  selectedMonth: string;
  accountLabel: string;
  onSelectYear: (year: string) => void;
  onSelect: (month: string) => void;
}) {
  return (
    <section className="card panel reconciliation-monthly-panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title"><I18nText text={"Visão mensal da conciliação"} /></h2>
          <span className="panel-note"><I18nText text={"Conta analisada:"} /> {accountLabel}<I18nText text={". Clique em um mês para ver cards e registros daquele período"} /></span>
        </div>
        {(years.length > 0 || months.length > 0) && (
          <div className="reconciliation-month-selectors">
            {years.length > 0 && (
              <label>
                <span><I18nText text={"Ano"} /></span>
                <select value={selectedYear} onChange={(event) => onSelectYear(event.target.value)}>
                  {years.map((year) => <option value={year} key={year}>{yearLabel(year)}</option>)}
                </select>
              </label>
            )}
            {months.length > 0 && (
              <label>
                <span><I18nText text={"Mês"} /></span>
                <select value={selectedMonth} onChange={(event) => onSelect(event.target.value)}>
                  <option value="all"><I18nText text={"Todos os meses do ano"} /></option>
                  {months.map((month) => <option value={month.key} key={month.key}>{month.label}</option>)}
                </select>
              </label>
            )}
          </div>
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
              <div><strong>{month.label}</strong><span>{percent}<I18nText text={"% conciliado"} /></span></div>
              <div className="reconciliation-month-track">
                <i className="done" style={{ width: `${doneWidth}%` }} />
                <i className="pending" style={{ width: `${pendingWidth}%` }} />
              </div>
              <small>{month.reconciledCount} <I18nText text={"conciliados -"} /> {month.unreconciledCount} <I18nText text={"a conciliar"} /></small>
            </button>
          );
        })}
      </div> : <div className="empty-state"><I18nText text={"Nenhum movimento mensal encontrado nos dados salvos."} /></div>}
    </section>
  );
}

function UntitledMovementsPanel({ movements, periodLabel }: { movements: BankMovement[]; periodLabel: string }) {
  const amount = movements.reduce((sum, movement) => sum + Math.abs(movementAmount(movement)), 0);

  return (
    <section className="card panel reconciliation-untitled-panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title"><I18nText text={"Movimentos sem título/parcela"} /></h2>
          <span className="panel-note"><I18nText text={"Movimentos do recorte"} /> {periodLabel} <I18nText text={"sem billId nem installmentId; podem ter cliente, fornecedor ou empresa informados"} /></span>
        </div>
        <div className="reconciliation-untitled-summary">
          <strong>{movements.length}</strong>
          <span>{formatCompactCurrency(amount)}</span>
        </div>
      </div>
      <LocalDataList
        items={movements}
        itemLabel="sem título"
        defaultPageSize={25}
        pageSizeOptions={[25, 50, 100, 200]}
        resetKey={periodLabel}
        emptyMessage="Nenhum movimento sem título/parcela no recorte atual."
        csvExport={{
          fileName: "movimentos-sem-titulo.csv",
          buttonLabel: "Exportar sem título",
          columns: [
            { header: "Movimento", value: (item) => (item as BankMovement).bankMovementId },
            { header: "Data", value: (item) => (item as BankMovement).bankMovementDate },
            { header: "Valor", value: (item) => movementAmount(item as BankMovement) },
            { header: "Conta", value: (item) => (item as BankMovement).accountNumber },
            { header: "Parte", value: (item) => movementParty(item as BankMovement) },
            { header: "Historico", value: (item) => (item as BankMovement).bankMovementHistoricName || (item as BankMovement).bankMovementOperationName }
          ]
        }}
        renderItems={(pageItems) => (
          <div className="table-card reconciliation-untitled-table">
            <table>
              <thead><tr><th><I18nText text={"Movimento"} /></th><th><I18nText text={"Data"} /></th><th><I18nText text={"Valor"} /></th><th><I18nText text={"Conta"} /></th><th><I18nText text={"Parte"} /></th><th><I18nText text={"Histórico"} /></th></tr></thead>
              <tbody>
                {pageItems.map((movement, index) => (
                  <tr key={`${movement.bankMovementId || index}-sem-titulo`}>
                    <td><strong>{movementDocument(movement)}</strong><br /><span className="table-muted"><I18nText text={"Movimento #"} />{movement.bankMovementId || <I18nText text={"sem código"} />}</span></td>
                    <td>{movement.bankMovementDate ? formatDate(movement.bankMovementDate) : <I18nText text={"Não informada"} />}</td>
                    <td><strong>{formatCurrency(movementAmount(movement))}</strong><br /><span className="table-muted">{movement.bankMovementOperationType || <I18nText text={"Tipo não informado"} />}</span></td>
                    <td>{movement.accountNumber || <I18nText text={"Não informada"} />}<br /><span className="table-muted">{movement.companyName || <I18nText text={""} />}</span></td>
                    <td>{movementParty(movement)}</td>
                    <td>{movement.bankMovementHistoricName || movement.bankMovementOperationName || <I18nText text={"Não informado"} />}<br /><span className="table-muted">{movement.bankMovementOriginId || <I18nText text={""} />}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      />
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

export function ReconciliationPortal({
  configuredAccountNumbers = "",
  initialPayload
}: {
  configuredAccountNumbers?: string;
  initialPayload: ReconciliationPayload;
}) {
  const [payload, setPayload] = useState<ReconciliationPayload>(initialPayload);
  const [error, setError] = useState<SiengeErrorDetails | undefined>(initialPayload.error);
  const [progress, setProgress] = useState<ServerProgress>();
  const [elapsed, setElapsed] = useState(0);
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  function reloadLocalRead() {
    if (refreshing) return;
    let active = true;
    const id = crypto.randomUUID();
    const startedAt = Date.now();
    setRefreshing(true);
    setElapsed(0);
    setError(undefined);
    setProgress({ active: true, stage: "start", message: "Recarregando dados salvos.", updatedAt: new Date().toISOString() });
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
      .finally(() => {
        window.clearInterval(timer);
        if (active) setRefreshing(false);
      });

    return () => {
      active = false;
      window.clearInterval(timer);
      setRefreshing(false);
    };
  }

  const summary = payload?.summary;
  const selectedAccounts = useMemo(() => configuredAccounts(configuredAccountNumbers), [configuredAccountNumbers]);
  const accountMovements = useMemo(() => {
    if (!payload) return [];
    if (!selectedAccounts.length) return payload.movements;
    const accountSet = new Set(selectedAccounts);
    return payload.movements.filter((movement) => movement.accountNumber && accountSet.has(movement.accountNumber));
  }, [payload, selectedAccounts]);
  const accountLabel = configuredAccountsLabel(selectedAccounts);
  const allMonths = useMemo(() => buildMonthlySummary(accountMovements), [accountMovements]);
  const years = useMemo(() => buildYearOptions(allMonths), [allMonths]);
  const activeYear = selectedYear || years[0] || "";
  const months = useMemo(() => {
    if (!activeYear) return [];
    return allMonths.filter((month) => monthYearKey(month.key) === activeYear);
  }, [activeYear, allMonths]);
  const accountRanking = useMemo(() => buildAccountRanking(accountMovements), [accountMovements]);

  useEffect(() => {
    if (!years.length) {
      setSelectedYear("");
      return;
    }
    setSelectedYear((current) => current && years.includes(current) ? current : years[0]);
  }, [years]);

  useEffect(() => {
    if (!activeYear || !months.length) {
      setSelectedMonth("");
      return;
    }
    setSelectedMonth((current) => current && (current === "all" || months.some((month) => month.key === current)) ? current : months[0].key);
  }, [activeYear, months]);

  const selectedMonthSummary = useMemo(() => {
    if (!months.length) return emptyMonthSummary;
    if (selectedMonth === "all") return aggregateMonths(months);
    return months.find((month) => month.key === selectedMonth) || months[0];
  }, [months, selectedMonth]);

  const visibleMovements = useMemo(() => {
    if (!activeYear) return accountMovements;
    const yearMovements = accountMovements.filter((movement) => monthYearKey(movementMonthKey(movement)) === activeYear);
    if (!selectedMonth || selectedMonth === "all") return yearMovements;
    return yearMovements.filter((movement) => movementMonthKey(movement) === selectedMonth);
  }, [accountMovements, activeYear, selectedMonth]);
  const untitledMovements = useMemo(() => visibleMovements.filter((movement) => !hasTitleLink(movement)), [visibleMovements]);

  const loadedMessage = useMemo(() => {
    if (!payload) return "";
    return `${payload.totalCount} movimentos lidos em ${new Date(payload.loadedAt).toLocaleString("pt-BR")}.`;
  }, [payload]);

  if (error && !payload?.movements.length) {
    return (
      <>
        <LoadingPanel progress={progress} elapsed={elapsed} hasPayload={Boolean(payload)} refreshing={refreshing} />
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
  const untitledAmount = untitledMovements.reduce((sum, movement) => sum + Math.abs(movementAmount(movement)), 0);

  return (
    <>
      {refreshing ? (
        <LoadingPanel progress={progress} elapsed={elapsed} />
      ) : (
        <LoadingPanel progress={progress} elapsed={elapsed} hasPayload />
      )}
      <div className="card data-notice">
        <strong><I18nText text={"Dados carregados"} /></strong>
        <span>{loadedMessage} <I18nText text={"Conta em análise:"} /> {accountLabel}<I18nText text={". Para trocar, ajuste em Configurações."} /></span>
      </div>

      <MonthlyReconciliationPanel
        months={months}
        years={years}
        selectedYear={activeYear}
        selectedMonth={selectedMonth || selectedMonthSummary.key}
        accountLabel={accountLabel}
        onSelectYear={setSelectedYear}
        onSelect={setSelectedMonth}
      />

      <div className="reconciliation-period-head">
        <div>
          <span><I18nText text={"Período selecionado"} /></span>
          <strong>{selectedLabel}</strong>
        </div>
        <div>
          <span><I18nText text={"Progresso"} /></span>
          <strong>{monthDonePercent}<I18nText text={"% conciliado"} /></strong>
        </div>
        <button className="button secondary" type="button" onClick={reloadLocalRead} disabled={refreshing}>
          <I18nText text={refreshing ? "Recarregando..." : "Recarregar dados salvos"} />
        </button>
      </div>

      <div className="stats reconciliation-stats">
        <StatCard label="Conciliados" value={String(selectedMonthSummary.reconciledCount)} delta={formatCompactCurrency(selectedMonthSummary.reconciledAmount)} icon="C" />
        <StatCard label="A conciliar" value={String(selectedMonthSummary.unreconciledCount)} delta={formatCompactCurrency(selectedMonthSummary.unreconciledAmount)} warn={selectedMonthSummary.unreconciledCount > 0} icon="!" />
        <StatCard label="Vinculados" value={String(selectedMonthSummary.linkedCount)} delta="Ligados a título, parcela, credor ou cliente" icon="V" />
        <StatCard label="Avulsos" value={String(selectedMonthSummary.detachedCount)} delta="Sem vínculo aparente para conferência" warn={selectedMonthSummary.detachedCount > 0} icon="A" />
        <StatCard label="Sem título" value={String(untitledMovements.length)} delta={formatCompactCurrency(untitledAmount)} warn={untitledMovements.length > 0} icon="ST" />
      </div>

      {error && <ErrorPanel error={error} />}

      <div className="grid-main equal-grid">
        <section className="card panel">
          <div className="panel-head"><div><h2 className="panel-title"><I18nText text={"Contas com maior movimento"} /></h2><span className="panel-note"><I18nText text={"Volume dentro da seleção atual"} /></span></div></div>
          <div className="ranking-list">
            {accountRanking.map((item) => {
              const max = Math.max(...accountRanking.map((account) => Math.abs(account.value)), 1);
              return <div className="ranking-row" key={item.label}><div><span>{item.label}</span><strong>{item.count} <I18nText text={"movimentos"} /></strong></div><div className="ranking-track"><i style={{ width: `${Math.max(4, (Math.abs(item.value) / max) * 100)}%` }} /></div><small>{formatCompactCurrency(item.value)}</small></div>;
            })}
            {!accountRanking.length && <div className="empty-state"><I18nText text={"Nenhuma conta encontrada para a seleção atual."} /></div>}
          </div>
        </section>
        <section className="card panel reconciliation-method">
          <div className="panel-head"><div><h2 className="panel-title"><I18nText text={"Como usar"} /></h2><span className="panel-note"><I18nText text={"Leitura operacional"} /></span></div></div>
          <p><I18nText text={"Use o mês selecionado para acompanhar o que já foi conciliado e o que ainda precisa de conferência. A lista abaixo fica filtrada pelo mesmo período."} /></p>
          <p><I18nText text={"A conciliação efetiva continua sendo feita no Sienge. Esta tela ajuda a acompanhar o que já está conferido e o que ainda precisa de atenção."} /></p>
          <div className="reconciliation-mini-stats">
            <span>{visibleMovements.length} <I18nText text={"movimentos no recorte"} /></span>
            <span>{reconciledInView} <I18nText text={"conciliados"} /></span>
            <span>{linkedInView} <I18nText text={"vinculados"} /></span>
          </div>
        </section>
      </div>

      <UntitledMovementsPanel movements={untitledMovements} periodLabel={selectedLabel} />

      <ReconciliationExplorer movements={visibleMovements} periodLabel={selectedLabel} />
    </>
  );
}
