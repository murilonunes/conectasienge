"use client";

import { useEffect, useMemo, useState } from "react";
import type { QuotationItemSummary } from "@/features/quotations/data";
import { formatCurrency } from "@/lib/formatters";

type ResponseItem = {
  itemNumber: number;
  attends: boolean;
  unitPrice: string;
  quantity: string;
  deadlineDays: string;
  notes: string;
};

type SupplierQuoteResponseFormProps = {
  token: string;
  quotationCode: string;
  items: QuotationItemSummary[];
  initialDocument?: string;
};

function initialItems(items: QuotationItemSummary[]): ResponseItem[] {
  return items.map((item) => ({
    itemNumber: item.itemNumber,
    attends: false,
    unitPrice: "",
    quantity: String(item.quantity || ""),
    deadlineDays: "",
    notes: ""
  }));
}

function formatDocument(value: string) {
  const clean = value.replace(/\D/g, "");
  if (clean.length === 11) return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (clean.length === 14) return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return value;
}

function itemTotal(item: ResponseItem) {
  if (!item.attends) return 0;
  return Number(item.unitPrice || 0) * Number(item.quantity || 0);
}

export function SupplierQuoteResponseForm({ token, quotationCode, items, initialDocument = "" }: SupplierQuoteResponseFormProps) {
  const [supplierName, setSupplierName] = useState("");
  const [document, setDocument] = useState(initialDocument);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [registration, setRegistration] = useState({ tradeName: "", city: "", state: "" });
  const [responseItems, setResponseItems] = useState(() => initialItems(items));
  const [checkingDocument, setCheckingDocument] = useState(false);
  const [supplierExists, setSupplierExists] = useState<boolean | undefined>();
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const quotedCount = useMemo(() => responseItems.filter((item) => item.attends).length, [responseItems]);
  const quotedTotal = useMemo(() => responseItems.reduce((sum, item) => sum + itemTotal(item), 0), [responseItems]);
  const completedQuotedCount = useMemo(() => responseItems.filter((item) => item.attends && Number(item.unitPrice) > 0 && Number(item.quantity) > 0).length, [responseItems]);
  const missingQuotedValues = quotedCount - completedQuotedCount;
  const canSubmit = Boolean(supplierName.trim())
    && document.replace(/\D/g, "").length >= 11
    && quotedCount > 0
    && missingQuotedValues === 0;

  useEffect(() => {
    const clean = document.replace(/\D/g, "");
    if (clean.length < 11) {
      setSupplierExists(undefined);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCheckingDocument(true);
      try {
        const response = await fetch(`/api/supplier-portal/suppliers?token=${encodeURIComponent(token)}&q=${encodeURIComponent(clean)}&limit=1`, { signal: controller.signal });
        if (!response.ok) return;
        const json = await response.json() as { suppliers: Array<{ name: string }> };
        const supplier = json.suppliers[0];
        setSupplierExists(Boolean(supplier));
        if (supplier && !supplierName) setSupplierName(supplier.name);
      } finally {
        setCheckingDocument(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [document, supplierName]);

  function updateItem(itemNumber: number, field: keyof ResponseItem, value: string | boolean) {
    setResponseItems((current) => current.map((item) => (
      item.itemNumber === itemNumber ? { ...item, [field]: value } : item
    )));
  }

  async function submit() {
    if (!canSubmit) {
      setMessage("Preencha fornecedor, CPF/CNPJ e valor dos itens marcados.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const payload = {
        token,
        supplierName,
        document,
        email,
        phone,
        registration: supplierExists ? undefined : registration,
        items: responseItems.map((item) => ({
          itemNumber: item.itemNumber,
          attends: item.attends,
          unitPrice: Number(item.unitPrice || 0),
          quantity: Number(item.quantity || 0),
          deadlineDays: Number(item.deadlineDays || 0),
          notes: item.notes
        }))
      };
      const response = await fetch("/api/supplier-portal/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Não foi possível enviar a proposta.");
      setSubmitted(true);
      setMessage(json.registrationPending
        ? "Proposta enviada. Seu cadastro ficou pendente para validação."
        : "Proposta enviada com sucesso.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <section className="supplier-public-complete">
        <div className="card supplier-portal-success">
          <span>Cotação {quotationCode}</span>
          <h2>Proposta enviada</h2>
          <p>{message}</p>
          <div className="supplier-success-grid">
            <strong>{quotedCount}<small>Itens atendidos</small></strong>
            <strong>{formatCurrency(quotedTotal)}<small>Total informado</small></strong>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="supplier-portal-form">
      <header className="supplier-public-hero">
        <div>
          <span>Portal de cotação</span>
          <h1>Cotação #{quotationCode}</h1>
        </div>
        <div className="supplier-public-hero-metrics">
          <strong>{items.length}<small>Itens</small></strong>
          <strong>{quotedCount}<small>Marcados</small></strong>
          <strong>{formatCurrency(quotedTotal)}<small>Total</small></strong>
        </div>
      </header>

      <div className="supplier-public-main">
        <div className="supplier-public-stack">
          <section className="card supplier-portal-card supplier-identity-card">
            <div className="supplier-card-head">
              <span>Fornecedor</span>
              <h2>Identificação</h2>
            </div>
            <div className="supplier-portal-grid">
              <label><span>CPF/CNPJ *</span><input value={document} inputMode="numeric" onChange={(event) => setDocument(event.target.value.replace(/\D/g, ""))} placeholder="00000000000000" /></label>
              <label><span>Razão social / Nome *</span><input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} placeholder="Nome do fornecedor" /></label>
              <label><span>E-mail</span><input value={email} type="email" onChange={(event) => setEmail(event.target.value)} placeholder="financeiro@empresa.com.br" /></label>
              <label><span>Telefone</span><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(00) 00000-0000" /></label>
            </div>
            <div className={`supplier-document-status ${supplierExists ? "found" : supplierExists === false ? "pending" : ""}`}>
              <strong>{checkingDocument ? "Consultando" : supplierExists ? "Cadastro localizado" : supplierExists === false ? "Cadastro pendente" : "CPF/CNPJ"}</strong>
              <span>{checkingDocument ? "Verificando base local" : supplierExists ? formatDocument(document) : supplierExists === false ? "Complete os dados cadastrais" : "Informe o documento"}</span>
            </div>
            {supplierExists === false && (
              <div className="supplier-portal-grid supplier-registration-grid">
                <label><span>Nome fantasia</span><input value={registration.tradeName} onChange={(event) => setRegistration((current) => ({ ...current, tradeName: event.target.value }))} /></label>
                <label><span>Cidade</span><input value={registration.city} onChange={(event) => setRegistration((current) => ({ ...current, city: event.target.value }))} /></label>
                <label><span>UF</span><input maxLength={2} value={registration.state} onChange={(event) => setRegistration((current) => ({ ...current, state: event.target.value.toUpperCase() }))} /></label>
              </div>
            )}
          </section>

          <section className="card supplier-portal-card">
            <div className="supplier-card-head">
              <span>Proposta</span>
              <h2>Itens da cotação</h2>
            </div>
            <div className="supplier-quote-items">
              {items.map((item) => {
                const current = responseItems.find((row) => row.itemNumber === item.itemNumber);
                if (!current) return null;
                const total = itemTotal(current);
                return (
                  <article className={current.attends ? "active" : ""} key={item.itemNumber}>
                    <div className="supplier-item-top">
                      <label className="supplier-item-check">
                        <input type="checkbox" checked={current.attends} onChange={(event) => updateItem(item.itemNumber, "attends", event.target.checked)} />
                        <span>
                          <strong>{item.name}</strong>
                          <small>{item.quantity} {item.unit}{item.detail ? ` | ${item.detail}` : ""}</small>
                        </span>
                      </label>
                      <strong className="supplier-item-total">{current.attends ? formatCurrency(total) : "Não atende"}</strong>
                    </div>
                    <div className="supplier-item-values">
                      <label><span>Valor unitário</span><input disabled={!current.attends} value={current.unitPrice} onChange={(event) => updateItem(item.itemNumber, "unitPrice", event.target.value)} type="number" min="0" step="0.01" /></label>
                      <label><span>Quantidade</span><input disabled={!current.attends} value={current.quantity} onChange={(event) => updateItem(item.itemNumber, "quantity", event.target.value)} type="number" min="0" step="0.01" /></label>
                      <label><span>Prazo</span><input disabled={!current.attends} value={current.deadlineDays} onChange={(event) => updateItem(item.itemNumber, "deadlineDays", event.target.value)} type="number" min="0" /></label>
                      <label><span>Observação</span><input disabled={!current.attends} value={current.notes} onChange={(event) => updateItem(item.itemNumber, "notes", event.target.value)} /></label>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="card supplier-portal-submit">
          <span>Cotação {quotationCode}</span>
          <strong>{formatCurrency(quotedTotal)}</strong>
          <small>{quotedCount} de {items.length} item(ns) marcados</small>
          <div className="supplier-submit-progress"><i style={{ width: `${items.length ? Math.round((quotedCount / items.length) * 100) : 0}%` }} /></div>
          <div className="supplier-submit-checks">
            <span className={supplierName.trim() ? "done" : ""}>Fornecedor</span>
            <span className={document.replace(/\D/g, "").length >= 11 ? "done" : ""}>Documento</span>
            <span className={quotedCount > 0 ? "done" : ""}>Itens</span>
            <span className={missingQuotedValues === 0 && quotedCount > 0 ? "done" : ""}>Valores</span>
          </div>
          {message && <div className="settings-inline-message">{message}</div>}
          <button className="button" type="button" disabled={submitting || !canSubmit} onClick={submit}>
            {submitting ? "Enviando..." : "Enviar proposta"}
          </button>
        </aside>
      </div>
    </section>
  );
}
