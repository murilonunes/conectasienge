"use client";

import { useEffect, useMemo, useState } from "react";
import type { QuotationPortalData, QuotationStatus } from "@/features/quotations/data";
import { QuotationsFiltersBar } from "./quotations/filters-bar";
import { statusOrder, requestPayload } from "./quotations/helpers";
import { QuotationsList } from "./quotations/quotations-list";
import { QuotationRequestBridge } from "./quotations/request-bridge";
import { QuotationsStatusTabs } from "./quotations/status-tabs";
import { QuotationsSummaryStats } from "./quotations/summary-stats";

export function QuotationsPortal({ data }: { data: QuotationPortalData }) {
  const [status, setStatus] = useState<QuotationStatus | "Todas">("Todas");
  const [buyer, setBuyer] = useState("");
  const [search, setSearch] = useState("");
  const [buyerId, setBuyerId] = useState("");
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().slice(0, 10));
  const [preview, setPreview] = useState<string>("");
  const [insertResult, setInsertResult] = useState<string>("");
  const [insertOk, setInsertOk] = useState(false);
  const [inserting, setInserting] = useState(false);
  const [selectedItemNumbers, setSelectedItemNumbers] = useState<Set<number>>(new Set());

  useEffect(() => {
    setSelectedItemNumbers(new Set(data.request?.items.map((item) => item.itemNumber) || []));
  }, [data.request?.purchaseRequestId]);

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

  function selectedRequestPayload() {
    if (!data.request) return undefined;
    const items = data.request.items.filter((item) => selectedItemNumbers.has(item.itemNumber));
    return requestPayload({ ...data.request, items, itemCount: items.length });
  }

  async function prepareSiengeInsertion() {
    const payload = {
      dryRun: true,
      buyerId: buyerId.trim(),
      date: quotationDate,
      request: selectedRequestPayload()
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
        request: selectedRequestPayload()
      };
      let response = await fetch("/api/sienge/purchase-quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      let json = await response.json();
      if (response.status === 409 && json.alreadyIntegrated) {
        if (window.confirm(`${json.message}\n\nDeseja repetir a criação mesmo assim?`)) {
          response = await fetch("/api/sienge/purchase-quotations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, force: true })
          });
          json = await response.json();
        }
      }
      setInsertResult(JSON.stringify(json, null, 2));
      setInsertOk(response.ok);
    } finally {
      setInserting(false);
    }
  }

  return (
    <section className="advanced-search quotation-search">
      {data.error && <div className="card data-notice"><strong>Atenção</strong><span>{data.error}</span></div>}
      {data.warning && <div className="card data-notice"><strong>Atenção</strong><span>{data.warning}</span></div>}

      <QuotationsFiltersBar
        data={data}
        status={status}
        buyer={buyer}
        search={search}
        onStatusChange={setStatus}
        onBuyerChange={setBuyer}
        onSearchChange={setSearch}
        onClear={() => { setStatus("Todas"); setBuyer(""); setSearch(""); }}
      />

      {data.request && (
        <QuotationRequestBridge
          request={data.request}
          buyerId={buyerId}
          quotationDate={quotationDate}
          preview={preview}
          insertResult={insertResult}
          insertOk={insertOk}
          inserting={inserting}
          selectedItemNumbers={selectedItemNumbers}
          onSelectedItemNumbersChange={setSelectedItemNumbers}
          onBuyerIdChange={setBuyerId}
          onQuotationDateChange={setQuotationDate}
          onPrepare={prepareSiengeInsertion}
          onCreate={createQuotationInSienge}
        />
      )}

      <QuotationsSummaryStats filteredCount={filtered.length} open={summary.open} decision={summary.decision} total={summary.total} />
      <QuotationsStatusTabs status={status} statusCounts={statusCounts} filteredCount={filtered.length} onStatusChange={setStatus} />
      <QuotationsList items={filtered} resetKey={`${status}-${buyer}-${search}`} />
    </section>
  );
}
