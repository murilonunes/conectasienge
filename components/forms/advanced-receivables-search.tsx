"use client";

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
      item.mainUnit
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

  const set = (key: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));

  function setSelectionType(value: string) {
    set("selectionType", value);
    if (value === "R") setReceiptStatus("received");
  }

  function setStatus(value: "all" | "open" | "received") {
    setReceiptStatus(value);
    if (value === "open" && filters.selectionType === "R") set("selectionType", "D");
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
      const response = await fetch(`/api/sienge/receivables/search?${query}`);
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
        <div className="form-section-head"><span>BUSCA</span><div><h2>Busca avançada de contas a receber</h2><p>Localize parcelas e recebimentos por período, cliente, empresa ou projeto.</p></div></div>
        <div className="advanced-filter-grid">
          <label><span>Data inicial *</span><input required type="date" value={filters.startDate} onChange={(event) => set("startDate", event.target.value)} /></label>
          <label><span>Data final *</span><input required type="date" value={filters.endDate} onChange={(event) => set("endDate", event.target.value)} /></label>
          <label><span>Pesquisar período por *</span><select value={filters.selectionType} onChange={(event) => setSelectionType(event.target.value)}><option value="D">Data de vencimento</option><option value="I">Data de emissão</option><option value="B">Data de competência</option><option value="R">Data de recebimento</option></select></label>
          <label><span>Situação do recebimento</span><select value={receiptStatus} onChange={(event) => setStatus(event.target.value as "all" | "open" | "received")}><option value="all">Todas as parcelas</option><option value="open">Somente sem recebimento</option><option value="received">Somente com recebimento</option></select></label>
          <label><span>Empresa</span><input type="number" min="1" value={filters.companyId} onChange={(event) => set("companyId", event.target.value)} placeholder="Todas" /></label>
          <label><span>Projeto</span><input type="number" min="1" value={filters.projectId} onChange={(event) => set("projectId", event.target.value)} placeholder="Todos" /></label>
          <label><span>Área de negócio</span><input type="number" min="1" value={filters.businessAreaId} onChange={(event) => set("businessAreaId", event.target.value)} placeholder="Todas" /></label>
          <label><span>Cliente</span><input type="number" min="1" value={filters.clientId} onChange={(event) => set("clientId", event.target.value)} placeholder="Todos" /></label>
        </div>
        <div className={`advanced-search-hint ${filters.selectionType === "R" ? "warn" : ""}`}>
          {filters.selectionType === "R"
            ? "Data de recebimento retorna somente parcelas com baixa registrada, pois parcelas abertas não possuem essa data."
            : "A consulta pelo período selecionado retorna parcelas com e sem recebimento. Use Situação do recebimento para filtrar os resultados."}
        </div>
        <div className="advanced-search-actions">
          <button className="button advanced-search-button" disabled={loading}>{loading ? "Buscando..." : "Buscar contas a receber"}</button>
          <a className="button secondary advanced-search-button" href="/configuracoes">Atualizar dados</a>
        </div>
      </form>

      {cacheStatus && <div className="advanced-cache-status">{cacheStatus}</div>}
      {message && <div className="card data-notice"><strong>Busca avançada</strong><span>{message}</span></div>}
      {results.length > 0 && <>
        <div className="stats advanced-stats">
          <article className="card stat"><div className="stat-top"><span>Parcelas encontradas</span></div><div className="stat-value">{filtered.length}</div><span className="panel-note">Após filtro na tela</span></article>
          <article className="card stat"><div className="stat-top"><span>Valor original</span></div><div className="stat-value">{formatCurrency(totals.original)}</div><span className="panel-note">Total das parcelas</span></article>
          <article className="card stat"><div className="stat-top"><span>Saldo a receber</span></div><div className="stat-value">{formatCurrency(totals.open)}</div><span className="panel-note">{totals.openCount} parcela(s) sem recebimento</span></article>
          <article className="card stat"><div className="stat-top"><span>Recebido</span></div><div className="stat-value">{formatCurrency(totals.received)}</div><span className="panel-note">{totals.receivedCount} parcela(s) com recebimento</span></article>
        </div>
        <div className="card filters">
          <input className="field search-field" value={textFilter} onChange={(event) => setTextFilter(event.target.value)} placeholder="Filtrar por cliente, título, documento, empresa, projeto ou unidade. Use #385 para buscar só o título 385" />
        </div>
        <LocalDataList
          items={filtered}
          itemLabel="parcelas"
          resetKey={`${textFilter}|${receiptStatus}|${results.length}`}
          emptyMessage="Nenhuma parcela encontrada após o filtro."
          renderItems={(pageItems) => (
            <div className="advanced-results">
              {pageItems.map((item) => {
                const key = `${item.billId}-${item.installmentId}`;
                const receipts = item.receipts || [];
                const received = receipts.reduce((sum, receipt) => sum + receiptValue(receipt), 0);
                return <article className="card advanced-result" key={key}>
                  <button className="advanced-result-main" onClick={() => setExpanded(expanded === key ? undefined : key)}>
                    <span>
                      <span className="advanced-title-id">Título #{item.billId}</span>
                      <strong>{documentLabel(item)}</strong>
                      <small>Parcela {item.installmentId}</small>
                      <IntegrationStamp record={item} />
                      <span className="copy-title-button" role="button" tabIndex={0} onClick={(event) => copyBillId(event, item.billId)} onKeyDown={(event) => { if (event.key === "Enter") copyBillId(event, item.billId); }}>
                        {copiedBillId === item.billId ? "Copiado" : "Copiar número"}
                      </span>
                    </span>
                    <span>
                      <strong>{item.clientName || `Cliente #${item.clientId || "não informado"}`}</strong>
                      <small>{item.companyName || `Empresa #${item.companyId || "não informada"}`}</small>
                      <small>{item.projectName || item.businessAreaName || item.mainUnit || "Projeto não informado"}</small>
                    </span>
                    <span><strong>{formatCurrency(item.originalAmount || 0)}</strong><small>Original</small></span>
                    <span><strong>{formatCurrency(openAmount(item))}</strong><small>Saldo</small></span>
                    <span><strong>{formatCurrency(received)}</strong><small>Recebido</small></span>
                    <span><strong>{formatOptionalDate(item.dueDate)}</strong><small>Vencimento</small></span>
                    <span className={`badge ${receipts.length ? "" : "pending"}`}>{receipts.length ? `${receipts.length} recebimento(s)` : "Sem recebimento"}</span>
                    <span className="sales-expand">{expanded === key ? "-" : "+"}</span>
                  </button>
                  {expanded === key && <div className="advanced-result-details">
                    <div className="sales-detail-grid">
                      <div><span>Vencimento</span><strong>{formatOptionalDate(item.dueDate)}</strong></div>
                      <div><span>Emissão</span><strong>{formatOptionalDate(item.issueDate)}</strong></div>
                      <div><span>Competência</span><strong>{formatOptionalDate(item.billDate)}</strong></div>
                      <div><span>Previsão</span><strong>{item.documentForecast === "S" ? "Sim" : "Não"}</strong></div>
                    </div>
                    <div className="payments-list">
                      <h3>Recebimentos</h3>
                      {receipts.length ? receipts.map((receipt, index) => (
                        <div key={`${receipt.sequencialNumber}-${index}`}>
                          <span>{receipt.paymentDate ? formatDate(receipt.paymentDate) : "Sem data"}</span>
                          <strong>{formatCurrency(receiptValue(receipt))}</strong>
                          <span>{receipt.operationTypeName || "Operação não informada"}</span>
                          <small>{receipt.bankMovements?.length || 0} movimento(s) bancário(s)</small>
                        </div>
                      )) : <p>Nenhum recebimento retornado para esta parcela.</p>}
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
