"use client";

import { useState } from "react";
import type { QuotationItemSummary } from "@/features/quotations/data";
import { formatCurrency } from "@/lib/formatters";
import type { SupplierQuoteResponseSummary } from "@/lib/supplier-quote-portal";
import { cashSummaryText, formatDocument, freightSummaryText, itemTotal, termSummaryText } from "./supplier-quote-response-form/helpers";

type SupplierQuoteSubmittedViewProps = {
  token?: string;
  quotationCode: string;
  items: QuotationItemSummary[];
  response: SupplierQuoteResponseSummary;
  message?: string;
  canRequestNewLink?: boolean;
};

export function SupplierQuoteSubmittedView({
  token,
  quotationCode,
  items,
  response,
  message,
  canRequestNewLink = false
}: SupplierQuoteSubmittedViewProps) {
  const [requestingLink, setRequestingLink] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const terms = response.commercialTerms;
  const attendedItems = response.items.filter((item) => item.attends);
  const responseItemsByNumber = new Map(response.items.map((item) => [item.itemNumber, item]));

  async function requestNewLink() {
    if (!token) return;
    setRequestingLink(true);
    setRequestMessage("");
    try {
      const result = await fetch("/api/supplier-portal/link-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });
      const json = await result.json() as { message?: string };
      if (!result.ok) throw new Error(json.message || "Não foi possível solicitar um novo link.");
      setRequestMessage(json.message || "Solicitação enviada para a equipe de compras.");
    } catch (error) {
      setRequestMessage(error instanceof Error ? error.message : "Erro inesperado ao solicitar novo link.");
    } finally {
      setRequestingLink(false);
    }
  }

  return (
    <section className="supplier-portal-form supplier-submitted-view">
      <header className="supplier-public-hero supplier-print-header">
        <div>
          <span>Proposta enviada</span>
          <h1>Cotação #{quotationCode}</h1>
        </div>
        <div className="supplier-public-hero-metrics">
          <strong className="count">{attendedItems.length}<small>Itens</small></strong>
          <strong className="count">{terms.deliveryDays || "-"}<small>Dias</small></strong>
          <strong className="amount">{formatCurrency(response.totalValue)}<small>Total</small></strong>
        </div>
      </header>

      <div className="card supplier-portal-card supplier-print-actions">
        <div>
          <span>Detalhe da proposta</span>
          <p>{message || "Este link já possui uma proposta enviada. A proposta fica disponível apenas para consulta."}</p>
        </div>
        <div className="supplier-submitted-actions">
          <button className="button secondary" type="button" onClick={() => window.print()}>Imprimir / salvar PDF</button>
          {canRequestNewLink && (
            <button className="button" type="button" onClick={requestNewLink} disabled={requestingLink}>
              {requestingLink ? "Solicitando..." : "Solicitar novo link"}
            </button>
          )}
        </div>
        {requestMessage && <div className="settings-inline-message">{requestMessage}</div>}
      </div>

      <section className="card supplier-portal-card supplier-print-section">
        <div className="supplier-card-head">
          <span>Fornecedor</span>
          <h2>{response.supplierName}</h2>
        </div>
        <div className="supplier-review-grid">
          <span><strong>CPF/CNPJ</strong>{formatDocument(response.document)}</span>
          <span><strong>E-mail</strong>{response.email || "Não informado"}</span>
          <span><strong>Telefone</strong>{response.phone || "Não informado"}</span>
          <span><strong>Enviado em</strong>{new Date(response.createdAt).toLocaleString("pt-BR")}</span>
        </div>
      </section>

      <section className="card supplier-portal-card supplier-print-section">
        <div className="supplier-card-head">
          <span>Condições</span>
          <h2>Pagamento, frete e entrega</h2>
        </div>
        <div className="supplier-review-grid">
          {terms.offersCash && <span><strong>À vista</strong>{cashSummaryText(String(terms.cashDiscountPercentage))}</span>}
          {terms.offersTerm && <span><strong>A prazo</strong>{termSummaryText(terms.installments.map((item) => ({ days: String(item.days), percentage: String(item.percentage) })))}</span>}
          <span><strong>Frete e entrega</strong>{freightSummaryText(terms.freightType, String(terms.freightPrice), terms.deliveryDays)}</span>
        </div>
        {terms.generalNotes && <p className="quotation-response-notes">{terms.generalNotes}</p>}
      </section>

      <section className="card supplier-portal-card supplier-print-section">
        <div className="supplier-card-head">
          <span>Itens</span>
          <h2>Itens da cotação</h2>
        </div>
        <div className="supplier-review-items">
          <div className="supplier-review-items-row supplier-review-items-head">
            <span>Insumo</span><span>Valor unit.</span><span>Qtd.</span><span>Prazo dif.</span><span>Total</span>
          </div>
          {items.map((original) => {
            const item = responseItemsByNumber.get(original.itemNumber);
            if (item?.attends !== true) {
              return (
                <div className="supplier-review-items-row not-quoted" key={original.itemNumber}>
                  <span>{original.name || `Item ${original.itemNumber}`}</span>
                  <span>Não cotado</span>
                  <span>0 de {original.quantity} {original.unit || ""}</span>
                  <span>-</span>
                  <strong>-</strong>
                </div>
              );
            }

            return (
              <div className={`supplier-review-items-row ${item.partial ? "partial" : ""}`} key={item.itemNumber}>
                <span>{original.name || `Item ${item.itemNumber}`}</span>
                <span>{formatCurrency(Number(item.unitPrice || 0))}</span>
                <span>{item.quantity || 0} {original.unit || ""}{item.partial ? " (parcial)" : ""}</span>
                <span>{item.deadlineDays ? `${item.deadlineDays}d` : "-"}</span>
                <strong>{formatCurrency(itemTotal({
                  itemNumber: item.itemNumber,
                  attends: item.attends,
                  partial: item.partial === true,
                  unitPrice: String(item.unitPrice || 0),
                  quantity: String(item.quantity || 0),
                  deadlineDays: String(item.deadlineDays || ""),
                  notes: item.notes || ""
                }))}</strong>
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
}
