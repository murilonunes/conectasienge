"use client";

import { I18nText } from "@/components/i18n/i18n-text";
import { FormEvent, useMemo, useState } from "react";
import { IntegrationStamp } from "@/components/ui/integration-stamp";
import { LocalDataList } from "@/components/ui/local-data-list";
import { formatCurrency, formatDate, formatOptionalDate } from "@/lib/formatters";

type BankMovement = {
  amount?: number;
  bankMovementDate?: string;
  accountNumber?: string;
  historicName?: string;
  operationName?: string;
  reconcile?: string;
};

type Receipt = {
  operationTypeName?: string;
  grossAmount?: number;
  netAmount?: number;
  paymentDate?: string;
  calculationDate?: string;
  sequencialNumber?: number;
  registeredUserName?: string;
  registeredAt?: string;
  changedUserName?: string;
  changedAt?: string;
  auditSource?: string;
  bankMovements?: BankMovement[];
};

type ReceivableInstallment = {
  companyId?: number;
  companyName?: string;
  businessAreaName?: string;
  projectId?: number;
  projectName?: string;
  clientId?: number;
  clientName?: string;
  billId: number;
  installmentId: number;
  documentIdentificationId?: string;
  documentNumber?: string;
  documentForecast?: string;
  installmentNumber?: string | number;
  originalAmount?: number;
  balanceAmount?: number;
  correctedBalanceAmount?: number;
  dueDate?: string;
  issueDate?: string;
  billDate?: string;
  mainUnit?: string;
  receipts?: Receipt[];
  __siengeIntegrationDay?: string;
  __siengeIntegratedAt?: string;
};

type ReceivableCsvRow = {
  billId: number;
  installment: string;
  document: string;
  client: string;
  company: string;
  project: string;
  dueDate?: string;
  issueDate?: string;
  billDate?: string;
  originalAmount: number;
  openAmount: number;
  receivedAmount: number;
  receiptDate?: string;
  receiptType?: string;
  receiptSequence?: number;
  settlementRegisteredAt?: string;
  settlementRegisteredBy?: string;
  integrationDay?: string;
};

const today = new Date().toISOString().slice(0, 10);
const initialStart = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10);

function receiptValue(receipt: Receipt) {
  return receipt.netAmount || receipt.grossAmount || 0;
}

function openAmount(item: ReceivableInstallment) {
  if (typeof item.correctedBalanceAmount === "number") return item.correctedBalanceAmount;
  if (typeof item.balanceAmount === "number") return item.balanceAmount;
  return item.originalAmount || 0;
}

function documentLabel(item: ReceivableInstallment) {
  const document = [item.documentIdentificationId, item.documentNumber].filter(Boolean).join("-");
  return document || `Título #${item.billId}`;
}

function titleSearchValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("#")) return undefined;
  const billId = Number(trimmed.slice(1).replace(/\D/g, ""));
  return Number.isInteger(billId) && billId > 0 ? billId : undefined;
}

function installmentLabel(item: ReceivableInstallment, total?: number) {
  const current = item.installmentNumber || item.installmentId;
  const text = String(current || "").trim();
  if (text.includes("/")) return `Parcela ${text}`;
  if (total && total > 1) return `Parcela ${text || item.installmentId} de ${total}`;
  return `Parcela ${text || item.installmentId}`;
}

function dueStatus(item: ReceivableInstallment) {
  if ((item.receipts || []).length > 0) return "paid";
  if (!item.dueDate) return "future";
  const due = new Date(`${item.dueDate.slice(0, 10)}T00:00:00`);
  const now = new Date();
  const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!Number.isNaN(due.getTime()) && due < todayOnly) return "late";
  return "future";
}

function formatDateTime(value?: string) {
  if (!value) return undefined;
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function csvDateTime(value?: string) {
  return formatDateTime(value) || "";
}

function buildReceivableCsvRows(items: ReceivableInstallment[], totalsByBill: Map<number, number>): ReceivableCsvRow[] {
  return items.flatMap((item) => {
    const receipts = item.receipts || [];
    const base = {
      billId: item.billId,
      installment: installmentLabel(item, totalsByBill.get(item.billId)).replace(/^Parcela\s*/i, ""),
      document: documentLabel(item),
      client: item.clientName || `Cliente #${item.clientId || "nao informado"}`,
      company: item.companyName || `Empresa #${item.companyId || "nao informada"}`,
      project: item.projectName || item.businessAreaName || item.mainUnit || "",
      dueDate: item.dueDate,
      issueDate: item.issueDate,
      billDate: item.billDate,
      originalAmount: item.originalAmount || 0,
      openAmount: openAmount(item),
      integrationDay: item.__siengeIntegrationDay
    };
    if (!receipts.length) {
      return [{ ...base, receivedAmount: 0 }];
    }
    return receipts.map((receipt) => ({
      ...base,
      receivedAmount: receiptValue(receipt),
      receiptDate: receipt.paymentDate,
      receiptType: receipt.operationTypeName,
      receiptSequence: receipt.sequencialNumber,
      settlementRegisteredAt: receipt.registeredAt,
      settlementRegisteredBy: receipt.registeredUserName
    }));
  });
}

export function AdvancedReceivablesSearch() {
  const [filters, setFilters] = useState({
    startDate: initialStart,
    endDate: today,
    selectionType: "D",
    companyId: "",
    projectId: "",
    businessAreaId: "",
    clientId: ""
  });
  const [receiptStatus, setReceiptStatus] = useState<"all" | "open" | "received">("all");
  const [textFilter, setTextFilter] = useState("");
  const [results, setResults] = useState<ReceivableInstallment[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [cacheStatus, setCacheStatus] = useState("");
  const [expanded, setExpanded] = useState<string>();
  const [copiedBillId, setCopiedBillId] = useState<number>();

  const filtered = useMemo(() => results.filter((item) => {
    const titleSearch = titleSearchValue(textFilter);
    if (titleSearch !== undefined) {
      const hasReceipt = (item.receipts || []).length > 0;
      const matchesStatus = receiptStatus === "all" || (receiptStatus === "received" ? hasReceipt : !hasReceipt);
      return item.billId === titleSearch && matchesStatus;
    }
    const text = [
      item.billId,
      item.installmentId,
      item.clientName,
      item.clientId,
      item.documentIdentificationId,
      item.documentNumber,
      item.companyName,
      item.projectName,
      item.businessAreaName,
      item.mainUnit,
      ...(item.receipts || []).flatMap((receipt) => [receipt.registeredUserName, receipt.registeredAt])
    ].filter(Boolean).join(" ").toLowerCase();
    const hasReceipt = (item.receipts || []).length > 0;
    const matchesStatus = receiptStatus === "all" || (receiptStatus === "received" ? hasReceipt : !hasReceipt);
    return text.includes(textFilter.toLowerCase()) && matchesStatus;
  }), [results, textFilter, receiptStatus]);

  const totals = useMemo(() => ({
    original: filtered.reduce((sum, item) => sum + (item.originalAmount || 0), 0),
    corrected: filtered.reduce((sum, item) => sum + openAmount(item), 0),
    received: filtered.reduce((sum, item) => sum + (item.receipts || []).reduce((receiptSum, receipt) => receiptSum + receiptValue(receipt), 0), 0),
    open: filtered.reduce((sum, item) => sum + openAmount(item), 0),
    receivedCount: filtered.filter((item) => (item.receipts || []).length > 0).length,
    openCount: filtered.filter((item) => !(item.receipts || []).length).length
  }), [filtered]);

  const installmentTotals = useMemo(() => {
    const counts = new Map<number, Set<string | number>>();
    results.forEach((item) => {
      const current = counts.get(item.billId) || new Set<string | number>();
      current.add(item.installmentNumber || item.installmentId);
      counts.set(item.billId, current);
    });
    return new Map(Array.from(counts.entries()).map(([billId, installments]) => [billId, installments.size]));
  }, [results]);

  const set = (key: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));

  function setSelectionType(value: string) {
    set("selectionType", value);
    if (value === "R" || value === "C") setReceiptStatus("received");
  }

  function setStatus(value: "all" | "open" | "received") {
    setReceiptStatus(value);
    if (value === "open" && (filters.selectionType === "R" || filters.selectionType === "C")) set("selectionType", "D");
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setCacheStatus("");
    setResults([]);
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== "") query.set(key, String(value));
    });
    query.set("receiptStatus", receiptStatus);
    try {
      const startedAt = performance.now();
      const response = await fetch(`/api/sienge/receivables/search?${query}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || body.title || "Busca não concluída.");
      setResults(body.data || []);
      const elapsed = Math.max(0.1, (performance.now() - startedAt) / 1000).toFixed(1);
      setCacheStatus(`${body.data?.length || 0} parcela(s) encontrada(s) em ${elapsed}s. Dados integrados em ${new Date(body.cacheInfo?.savedAt || Date.now()).toLocaleString("pt-BR")}.`);
      if (!body.data?.length) setMessage("Nenhuma parcela foi encontrada para os filtros informados.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  async function copyBillId(event: { stopPropagation: () => void }, billId: number) {
    event.stopPropagation();
    await navigator.clipboard.writeText(String(billId));
    setCopiedBillId(billId);
    window.setTimeout(() => setCopiedBillId((current) => current === billId ? undefined : current), 1800);
  }

  return (
    <section className="advanced-search">
      <form className="card advanced-filter-card" onSubmit={search}>
        <div className="form-section-head"><span><I18nText text={"BUSCA"} /></span><div><h2><I18nText text={"Busca avançada de contas a receber"} /></h2><p><I18nText text={"Localize parcelas e recebimentos por período, cliente, empresa ou projeto."} /></p></div></div>
        <div className="advanced-filter-grid">
          <label><span><I18nText text={"Data inicial *"} /></span><input required type="date" value={filters.startDate} onChange={(event) => set("startDate", event.target.value)} /></label>
          <label><span><I18nText text={"Data final *"} /></span><input required type="date" value={filters.endDate} onChange={(event) => set("endDate", event.target.value)} /></label>
          <label><span><I18nText text={"Pesquisar período por *"} /></span><select value={filters.selectionType} onChange={(event) => setSelectionType(event.target.value)}><option value="D"><I18nText text={"Data de vencimento"} /></option><option value="I"><I18nText text={"Data de emissão"} /></option><option value="B"><I18nText text={"Data de competência"} /></option><option value="R"><I18nText text={"Data de recebimento"} /></option><option value="C"><I18nText text={"Data de registro da baixa"} /></option></select></label>
          <label><span><I18nText text={"Situação do recebimento"} /></span><select value={receiptStatus} onChange={(event) => setStatus(event.target.value as "all" | "open" | "received")}><option value="all"><I18nText text={"Todas as parcelas"} /></option><option value="open"><I18nText text={"Somente sem recebimento"} /></option><option value="received"><I18nText text={"Somente com recebimento"} /></option></select></label>
          <label><span><I18nText text={"Empresa"} /></span><input type="number" min="1" value={filters.companyId} onChange={(event) => set("companyId", event.target.value)} placeholder="Todas" data-i18n-placeholder={"Todas"} /></label>
          <label><span><I18nText text={"Projeto"} /></span><input type="number" min="1" value={filters.projectId} onChange={(event) => set("projectId", event.target.value)} placeholder="Todos" data-i18n-placeholder={"Todos"} /></label>
          <label><span><I18nText text={"Área de negócio"} /></span><input type="number" min="1" value={filters.businessAreaId} onChange={(event) => set("businessAreaId", event.target.value)} placeholder="Todas" data-i18n-placeholder={"Todas"} /></label>
          <label><span><I18nText text={"Cliente"} /></span><input type="number" min="1" value={filters.clientId} onChange={(event) => set("clientId", event.target.value)} placeholder="Todos" data-i18n-placeholder={"Todos"} /></label>
        </div>
        <div className={`advanced-search-hint ${filters.selectionType === "R" || filters.selectionType === "C" ? "warn" : ""}`}>
          {filters.selectionType === "C"
            ? <I18nText text={"Data de registro da baixa usa o banco extraído do Sienge para mostrar quando e por quem a baixa foi cadastrada."} />
            : filters.selectionType === "R"
            ? <I18nText text={"Data de recebimento retorna somente parcelas com baixa registrada, pois parcelas abertas não possuem essa data."} />
            : <I18nText text={"A consulta pelo período selecionado retorna parcelas com e sem recebimento. Use Situação do recebimento para filtrar os resultados."} />}
        </div>
        <div className="advanced-search-actions">
          <button className="button advanced-search-button" disabled={loading}><I18nText text={loading ? "Buscando..." : "Buscar contas a receber"} /></button>
          <a className="button secondary advanced-search-button" href="/configuracoes"><I18nText text={"Atualizar dados"} /></a>
        </div>
      </form>

      {cacheStatus && <div className="advanced-cache-status"><I18nText text={cacheStatus} /></div>}
      {message && <div className="card data-notice"><strong><I18nText text={"Busca avançada"} /></strong><span><I18nText text={message} /></span></div>}
      {results.length > 0 && <>
        <div className="stats advanced-stats">
          <article className="card stat"><div className="stat-top"><span><I18nText text={"Parcelas encontradas"} /></span></div><div className="stat-value">{filtered.length}</div><span className="panel-note"><I18nText text={"Após filtro na tela"} /></span></article>
          <article className="card stat"><div className="stat-top"><span><I18nText text={"Valor original"} /></span></div><div className="stat-value">{formatCurrency(totals.original)}</div><span className="panel-note"><I18nText text={"Total das parcelas"} /></span></article>
          <article className="card stat"><div className="stat-top"><span><I18nText text={"Saldo a receber"} /></span></div><div className="stat-value">{formatCurrency(totals.open)}</div><span className="panel-note">{totals.openCount} <I18nText text={"parcela(s) sem recebimento"} /></span></article>
          <article className="card stat"><div className="stat-top"><span><I18nText text={"Recebido"} /></span></div><div className="stat-value">{formatCurrency(totals.received)}</div><span className="panel-note">{totals.receivedCount} <I18nText text={"parcela(s) com recebimento"} /></span></article>
        </div>
        <div className="card filters">
          <input className="field search-field" value={textFilter} onChange={(event) => setTextFilter(event.target.value)} placeholder="Filtrar por cliente, título, documento, empresa, projeto ou unidade. Use #385 para buscar só o título 385" data-i18n-placeholder={"Filtrar por cliente, título, documento, empresa, projeto ou unidade. Use #385 para buscar só o título 385"} />
        </div>
        <LocalDataList
          items={filtered}
          itemLabel="parcelas"
          resetKey={`${textFilter}|${receiptStatus}|${results.length}`}
          csvExport={{
            fileName: `contas-receber-${today}.csv`,
            buttonLabel: "Exportar CSV",
            rows: (items) => buildReceivableCsvRows(items, installmentTotals),
            columns: [
              { header: "Titulo", value: (row) => (row as ReceivableCsvRow).billId },
              { header: "Parcela", value: (row) => (row as ReceivableCsvRow).installment },
              { header: "Documento", value: (row) => (row as ReceivableCsvRow).document },
              { header: "Cliente", value: (row) => (row as ReceivableCsvRow).client },
              { header: "Empresa", value: (row) => (row as ReceivableCsvRow).company },
              { header: "Projeto", value: (row) => (row as ReceivableCsvRow).project },
              { header: "Vencimento", value: (row) => (row as ReceivableCsvRow).dueDate },
              { header: "Emissao", value: (row) => (row as ReceivableCsvRow).issueDate },
              { header: "Competencia", value: (row) => (row as ReceivableCsvRow).billDate },
              { header: "Valor original", value: (row) => (row as ReceivableCsvRow).originalAmount },
              { header: "Saldo", value: (row) => (row as ReceivableCsvRow).openAmount },
              { header: "Recebido", value: (row) => (row as ReceivableCsvRow).receivedAmount },
              { header: "Data recebimento", value: (row) => (row as ReceivableCsvRow).receiptDate },
              { header: "Tipo recebimento", value: (row) => (row as ReceivableCsvRow).receiptType },
              { header: "Sequencia baixa", value: (row) => (row as ReceivableCsvRow).receiptSequence },
              { header: "Cadastro da baixa", value: (row) => csvDateTime((row as ReceivableCsvRow).settlementRegisteredAt) },
              { header: "Usuario da baixa", value: (row) => (row as ReceivableCsvRow).settlementRegisteredBy },
              { header: "Integrado em", value: (row) => (row as ReceivableCsvRow).integrationDay }
            ]
          }}
          emptyMessage="Nenhuma parcela encontrada após o filtro."
          renderItems={(pageItems) => (
            <div className="advanced-results">
              {pageItems.map((item) => {
                const key = `${item.billId}-${item.installmentId}`;
                const receipts = item.receipts || [];
                const received = receipts.reduce((sum, receipt) => sum + receiptValue(receipt), 0);
                return <article className="card advanced-result" key={key}>
                  <button className="advanced-result-main receivable-result-main" onClick={() => setExpanded(expanded === key ? undefined : key)}>
                    <span className="title-installment-block">
                      <span className="title-installment-row">
                        <span className="advanced-title-id" onClick={(event) => copyBillId(event, item.billId)} title="Copiar número do título" data-i18n-title={"Copiar número do título"}>
                          <small><I18nText text={"Título"} /></small>
                          <strong><I18nText text={"#"} />{item.billId}</strong>
                          <span className="copy-title-icon" aria-label="Copiar título" data-i18n-aria-label={"Copiar título"}><I18nText text={copiedBillId === item.billId ? "OK" : "⧉"} /></span>
                        </span>
                        <span className="title-installment-connector" aria-hidden="true" />
                        <span className="installment-pill">
                          <small><I18nText text={"Parcela"} /></small>
                          <strong>{installmentLabel(item, installmentTotals.get(item.billId)).replace(/^Parcela\s*/i, "")}</strong>
                        </span>
                        <span className="title-installment-connector" aria-hidden="true" />
                        <span className={`due-pill ${dueStatus(item)}`}>
                          <small><I18nText text={"Vencimento"} /></small>
                          <strong>{formatOptionalDate(item.dueDate)}</strong>
                        </span>
                      </span>
                      <strong>{documentLabel(item)}</strong>
                    </span>
                    <span>
                      <strong>{item.clientName || `Cliente #${item.clientId || "não informado"}`}</strong>
                      <small>{item.companyName || `Empresa #${item.companyId || "não informada"}`}</small>
                      <small>{item.projectName || item.businessAreaName || item.mainUnit || <I18nText text={"Projeto não informado"} />}</small>
                    </span>
                    <span><strong>{formatCurrency(item.originalAmount || 0)}</strong><small><I18nText text={"Original"} /></small></span>
                    <span><strong>{formatCurrency(openAmount(item))}</strong><small><I18nText text={"Saldo"} /></small></span>
                    <span><strong>{formatCurrency(received)}</strong><small><I18nText text={"Recebido"} /></small></span>
                    <span className={`badge ${receipts.length ? "" : "pending"}`}>{receipts.length ? `${receipts.length} recebimento(s)` : <I18nText text={"Sem recebimento"} />}</span>
                    <span className="sales-expand"><I18nText text={expanded === key ? "-" : "+"} /></span>
                  </button>
                  {expanded === key && <div className="advanced-result-details">
                    <div className="sales-detail-grid">
                      <div><span><I18nText text={"Vencimento"} /></span><strong>{formatOptionalDate(item.dueDate)}</strong></div>
                      <div><span><I18nText text={"Emissão"} /></span><strong>{formatOptionalDate(item.issueDate)}</strong></div>
                      <div><span><I18nText text={"Competência"} /></span><strong>{formatOptionalDate(item.billDate)}</strong></div>
                      <div><span><I18nText text={"Previsão"} /></span><strong><I18nText text={item.documentForecast === "S" ? "Sim" : "Não"} /></strong></div>
                      <div><span><I18nText text={"Integração"} /></span><strong><IntegrationStamp record={item} /></strong></div>
                    </div>
                    <div className="payments-list">
                      <h3><I18nText text={"Recebimentos"} /></h3>
                      {receipts.length ? receipts.map((receipt, index) => (
                        <div key={`${receipt.sequencialNumber}-${index}`}>
                          <span>{receipt.paymentDate ? formatDate(receipt.paymentDate) : <I18nText text={"Sem data"} />}</span>
                          <strong>{formatCurrency(receiptValue(receipt))}</strong>
                          <span>{receipt.operationTypeName || <I18nText text={"Operação não informada"} />}</span>
                          <small>{receipt.bankMovements?.length || 0} <I18nText text={"movimento(s) bancário(s)"} /></small>
                          <div className={receipt.registeredAt ? "receipt-audit" : "receipt-audit muted"}>
                            <span><I18nText text={"Cadastro da baixa"} /></span>
                            <strong>
                              {receipt.registeredAt
                                ? `${formatDateTime(receipt.registeredAt)}${receipt.registeredUserName ? ` por ${receipt.registeredUserName}` : ""}`
                                : <I18nText text={"Não disponível na API pública"} />}
                            </strong>
                          </div>
                        </div>
                      )) : <p><I18nText text={"Nenhum recebimento retornado para esta parcela."} /></p>}
                    </div>
                  </div>}
                </article>;
              })}
            </div>
          )}
        />
      </>}
    </section>
  );
}
