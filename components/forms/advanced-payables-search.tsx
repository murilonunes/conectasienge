"use client";

import { FormEvent, useMemo, useState } from "react";
import { PayablesAbuseDashboardModal } from "@/components/payables/payables-abuse-dashboard-modal";
import { PayableChargeReviewButton } from "@/components/payables/payable-charge-review-button";
import { IntegrationStamp } from "@/components/ui/integration-stamp";
import { LocalDataList } from "@/components/ui/local-data-list";
import { analyzePayableCharge } from "@/lib/payables-abuse-analysis";
import { formatCurrency, formatDate, formatOptionalDate } from "@/lib/formatters";

type BankMovement = {
  id?: number;
  amount?: number;
  bankMovementDate?: string;
  accountNumber?: string;
  historicName?: string;
  operationName?: string;
  reconcile?: string;
};

type Payment = {
  operationTypeName?: string;
  grossAmount?: number;
  netAmount?: number;
  amount?: number;
  paymentDate?: string;
  sequencialNumber?: number;
  bankMovements?: BankMovement[];
};

type PayableInstallment = {
  companyId?: number;
  companyName?: string;
  creditorId?: number;
  creditorName?: string;
  creditorCnpj?: string;
  creditorCpf?: string;
  billId: number;
  installmentId: number;
  documentIdentificationId?: string;
  documentNumber?: string;
  originId?: string;
  originalAmount?: number;
  balanceAmount?: number;
  correctedBalanceAmount?: number;
  dueDate?: string;
  issueDate?: string;
  authorizationStatus?: string;
  payments?: Payment[];
  __siengeIntegrationDay?: string;
  __siengeIntegratedAt?: string;
};

const today = new Date().toISOString().slice(0, 10);
const initialStart = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10);

function formatTaxId(value?: string) {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length === 14) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (digits.length === 11) return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return value || "";
}

function paymentValue(payment: Payment) {
  return payment.netAmount || payment.grossAmount || payment.amount || 0;
}

function titleSearchValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith("#")) return undefined;
  const billId = Number(trimmed.slice(1).replace(/\D/g, ""));
  return Number.isInteger(billId) && billId > 0 ? billId : undefined;
}

function documentLabel(item: PayableInstallment) {
  const document = [item.documentIdentificationId, item.documentNumber].filter(Boolean).join("-");
  return document || `Título #${item.billId}`;
}

function installmentLabel(item: PayableInstallment, total?: number) {
  if (total && total > 1) return `Parcela ${item.installmentId} de ${total}`;
  return `Parcela ${item.installmentId}`;
}

function dueStatus(item: PayableInstallment) {
  if ((item.payments || []).length > 0) return "paid";
  if (!item.dueDate) return "future";
  const due = new Date(`${item.dueDate.slice(0, 10)}T00:00:00`);
  const now = new Date();
  const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!Number.isNaN(due.getTime()) && due < todayOnly) return "late";
  return "future";
}

export function AdvancedPayablesSearch() {
  const [filters, setFilters] = useState({
    startDate: initialStart, endDate: today, selectionType: "D", correctionIndexerId: "1",
    correctionDate: today, companyId: "", buildingId: "", buildingUnitId: "",
    withBankMovements: true, withAuthorizations: false
  });
  const [paymentStatus, setPaymentStatus] = useState<"all" | "unpaid" | "paid">("all");
  const [onlyAbusiveCharges, setOnlyAbusiveCharges] = useState(false);
  const [textFilter, setTextFilter] = useState("");
  const [results, setResults] = useState<PayableInstallment[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [cacheStatus, setCacheStatus] = useState("");
  const [expanded, setExpanded] = useState<string>();
  const [copiedBillId, setCopiedBillId] = useState<number>();

  const filtered = useMemo(() => results.filter((item) => {
    const titleSearch = titleSearchValue(textFilter);
    if (titleSearch !== undefined) {
      const hasPayment = (item.payments || []).length > 0;
      const hasAbusiveCharge = analyzePayableCharge(item, filters.correctionDate).hasRisk;
      const matchesStatus = paymentStatus === "all" || (paymentStatus === "paid" ? hasPayment : !hasPayment);
      const matchesAbuse = !onlyAbusiveCharges || hasAbusiveCharge;
      return item.billId === titleSearch && matchesStatus && matchesAbuse;
    }
    const text = `${item.billId} ${item.installmentId} ${item.creditorName || ""} ${item.creditorCnpj || ""} ${item.creditorCpf || ""} ${item.documentIdentificationId || ""} ${item.documentNumber || ""} ${item.companyName || ""}`.toLowerCase();
    const search = textFilter.toLowerCase();
    const digitSearch = textFilter.replace(/\D/g, "");
    const documentDigits = `${item.creditorCnpj || ""}${item.creditorCpf || ""}`.replace(/\D/g, "");
    const hasPayment = (item.payments || []).length > 0;
    const hasAbusiveCharge = analyzePayableCharge(item, filters.correctionDate).hasRisk;
    const matchesStatus = paymentStatus === "all" || (paymentStatus === "paid" ? hasPayment : !hasPayment);
    const matchesText = text.includes(search) || (digitSearch.length > 0 && documentDigits.includes(digitSearch));
    const matchesAbuse = !onlyAbusiveCharges || hasAbusiveCharge;
    return matchesText && matchesStatus && matchesAbuse;
  }), [results, textFilter, paymentStatus, onlyAbusiveCharges, filters.correctionDate]);

  const totals = useMemo(() => ({
    original: filtered.reduce((sum, item) => sum + (item.originalAmount || 0), 0),
    corrected: filtered.reduce((sum, item) => sum + analyzePayableCharge(item, filters.correctionDate).correctedAmount, 0),
    balance: filtered.reduce((sum, item) => sum + (item.balanceAmount || 0), 0),
    paid: filtered.reduce((sum, item) => sum + (item.payments || []).reduce((paymentSum, payment) => paymentSum + paymentValue(payment), 0), 0),
    paidIncrease: filtered.reduce((sum, item) => sum + analyzePayableCharge(item, filters.correctionDate).paidIncrease, 0),
    riskCount: filtered.filter((item) => analyzePayableCharge(item, filters.correctionDate).hasRisk).length
  }), [filtered, filters.correctionDate]);

  const installmentTotals = useMemo(() => {
    const counts = new Map<number, Set<number>>();
    results.forEach((item) => {
      const current = counts.get(item.billId) || new Set<number>();
      current.add(item.installmentId);
      counts.set(item.billId, current);
    });
    return new Map(Array.from(counts.entries()).map(([billId, installments]) => [billId, installments.size]));
  }, [results]);

  async function search(event: FormEvent) {
    event.preventDefault();
    await runSearch(false);
  }

  async function runSearch(forceRefresh: boolean) {
    setLoading(true);
    setMessage("");
    setCacheStatus("");
    setResults([]);
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== "") query.set(key, String(value));
    });
    query.set("paymentStatus", paymentStatus);
    if (forceRefresh) query.set("forceRefresh", "true");
    try {
      const startedAt = performance.now();
      const response = await fetch(`/api/sienge/payables/search?${query}`);
      const body = await response.json();
      if (!response.ok) {
        const details = [body.title, body.rateLimitDescription, body.explanation, body.suggestion, body.apiMessage].filter(Boolean).join(" ");
        throw new Error(details || body.message || "Busca não concluída.");
      }
      setResults(body.data || []);
      const elapsed = Math.max(0.1, (performance.now() - startedAt) / 1000).toFixed(1);
      setCacheStatus(`${body.data?.length || 0} parcela(s) encontrada(s) em ${elapsed}s. Dados integrados em ${new Date(body.cacheInfo?.savedAt || Date.now()).toLocaleString("pt-BR")}.`);
      if (body.creditorWarning) setMessage(body.creditorWarning);
      else if (!body.data?.length) setMessage("Nenhuma parcela foi encontrada para os filtros informados.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  const set = (key: keyof typeof filters, value: string | boolean) => setFilters((current) => ({ ...current, [key]: value }));

  async function copyBillId(event: { stopPropagation: () => void }, billId: number) {
    event.stopPropagation();
    await navigator.clipboard.writeText(String(billId));
    setCopiedBillId(billId);
    window.setTimeout(() => setCopiedBillId((current) => current === billId ? undefined : current), 1800);
  }

  function setSelectionType(value: string) {
    set("selectionType", value);
    if (value === "P") setPaymentStatus("paid");
  }

  function setStatus(value: "all" | "unpaid" | "paid") {
    setPaymentStatus(value);
    if (value === "unpaid" && filters.selectionType === "P") set("selectionType", "D");
  }

  return (
    <section className="advanced-search">
      <form className="card advanced-filter-card" onSubmit={search}>
        <div className="form-section-head"><span>BUSCA</span><div><h2>Busca avançada de contas a pagar</h2><p>Localize parcelas e baixas por período, empresa ou obra.</p></div></div>
        <div className="advanced-filter-grid">
          <label><span>Data inicial *</span><input required type="date" value={filters.startDate} onChange={(e) => set("startDate", e.target.value)} /></label>
          <label><span>Data final *</span><input required type="date" value={filters.endDate} onChange={(e) => set("endDate", e.target.value)} /></label>
          <label><span>Pesquisar período por *</span><select value={filters.selectionType} onChange={(e) => setSelectionType(e.target.value)}><option value="D">Data de vencimento</option><option value="I">Data de emissão</option><option value="B">Data de competência</option><option value="P">Data de pagamento</option></select></label>
          <label><span>Situação da baixa</span><select value={paymentStatus} onChange={(e) => setStatus(e.target.value as "all" | "unpaid" | "paid")}><option value="all">Todas as parcelas</option><option value="unpaid">Somente sem baixa</option><option value="paid">Somente com baixa</option></select></label>
          <label><span>Empresa</span><input type="number" min="1" value={filters.companyId} onChange={(e) => set("companyId", e.target.value)} placeholder="Todas" /></label>
          <label><span>Obra</span><input type="number" min="1" value={filters.buildingId} onChange={(e) => set("buildingId", e.target.value)} placeholder="Todas" /></label>
          <label><span>Unidade construtiva</span><input type="number" min="1" value={filters.buildingUnitId} onChange={(e) => set("buildingUnitId", e.target.value)} placeholder="Todas" /></label>
          <label><span>Indexador de correção *</span><input required type="number" min="1" value={filters.correctionIndexerId} onChange={(e) => set("correctionIndexerId", e.target.value)} /></label>
          <label><span>Data de correção *</span><input required type="date" value={filters.correctionDate} onChange={(e) => set("correctionDate", e.target.value)} /></label>
          <label className="check-field"><input type="checkbox" checked={filters.withBankMovements} onChange={(e) => set("withBankMovements", e.target.checked)} /><span>Incluir movimentos bancários</span></label>
          <label className="check-field"><input type="checkbox" checked={filters.withAuthorizations} onChange={(e) => set("withAuthorizations", e.target.checked)} /><span>Incluir autorizações</span></label>
          <label className="check-field"><input type="checkbox" checked={onlyAbusiveCharges} onChange={(e) => setOnlyAbusiveCharges(e.target.checked)} /><span>Somente possíveis cobranças abusivas</span></label>
        </div>
        <div className={`advanced-search-hint ${filters.selectionType === "P" ? "warn" : ""}`}>
          {filters.selectionType === "P"
            ? "Data de pagamento retorna somente parcelas com baixa, pois parcelas não pagas não possuem essa data."
            : "A consulta pelo período selecionado retorna parcelas com e sem baixa. Use Situação da baixa para filtrar os resultados."}
        </div>
        <div className="advanced-search-actions">
          <button className="button advanced-search-button" disabled={loading}>{loading ? "Buscando..." : "Buscar contas a pagar"}</button>
          <a className="button secondary advanced-search-button" href="/configuracoes">Atualizar dados</a>
        </div>
      </form>

      {cacheStatus && <div className="advanced-cache-status">{cacheStatus}</div>}
      {message && <div className="card data-notice"><strong>Busca avançada</strong><span>{message}</span></div>}
      {results.length > 0 && <>
        <div className="stats advanced-stats">
          <article className="card stat"><div className="stat-top"><span>Parcelas encontradas</span></div><div className="stat-value">{filtered.length}</div><span className="panel-note">Após filtro na tela</span></article>
          <article className="card stat"><div className="stat-top"><span>Valor original</span></div><div className="stat-value">{formatCurrency(totals.original)}</div><span className="panel-note">Total das parcelas</span></article>
          <article className="card stat"><div className="stat-top"><span>Valor corrigido</span></div><div className="stat-value">{formatCurrency(totals.corrected)}</div><span className="panel-note">Conforme dados salvos</span></article>
          <article className="card stat"><div className="stat-top"><span>Valor pago</span></div><div className="stat-value">{formatCurrency(totals.paid)}</div><span className="panel-note">Baixas retornadas</span></article>
          <article className="card stat"><div className="stat-top"><span>Multa/juros pagos a mais</span></div><div className="stat-value">{formatCurrency(totals.paidIncrease)}</div><span className="panel-note">Pago acima do original</span></article>
          <article className="card stat"><div className="stat-top"><span>Saldo em aberto</span></div><div className="stat-value">{formatCurrency(totals.balance)}</div><span className="panel-note">Saldo atual</span></article>
          <article className="card stat"><div className="stat-top"><span>Possíveis abusos</span></div><div className="stat-value">{totals.riskCount}</div><span className="panel-note">Acima de 2% + 1% ao mês</span></article>
        </div>
        <div className="card filters">
          <input className="field search-field" value={textFilter} onChange={(e) => setTextFilter(e.target.value)} placeholder="Filtrar por credor, CNPJ, documento, empresa ou código. Use #385 para buscar só o título 385" />
          <label className="advanced-inline-check"><input type="checkbox" checked={onlyAbusiveCharges} onChange={(e) => setOnlyAbusiveCharges(e.target.checked)} /> Somente possíveis abusos</label>
          <PayablesAbuseDashboardModal items={filtered} referenceDate={filters.correctionDate} />
        </div>
        <LocalDataList
          items={filtered}
          itemLabel="parcelas"
          resetKey={`${textFilter}|${paymentStatus}|${onlyAbusiveCharges}|${results.length}`}
          emptyMessage={onlyAbusiveCharges ? "Nenhuma possível cobrança abusiva encontrada após o filtro." : "Nenhuma parcela encontrada após o filtro."}
          renderItems={(pageItems) => (
            <div className="advanced-results">
              {pageItems.map((item) => {
                const key = `${item.billId}-${item.installmentId}`;
                const payments = item.payments || [];
                const review = analyzePayableCharge(item, filters.correctionDate);
                return <article className="card advanced-result" key={key}>
                  <button className="advanced-result-main payable-result-main" onClick={() => setExpanded(expanded === key ? undefined : key)}>
                    <span className="title-installment-block">
                      <span className="title-installment-row">
                        <span className="advanced-title-id" onClick={(event) => copyBillId(event, item.billId)} title="Copiar número do título">
                          <small>Título</small>
                          <strong>#{item.billId}</strong>
                          <span className="copy-title-icon" aria-label="Copiar título">{copiedBillId === item.billId ? "OK" : "⧉"}</span>
                        </span>
                        <span className="title-installment-connector" aria-hidden="true" />
                        <span className="installment-pill">
                          <small>Parcela</small>
                          <strong>{installmentLabel(item, installmentTotals.get(item.billId)).replace(/^Parcela\s*/i, "")}</strong>
                        </span>
                        <span className="title-installment-connector" aria-hidden="true" />
                        <span className={`due-pill ${dueStatus(item)}`}>
                          <small>Vencimento</small>
                          <strong>{formatOptionalDate(item.dueDate)}</strong>
                        </span>
                      </span>
                      <strong>{documentLabel(item)}</strong>
                    </span>
                    <span>
                      <strong>{item.creditorName || `Credor #${item.creditorId}`}</strong>
                      <small className="advanced-creditor-document">
                        {item.creditorCnpj ? `CNPJ ${formatTaxId(item.creditorCnpj)}` : item.creditorCpf ? `CPF ${formatTaxId(item.creditorCpf)}` : "CNPJ não informado"}
                      </small>
                      <small>{item.companyName || `Empresa #${item.companyId}`}</small>
                    </span>
                    <span><strong>{formatCurrency(review.originalAmount)}</strong><small>Original</small></span>
                    <span><strong>{formatCurrency(review.correctedAmount)}</strong><small>Corrigido</small></span>
                    <span><strong>{formatCurrency(review.paidIncrease)}</strong><small>Multa/juros pagos a mais</small></span>
                    <span className={`badge ${payments.length ? "" : "pending"}`}>{payments.length ? `${payments.length} baixa(s)` : "Sem baixa"}</span>
                    <span className="sales-expand">{expanded === key ? "-" : "+"}</span>
                  </button>
                  {expanded === key && <div className="advanced-result-details">
                    <div className="sales-detail-grid">
                      <div><span>Vencimento</span><strong>{item.dueDate ? formatDate(item.dueDate) : "-"}</strong></div>
                      <div><span>Emissão</span><strong>{item.issueDate ? formatDate(item.issueDate) : "-"}</strong></div>
                      <div><span>Autorizada</span><strong>{item.authorizationStatus === "S" ? "Sim" : "Não"}</strong></div>
                      <div><span>Saldo em aberto</span><strong>{formatCurrency(item.balanceAmount || 0)}</strong></div>
                      <div><span>Acréscimo corrigido</span><strong>{formatCurrency(review.correctedIncrease)}</strong></div>
                      <div><span>Limite 2% + 1% ao mês</span><strong>{formatCurrency(review.allowedIncrease)}</strong></div>
                      <div><span>Integração</span><strong><IntegrationStamp record={item} /></strong></div>
                    </div>
                    <PayableChargeReviewButton item={item} title={`Título #${item.billId} / Parcela ${item.installmentId}`} referenceDate={filters.correctionDate} />
                    <div className="payments-list">
                      <h3>Baixas e pagamentos</h3>
                      {payments.length ? payments.map((payment, index) => (
                        <div key={`${payment.sequencialNumber}-${index}`}>
                          <span>{payment.paymentDate ? formatDate(payment.paymentDate) : "Sem data"}</span>
                          <strong>{formatCurrency(paymentValue(payment))}</strong>
                          <span>{payment.operationTypeName || "Operação não informada"}</span>
                          <small>{payment.bankMovements?.length || 0} movimento(s) bancário(s)</small>
                        </div>
                      )) : <p>Nenhuma baixa retornada para esta parcela.</p>}
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
