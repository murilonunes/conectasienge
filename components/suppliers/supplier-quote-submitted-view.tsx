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
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const terms = response.commercialTerms;
  const proposalAttachment = response.proposalAttachment;
  const attendedItems = response.items.filter((item) => item.attends);
  const responseItemsByNumber = new Map(response.items.map((item) => [item.itemNumber, item]));
  const quotedItems = items.flatMap((original) => {
    const item = responseItemsByNumber.get(original.itemNumber);
    return item?.attends === true ? [{ original, item }] : [];
  });
  const missingItems = items.filter((original) => responseItemsByNumber.get(original.itemNumber)?.attends !== true);

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
      const json = await result.json() as { message?: string; url?: string };
      if (!result.ok) throw new Error(json.message || "Não foi possível solicitar um novo link.");
      if (json.url) setNewLinkUrl(json.url);
      setRequestMessage(json.message || "Novo link gerado. Abra o link para enviar uma proposta revisada.");
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
          <p>{message || "Este link já possui uma proposta enviada. A proposta abaixo está disponível apenas para consulta."}</p>
        </div>
        <div className="supplier-submitted-actions">
          <button className="button secondary supplier-print-button" type="button" onClick={() => window.print()}>Imprimir ou salvar PDF</button>
          {canRequestNewLink && !newLinkUrl && (
            <button className="button supplier-new-link-button" type="button" onClick={requestNewLink} disabled={requestingLink}>
              {requestingLink ? "Gerando link de revisão..." : "Solicitar link para revisar"}
            </button>
          )}
        </div>
        {requestMessage && <div className="settings-inline-message">{requestMessage}</div>}
        {newLinkUrl && (
          <div className="quotation-copy-link supplier-new-link">
            <input readOnly value={newLinkUrl} onFocus={(event) => event.currentTarget.select()} />
            <button className="button secondary" type="button" onClick={() => void navigator.clipboard.writeText(newLinkUrl).then(() => setRequestMessage("Link copiado."), () => setRequestMessage("Não foi possível copiar automaticamente. Selecione o texto e copie manualmente."))}>
              Copiar link
            </button>
            <a className="button" href={newLinkUrl}>Abrir novo link</a>
          </div>
        )}
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
        <div className="supplier-review-grid supplier-print-summary-grid">
          {terms.offersCash && <span><strong>À vista</strong>{cashSummaryText(String(terms.cashDiscountPercentage), terms.cashDiscountMode, terms.cashDiscountValue)}</span>}
          {terms.offersTerm && <span><strong>A prazo</strong>{termSummaryText(terms.installments.map((item) => ({ days: String(item.days), percentage: String(item.percentage) })))}</span>}
          <span><strong>Frete e entrega</strong>{freightSummaryText(terms.freightType, String(terms.freightPrice), terms.deliveryDays)}</span>
          <span><strong>Valor total cotado</strong>{formatCurrency(response.totalValue)}</span>
        </div>
        {terms.generalNotes && <p className="quotation-response-notes">{terms.generalNotes}</p>}
      </section>

      {proposalAttachment && (
        <section className="card supplier-portal-card supplier-print-section supplier-attachment-print">
          <div className="supplier-card-head">
            <span>Anexo</span>
            <h2>Proposta do sistema do fornecedor</h2>
          </div>
          <div className="supplier-attachment-card">
            <div>
              <strong>{proposalAttachment.fileName}</strong>
              <span>{proposalAttachment.mimeType === "application/pdf" ? "PDF" : "Imagem"} - {Math.max(1, Math.round(proposalAttachment.sizeBytes / 1024))} KB</span>
            </div>
            <a className="button secondary" href={proposalAttachment.dataUrl} download={proposalAttachment.fileName}>Abrir anexo</a>
          </div>
        </section>
      )}

      <section className="card supplier-portal-card supplier-print-section">
        <div className="supplier-card-head">
          <span>Itens</span>
          <h2>Itens cotados</h2>
        </div>
        <div className="supplier-review-items">
          <div className="supplier-review-items-row supplier-review-items-head">
            <span>Insumo</span><span>Valor unitário</span><span>Quantidade</span><span>Prazo especial</span><span>Total</span>
          </div>
          {quotedItems.map(({ original, item }) => {
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

      {missingItems.length > 0 && (
        <section className="card supplier-portal-card supplier-print-section">
          <div className="supplier-card-head">
            <span>Fora da cotação</span>
            <h2>Itens não cotados pelo fornecedor</h2>
          </div>
          <div className="supplier-review-items">
            <div className="supplier-review-items-row supplier-review-items-head">
              <span>Insumo</span><span>Situação</span><span>Quantidade solicitada</span><span>Prazo especial</span><span>Total</span>
            </div>
            {missingItems.map((original) => (
              <div className="supplier-review-items-row not-quoted" key={original.itemNumber}>
                <span>{original.name || `Item ${original.itemNumber}`}</span>
                <span>Não cotado</span>
                <span>{original.quantity} {original.unit || ""}</span>
                <span>-</span>
                <strong>-</strong>
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
