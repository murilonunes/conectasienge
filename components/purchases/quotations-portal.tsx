"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PurchaseRequestForQuotation, QuotationPortalData, QuotationStatus, QuotationSummary } from "@/features/quotations/data";
import { LocalDataList } from "@/components/ui/local-data-list";
import { formatCompactCurrency, formatCurrency, formatOptionalDate } from "@/lib/formatters";

const statusOrder: QuotationStatus[] = [
  "Registrada",
  "Em negociação",
  "Pronta para decisão",
  "Negociação fechada",
  "Sem fornecedores"
];

function statusClass(status: QuotationStatus) {
  if (status === "Sem fornecedores") return "pending";
  if (status === "Pronta para decisão") return "late";
  return "";
}

function statusNote(status: QuotationStatus) {
  if (status === "Sem fornecedores") return "Fornecedor";
  if (status === "Registrada") return "Nova";
  if (status === "Em negociação") return "Negociação";
  if (status === "Pronta para decisão") return "Decisão";
  return "Fechada";
}

function requestPayload(request: PurchaseRequestForQuotation) {
  return {
    source: "purchase-request",
    purchaseRequestId: request.purchaseRequestId,
    items: request.items.map((item) => ({
      purchaseRequestId: request.purchaseRequestId,
      purchaseRequestItemNumber: item.itemNumber,
      deliveryRequirementNumber: 1
    }))
  };
}

export function QuotationsPortal({ data }: { data: QuotationPortalData }) {
  const [status, setStatus] = useState<QuotationStatus | "Todas">("Todas");
  const [buyer, setBuyer] = useState("");
  const [search, setSearch] = useState("");
  const [buyerId, setBuyerId] = useState("");
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().slice(0, 10));
  const [preview, setPreview] = useState<string>("");
  const [insertResult, setInsertResult] = useState<string>("");
  const [inserting, setInserting] = useState(false);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return data.quotations.filter((quotation) =>
      (status === "Todas" || quotation.status === status)
      && (!buyer || quotation.buyerId.toLowerCase().includes(buyer.toLowerCase()))
      && (
        !normalizedSearch
        || [
          quotation.code,
          quotation.notes,
          quotation.buyerId,
          quotation.status,
          quotation.selectedSupplier,
          ...quotation.suppliers.map((supplier) => supplier.supplierName),
          ...quotation.items.map((item) => `${item.name} ${item.detail}`)
        ].filter(Boolean).join(" ").toLowerCase().includes(normalizedSearch)
      )
    );
  }, [buyer, data.quotations, search, status]);

  const summary = useMemo(() => {
    const open = data.quotations.filter((quotation) => quotation.status !== "Negociação fechada").length;
    const decision = data.quotations.filter((quotation) => quotation.status === "Pronta para decisão").length;
    const total = data.quotations.reduce((sum, quotation) => sum + quotation.totalValue, 0);
    return { open, decision, total };
  }, [data.quotations]);

  const statusCounts = useMemo(() => {
    const counts = new Map<QuotationStatus, number>();
    statusOrder.forEach((item) => counts.set(item, 0));
    data.quotations.forEach((quotation) => {
      counts.set(quotation.status, (counts.get(quotation.status) || 0) + 1);
    });
    return counts;
  }, [data.quotations]);

  async function prepareSiengeInsertion() {
    const payload = {
      dryRun: true,
      buyerId: buyerId.trim(),
      date: quotationDate,
      request: data.request ? requestPayload(data.request) : undefined
    };
    const response = await fetch("/api/sienge/purchase-quotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await response.json();
    setPreview(JSON.stringify(json, null, 2));
  }

  async function createQuotationInSienge() {
    setInserting(true);
    setInsertResult("");
    try {
      const payload = {
        dryRun: false,
        confirm: true,
        buyerId: buyerId.trim(),
        date: quotationDate,
        request: data.request ? requestPayload(data.request) : undefined
      };
      const response = await fetch("/api/sienge/purchase-quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await response.json();
      setInsertResult(JSON.stringify(json, null, 2));
    } finally {
      setInserting(false);
    }
  }

  return (
    <section className="advanced-search quotation-search">
      {data.error && <div className="card data-notice"><strong>Atenção</strong><span>{data.error}</span></div>}
      {data.warning && <div className="card data-notice"><strong>Atenção</strong><span>{data.warning}</span></div>}

      <form className="card quotation-toolbar" onSubmit={(event) => event.preventDefault()}>
        <div className="advanced-filter-grid quotation-filter-grid">
          <label>
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as QuotationStatus | "Todas")}>
              <option>Todas</option>
              {statusOrder.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span>Comprador</span>
            <input value={buyer} onChange={(event) => setBuyer(event.target.value)} placeholder="Todos" />
          </label>
          <label className="quotation-search-field">
            <span>Pesquisar</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cotação, fornecedor, insumo ou observação" />
          </label>
          <label>
            <span>Origem</span>
            <input value={data.request?.code || "Todas as cotações"} readOnly />
          </label>
          <button className="button secondary quotation-clear-button" type="button" onClick={() => { setStatus("Todas"); setBuyer(""); setSearch(""); }}>
            Limpar
          </button>
        </div>
      </form>

      {data.request && (
        <section className="card quotation-request-bridge">
          <div className="quotation-request-title">
            <span>Origem</span>
            <h2>{data.request.code}</h2>
            <small>{data.request.itemCount} insumos</small>
          </div>
          <div className="quotation-create-box">
            <input className="field" value={buyerId} onChange={(event) => setBuyerId(event.target.value)} placeholder="Comprador Sienge" />
            <input className="field" type="date" value={quotationDate} onChange={(event) => setQuotationDate(event.target.value)} />
            <button className="button" type="button" onClick={prepareSiengeInsertion}>Preparar inserção</button>
            <button className="button secondary" type="button" onClick={createQuotationInSienge} disabled={inserting || !buyerId.trim()}>
              {inserting ? "Gravando..." : "Gravar no Sienge"}
            </button>
          </div>
          {preview && <pre className="quotation-payload-preview">{preview}</pre>}
          {insertResult && <pre className="quotation-payload-preview">{insertResult}</pre>}
        </section>
      )}

      <div className="stats advanced-stats quotation-stats">
        <article className="card stat quotation-stat"><span>Cotações</span><strong>{filtered.length}</strong></article>
        <article className="card stat quotation-stat"><span>Abertas</span><strong>{summary.open}</strong></article>
        <article className="card stat quotation-stat"><span>Decisão</span><strong>{summary.decision}</strong></article>
        <article className="card stat quotation-stat"><span>Total</span><strong>{formatCompactCurrency(summary.total)}</strong></article>
      </div>

      <div className="card filters quotation-quick-filters">
        <button className={status === "Todas" ? "active" : ""} type="button" onClick={() => setStatus("Todas")}>Todas</button>
        {statusOrder.map((item) => (
          <button className={status === item ? "active" : ""} key={item} type="button" onClick={() => setStatus(item)}>
            {statusNote(item)} <strong>{statusCounts.get(item) || 0}</strong>
          </button>
        ))}
        <span className="filter-result"><strong>{filtered.length}</strong><span>cotações</span></span>
      </div>

      <LocalDataList<QuotationSummary>
        items={filtered}
        itemLabel="cotações"
        defaultPageSize={12}
        pageSizeOptions={[12, 24, 48, 96]}
        resetKey={`${status}-${buyer}-${search}`}
        emptyMessage="Nenhuma cotação encontrada para o filtro atual."
        csvExport={{
          fileName: "cotacoes.csv",
          buttonLabel: "Exportar cotações",
          columns: [
            { header: "Cotação", value: (item) => (item as QuotationSummary).code },
            { header: "Status", value: (item) => (item as QuotationSummary).status },
            { header: "Comprador", value: (item) => (item as QuotationSummary).buyerId },
            { header: "Data", value: (item) => (item as QuotationSummary).date },
            { header: "Prazo", value: (item) => (item as QuotationSummary).deadline },
            { header: "Insumos", value: (item) => (item as QuotationSummary).itemCount },
            { header: "Fornecedores", value: (item) => (item as QuotationSummary).supplierCount },
            { header: "Propostas", value: (item) => (item as QuotationSummary).responseCount },
            { header: "Valor total", value: (item) => (item as QuotationSummary).totalValue },
            { header: "Fornecedor selecionado", value: (item) => (item as QuotationSummary).selectedSupplier }
          ]
        }}
        renderItems={(items) => (
          <section className="advanced-results quotation-results">
            {items.map((quotation) => (
              <article className="card advanced-result quotation-result" key={quotation.id}>
                <div className="advanced-result-main quotation-result-main">
                  <span className="quotation-code-cell">
                    <strong>#{quotation.code}</strong>
                    <small>{quotation.selectedSupplier || "Aberta"}</small>
                  </span>
                  <span>
                    <strong>{quotation.buyerId}</strong>
                    <small>{formatOptionalDate(quotation.date)} | {formatOptionalDate(quotation.deadline)}</small>
                  </span>
                  <span><strong>{quotation.itemCount}</strong><small>Insumos</small></span>
                  <span><strong>{quotation.supplierCount}</strong><small>Forn.</small></span>
                  <span><strong>{quotation.responseCount}</strong><small>Propostas</small></span>
                  <span><strong>{formatCurrency(quotation.totalValue)}</strong><small>Total</small></span>
                  <span className={`badge ${statusClass(quotation.status)}`}>{quotation.status}</span>
                  <Link className="payable-review-button compact" href={`/cotacoes/${quotation.id}`}>Abrir</Link>
                </div>
              </article>
            ))}
          </section>
        )}
      />
    </section>
  );
}
