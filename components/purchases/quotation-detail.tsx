"use client";

import { useMemo, useState } from "react";
import { SiengeSupplierPicker } from "@/components/suppliers/sienge-supplier-picker";
import type { QuotationSummary } from "@/features/quotations/data";
import { formatCurrency, formatOptionalDate } from "@/lib/formatters";
import type { SupplierQuoteAwardSummary, SupplierQuoteEventSummary, SupplierQuoteInvitationSummary, SupplierQuoteResponseSummary, SupplierRegistrationReview } from "@/lib/supplier-quote-portal";

type DetailTab = "resumo" | "sienge" | "insumos" | "fornecedores" | "links" | "respostas" | "mapa" | "aprovacao" | "cadastros" | "historico";
type SiengeAction = "create" | "attach-items" | "add-supplier";
type ApprovalMode = "quotation" | "item";
type GeneratedSupplierLink = {
  url: string;
  supplierName?: string;
  document?: string;
  expiresAt?: string;
};

const tabs: Array<{ key: DetailTab; label: string }> = [
  { key: "resumo", label: "Resumo" },
  { key: "sienge", label: "Sienge" },
  { key: "insumos", label: "Insumos" },
  { key: "fornecedores", label: "Fornecedores" },
  { key: "links", label: "Links" },
  { key: "respostas", label: "Respostas" },
  { key: "mapa", label: "Mapa" },
  { key: "aprovacao", label: "Aprovar" },
  { key: "cadastros", label: "Cadastros" },
  { key: "historico", label: "Histórico" }
];

function csvCell(value: string | number) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function exportComparison(quotation: QuotationSummary) {
  const rows = [
    ["Cotação", "Fornecedor", "Total", "Desconto", "Frete", "Selecionado", "Última resposta"],
    ...quotation.suppliers.map((supplier) => [
      quotation.code,
      supplier.supplierName,
      supplier.totalValue,
      supplier.discount,
      supplier.freight,
      supplier.selected ? "Sim" : "Não",
      supplier.lastResponse || ""
    ])
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cotacao-${quotation.code}-mapa.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function suggestedNextAction(quotation: QuotationSummary) {
  if (!quotation.items.length) return "Vincular insumos da solicitação";
  if (!quotation.suppliers.length) return "Adicionar fornecedores";
  if (!quotation.responseCount) return "Aguardar propostas";
  if (!quotation.selectedSupplier) return "Escolher fornecedor vencedor";
  return "Acompanhar pedido de compra";
}

function numberOrUndefined(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function formatDocument(value: string) {
  const clean = value.replace(/\D/g, "");
  if (clean.length === 11) return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (clean.length === 14) return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return value || "Sem documento";
}

function registrationText(registration: Record<string, unknown> | undefined, field: string) {
  const value = registration?.[field];
  return typeof value === "string" ? value.trim() : "";
}

function eventTypeLabel(type: SupplierQuoteEventSummary["type"]) {
  const labels: Record<SupplierQuoteEventSummary["type"], string> = {
    link_sent: "Link enviado",
    response_received: "Resposta recebida",
    supplier_approved: "Fornecedor aprovado",
    integration_error: "Erro de integração",
    sienge_created: "Criação no Sienge"
  };
  return labels[type];
}

function eventTypeClass(type: SupplierQuoteEventSummary["type"]) {
  if (type === "integration_error") return "late";
  if (type === "link_sent") return "warn";
  return "";
}

function exportSupplierResponses(quotation: QuotationSummary, responses: SupplierQuoteResponseSummary[]) {
  const rows = [
    ["Cotação", "Resposta", "Fornecedor", "Documento", "Cadastro pendente", "Item", "Atende", "Quantidade", "Valor unitário", "Total item", "Prazo dias", "Observação"],
    ...responses.flatMap((response) => response.items.map((item) => {
      const quotationItem = quotation.items.find((current) => current.itemNumber === item.itemNumber);
      const total = item.attends ? (item.unitPrice || 0) * (item.quantity || 0) : 0;
      return [
        quotation.code,
        response.id,
        response.supplierName,
        response.document,
        response.registrationPending ? "Sim" : "Não",
        quotationItem?.name || `Item ${item.itemNumber}`,
        item.attends ? "Sim" : "Não",
        item.quantity || 0,
        item.unitPrice || 0,
        total,
        item.deadlineDays || 0,
        item.notes || ""
      ];
    }))
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cotacao-${quotation.code}-respostas-fornecedores.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportItemComparison(quotation: QuotationSummary, responses: SupplierQuoteResponseSummary[]) {
  const bestByItem = new Map<number, { responseId: number; unitPrice: number }>();

  responses.forEach((response) => {
    response.items.forEach((item) => {
      if (!item.attends || item.unitPrice == null) return;
      const current = bestByItem.get(item.itemNumber);
      if (!current || item.unitPrice < current.unitPrice) {
        bestByItem.set(item.itemNumber, { responseId: response.id, unitPrice: item.unitPrice });
      }
    });
  });

  const rows = [
    ["Cotação", "Item", "Fornecedor", "Documento", "Atende", "Qtd. solicitada", "Qtd. atendida", "Unidade", "Valor unitário", "Total item", "Prazo dias", "Observação", "Melhor preço"],
    ...responses.flatMap((response) => response.items.map((item) => {
      const quotationItem = quotation.items.find((current) => current.itemNumber === item.itemNumber);
      const total = item.attends ? (item.unitPrice || 0) * (item.quantity || 0) : 0;
      const best = bestByItem.get(item.itemNumber);
      return [
        quotation.code,
        quotationItem?.name || `Item ${item.itemNumber}`,
        response.supplierName,
        response.document,
        item.attends ? "Sim" : "Não",
        quotationItem?.quantity || 0,
        item.quantity || 0,
        quotationItem?.unit || "",
        item.unitPrice || 0,
        total,
        item.deadlineDays || 0,
        item.notes || "",
        best?.responseId === response.id ? "Sim" : "Não"
      ];
    }))
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `cotacao-${quotation.code}-mapa-item-a-item.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function QuotationDetail({
  quotation,
  supplierResponses = [],
  supplierAwards = [],
  supplierInvitations = [],
  supplierEvents = [],
  supplierReviews = {}
}: {
  quotation: QuotationSummary;
  supplierResponses?: SupplierQuoteResponseSummary[];
  supplierAwards?: SupplierQuoteAwardSummary[];
  supplierInvitations?: SupplierQuoteInvitationSummary[];
  supplierEvents?: SupplierQuoteEventSummary[];
  supplierReviews?: Record<string, SupplierRegistrationReview>;
}) {
  const [tab, setTab] = useState<DetailTab>("resumo");
  const [buyerId, setBuyerId] = useState(quotation.buyerId === "Não informado" ? "" : quotation.buyerId);
  const [quotationDate, setQuotationDate] = useState((quotation.date || new Date().toISOString()).slice(0, 10));
  const [purchaseRequestId, setPurchaseRequestId] = useState("");
  const [purchaseRequestItemNumber, setPurchaseRequestItemNumber] = useState(String(quotation.items[0]?.itemNumber || ""));
  const [deliveryRequirementNumber, setDeliveryRequirementNumber] = useState("1");
  const [supplierId, setSupplierId] = useState("");
  const [supplierDocument, setSupplierDocument] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [operationResult, setOperationResult] = useState("");
  const [operationTitle, setOperationTitle] = useState("Retorno da integração");
  const [generatedSupplierLink, setGeneratedSupplierLink] = useState<GeneratedSupplierLink>();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [awards, setAwards] = useState(supplierAwards);
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>("quotation");
  const [approvalResponseId, setApprovalResponseId] = useState(() => String(supplierAwards.find((award) => award.scope === "quotation")?.responseId || supplierResponses[0]?.id || ""));
  const [approvalJustification, setApprovalJustification] = useState(() => supplierAwards.find((award) => award.scope === "quotation")?.justification || "");
  const [itemAwardSelections, setItemAwardSelections] = useState<Record<number, string>>(() => {
    const entries = supplierAwards
      .filter((award) => award.scope === "item" && award.itemNumber)
      .map((award) => [award.itemNumber as number, String(award.responseId)] as const);
    return Object.fromEntries(entries);
  });
  const [itemAwardJustifications, setItemAwardJustifications] = useState<Record<number, string>>(() => {
    const entries = supplierAwards
      .filter((award) => award.scope === "item" && award.itemNumber)
      .map((award) => [award.itemNumber as number, award.justification] as const);
    return Object.fromEntries(entries);
  });
  const [approvalMessage, setApprovalMessage] = useState("");
  const [approvalSaving, setApprovalSaving] = useState(false);
  const [registrationReviews, setRegistrationReviews] = useState(supplierReviews);
  const [pendingSupplierResult, setPendingSupplierResult] = useState("");
  const [pendingSupplierLoading, setPendingSupplierLoading] = useState<string | null>(null);
  const [invitations, setInvitations] = useState(supplierInvitations);
  const [events, setEvents] = useState(supplierEvents);
  const [linkMessage, setLinkMessage] = useState("");

  const bestSupplier = useMemo(() => {
    const valid = quotation.suppliers.filter((supplier) => supplier.totalValue > 0);
    return valid.sort((left, right) => left.totalValue - right.totalValue)[0];
  }, [quotation.suppliers]);

  const responseStats = useMemo(() => {
    const uniqueDocuments = new Set(supplierResponses.map((response) => response.document));
    return {
      totalValue: supplierResponses.reduce((sum, response) => sum + response.totalValue, 0),
      attendedItems: supplierResponses.reduce((sum, response) => sum + response.attendedCount, 0),
      pendingRegistrations: supplierResponses.filter((response) => response.registrationPending).length,
      suppliers: uniqueDocuments.size
    };
  }, [supplierResponses]);

  const itemComparison = useMemo(() => {
    const itemNumbers = new Set<number>();
    quotation.items.forEach((item) => itemNumbers.add(item.itemNumber));
    supplierResponses.forEach((response) => response.items.forEach((item) => itemNumbers.add(item.itemNumber)));

    return Array.from(itemNumbers).sort((left, right) => left - right).map((itemNumber) => {
      const quotationItem = quotation.items.find((item) => item.itemNumber === itemNumber);
      const offers = supplierResponses.map((response) => {
        const quotedItem = response.items.find((item) => item.itemNumber === itemNumber);
        const attends = Boolean(quotedItem?.attends);
        const hasPrice = attends && quotedItem?.unitPrice != null;
        const unitPrice = attends ? quotedItem?.unitPrice || 0 : 0;
        const quantity = attends ? quotedItem?.quantity || 0 : 0;
        const deadlineDays = attends ? quotedItem?.deadlineDays || 0 : 0;

        return {
          responseId: response.id,
          supplierName: response.supplierName,
          document: response.document,
          registrationPending: response.registrationPending,
          hasResponse: Boolean(quotedItem),
          attends,
          hasPrice,
          unitPrice,
          quantity,
          deadlineDays,
          total: unitPrice * quantity,
          notes: quotedItem?.notes || ""
        };
      });
      const best = offers
        .filter((offer) => offer.attends && offer.hasPrice)
        .sort((left, right) => left.unitPrice - right.unitPrice || left.deadlineDays - right.deadlineDays)[0];

      return { itemNumber, item: quotationItem, offers, best };
    });
  }, [quotation.items, supplierResponses]);

  const pendingSuppliers = useMemo(() => {
    const byDocument = new Map<string, SupplierQuoteResponseSummary>();
    supplierResponses
      .filter((response) => response.registrationPending)
      .forEach((response) => {
        const document = response.document.replace(/\D/g, "");
        const current = byDocument.get(document);
        if (!current || new Date(response.createdAt).getTime() > new Date(current.createdAt).getTime()) {
          byDocument.set(document, response);
        }
      });
    return Array.from(byDocument.values()).sort((left, right) => left.supplierName.localeCompare(right.supplierName));
  }, [supplierResponses]);

  const tabCounts: Partial<Record<DetailTab, number>> = {
    insumos: quotation.itemCount,
    fornecedores: quotation.supplierCount,
    links: invitations.length,
    respostas: supplierResponses.length,
    mapa: itemComparison.filter((row) => row.best).length,
    aprovacao: awards.length,
    cadastros: pendingSuppliers.length,
    historico: events.length
  };

  async function refreshEvents() {
    const response = await fetch(`/api/supplier-portal/events?quotationId=${quotation.id}`, { cache: "no-store" });
    if (!response.ok) return;
    const json = await response.json() as { events?: SupplierQuoteEventSummary[] };
    setEvents(json.events || []);
  }

  async function runSiengeAction(action: SiengeAction, confirm: boolean) {
    setLoadingAction(`${action}-${confirm ? "confirm" : "preview"}`);
    setOperationTitle(confirm ? "Retorno do Sienge" : "Payload preparado");
    setOperationResult("");
    setGeneratedSupplierLink(undefined);

    try {
      const payload = {
        action,
        confirm,
        dryRun: !confirm,
        buyerId: buyerId.trim(),
        date: quotationDate,
        purchaseQuotationId: quotation.id,
        purchaseQuotationItemNumber: Number(purchaseRequestItemNumber) || quotation.items[0]?.itemNumber,
        supplierId: numberOrUndefined(supplierId),
        request: purchaseRequestId.trim()
          ? {
              purchaseRequestId: Number(purchaseRequestId),
              items: [{
                purchaseRequestId: Number(purchaseRequestId),
                purchaseRequestItemNumber: Number(purchaseRequestItemNumber),
                deliveryRequirementNumber: Number(deliveryRequirementNumber)
              }]
            }
          : undefined
      };

      const response = await fetch("/api/sienge/purchase-quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await response.json();
      setOperationResult(JSON.stringify(json, null, 2));
      if (confirm) void refreshEvents();
    } finally {
      setLoadingAction(null);
    }
  }

  async function generateSupplierPortalLink(input?: { supplierId?: number; supplierName?: string; document?: string }) {
    setLoadingAction("supplier-link");
    setOperationTitle("Link do fornecedor");
    setOperationResult("");
    setGeneratedSupplierLink(undefined);
    setLinkMessage("");
    try {
      const response = await fetch("/api/supplier-portal/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quotationId: quotation.id,
          supplierId: input?.supplierId ?? numberOrUndefined(supplierId),
          supplierName: input?.supplierName ?? supplierName,
          document: input?.document ?? supplierDocument,
          expiresInDays: 7
        })
      });
      const json = await response.json() as { invitation?: SupplierQuoteInvitationSummary; url?: string; message?: string };
      if (!response.ok) throw new Error(json.message || "Não foi possível gerar o link.");
      if (json.invitation) setInvitations((current) => [json.invitation!, ...current]);
      const link = json.invitation
        ? {
            url: json.invitation.url,
            supplierName: json.invitation.supplierName,
            document: json.invitation.document,
            expiresAt: json.invitation.expiresAt
          }
        : json.url
          ? { url: json.url, supplierName: input?.supplierName ?? supplierName, document: input?.document ?? supplierDocument }
          : undefined;
      if (link) setGeneratedSupplierLink(link);
      setLinkMessage("Link gerado com sucesso.");
      void refreshEvents();
      return json;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado ao gerar link.";
      setLinkMessage(message);
      setOperationResult(JSON.stringify({ message }, null, 2));
      return undefined;
    } finally {
      setLoadingAction(null);
    }
  }

  async function copyInvitationLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setLinkMessage("Link copiado.");
    } catch {
      setLinkMessage("Não foi possível copiar automaticamente. Abra o detalhe do link e copie manualmente.");
    }
  }

  function setItemAward(itemNumber: number, responseId: string) {
    setItemAwardSelections((current) => ({ ...current, [itemNumber]: responseId }));
  }

  function setItemJustification(itemNumber: number, justification: string) {
    setItemAwardJustifications((current) => ({ ...current, [itemNumber]: justification }));
  }

  async function saveAwardDecision() {
    setApprovalSaving(true);
    setApprovalMessage("");
    try {
      const payloadAwards = approvalMode === "quotation"
        ? (() => {
            const response = supplierResponses.find((item) => String(item.id) === approvalResponseId);
            if (!response) return [];
            return [{
              quotationId: quotation.id,
              scope: "quotation" as const,
              responseId: response.id,
              supplierName: response.supplierName,
              document: response.document,
              justification: approvalJustification
            }];
          })()
        : itemComparison.flatMap((row) => {
            const selectedResponseId = itemAwardSelections[row.itemNumber] || String(row.best?.responseId || "");
            const response = supplierResponses.find((item) => String(item.id) === selectedResponseId);
            const justification = itemAwardJustifications[row.itemNumber] || approvalJustification;
            if (!response || !justification.trim()) return [];
            return [{
              quotationId: quotation.id,
              scope: "item" as const,
              itemNumber: row.itemNumber,
              responseId: response.id,
              supplierName: response.supplierName,
              document: response.document,
              justification
            }];
          });

      if (!payloadAwards.length) {
        setApprovalMessage("Selecione um fornecedor vencedor e informe uma justificativa.");
        return;
      }

      const response = await fetch("/api/supplier-portal/awards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quotationId: quotation.id,
          scope: approvalMode,
          awards: payloadAwards
        })
      });
      const json = await response.json() as { ok?: boolean; awards?: SupplierQuoteAwardSummary[]; message?: string };
      if (!response.ok) throw new Error(json.message || "Não foi possível salvar a aprovação.");
      setAwards(json.awards || []);
      setApprovalMessage("Aprovação salva com sucesso.");
      void refreshEvents();
    } catch (error) {
      setApprovalMessage(error instanceof Error ? error.message : "Erro inesperado ao salvar aprovação.");
    } finally {
      setApprovalSaving(false);
    }
  }

  async function updateRegistrationReview(document: string, status: SupplierRegistrationReview["status"], result: Record<string, unknown>) {
    const response = await fetch("/api/supplier-portal/pending-suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document, status, result })
    });
    const json = await response.json() as { review?: SupplierRegistrationReview; message?: string };
    if (!response.ok) throw new Error(json.message || "Não foi possível atualizar o status do cadastro.");
    if (json.review) {
      setRegistrationReviews((current) => ({ ...current, [json.review!.document]: json.review! }));
    }
  }

  async function submitPendingSupplier(response: SupplierQuoteResponseSummary, confirm: boolean) {
    const document = response.document.replace(/\D/g, "");
    const isCompany = document.length > 11;
    const payload = {
      name: response.supplierName,
      tradeName: registrationText(response.registration, "tradeName"),
      type: isCompany ? "JURIDICA" : "FISICA",
      cnpj: isCompany ? document : "",
      cpf: isCompany ? "" : document,
      email: response.email || "",
      phone: response.phone || "",
      quotationId: quotation.id,
      confirm
    };

    setPendingSupplierLoading(`${document}-${confirm ? "confirm" : "preview"}`);
    setPendingSupplierResult("");
    try {
      const siengeResponse = await fetch("/api/sienge/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await siengeResponse.json() as Record<string, unknown>;
      const status: SupplierRegistrationReview["status"] = siengeResponse.ok ? (confirm ? "created" : "prepared") : "failed";
      await updateRegistrationReview(document, status, json);
      setPendingSupplierResult(JSON.stringify(json, null, 2));
      if (confirm) void refreshEvents();
    } catch (error) {
      const result = { message: error instanceof Error ? error.message : "Erro inesperado ao processar fornecedor." };
      await updateRegistrationReview(document, "failed", result);
      setPendingSupplierResult(JSON.stringify(result, null, 2));
    } finally {
      setPendingSupplierLoading(null);
    }
  }

  return (
    <main className="quotation-detail-workspace">
      <section className="card quotation-detail-hero">
        <div>
          <span>Cotação</span>
          <h2>#{quotation.code}</h2>
          {quotation.notes && <p>{quotation.notes}</p>}
        </div>
        <div className="quotation-detail-hero-actions">
          <i className="badge">{quotation.status}</i>
          <button className="button secondary" type="button" onClick={() => supplierResponses.length ? exportItemComparison(quotation, supplierResponses) : exportComparison(quotation)}>
            Exportar mapa
          </button>
        </div>
        <div className="quotation-detail-hero-grid">
          <span><strong>{quotation.buyerId}</strong><small>Comprador</small></span>
          <span><strong>{formatOptionalDate(quotation.date)}</strong><small>Data</small></span>
          <span><strong>{formatOptionalDate(quotation.deadline)}</strong><small>Prazo</small></span>
          <span><strong>{formatCurrency(quotation.totalValue)}</strong><small>Total</small></span>
        </div>
      </section>

      <nav className="quotation-detail-tabs">
        {tabs.map((item) => (
          <button className={tab === item.key ? "active" : ""} key={item.key} type="button" onClick={() => setTab(item.key)}>
            {item.label}
            {tabCounts[item.key] !== undefined && <strong>{tabCounts[item.key]}</strong>}
          </button>
        ))}
      </nav>

      {tab === "resumo" && (
        <>
          <section className="quotation-detail-stats">
            <div className="card"><strong>{quotation.itemCount}</strong><span>Insumos</span></div>
            <div className="card"><strong>{quotation.supplierCount}</strong><span>Fornecedores</span></div>
            <div className="card"><strong>{quotation.responseCount}</strong><span>Propostas</span></div>
            <div className="card"><strong>{formatCurrency(quotation.totalValue)}</strong><span>Total recebido</span></div>
          </section>

          <section className="grid-main">
            <div className="card panel">
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">Melhor proposta</h2>
                </div>
              </div>
              {bestSupplier ? (
                <div className="quotation-best-supplier">
                  <strong>{bestSupplier.supplierName}</strong>
                  <span>{formatCurrency(bestSupplier.totalValue)}</span>
                  <small>{bestSupplier.selected ? "Fornecedor selecionado" : "Ainda não selecionado"}</small>
                </div>
              ) : (
                <div className="empty-state">Ainda não há proposta com valor para decisão.</div>
              )}
            </div>
            <div className="card panel">
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">Operação</h2>
                </div>
              </div>
              <div className="quotation-next-actions">
                <span><strong>Status</strong>{quotation.status}</span>
                <span><strong>Ação</strong>{suggestedNextAction(quotation)}</span>
                <span><strong>Sienge</strong>{quotation.integratedAt ? formatOptionalDate(quotation.integratedAt) : "Pendente"}</span>
                <span><strong>Mapa</strong>{supplierResponses.length ? "Pronto" : "Aguardando"}</span>
              </div>
            </div>
          </section>
        </>
      )}

      {tab === "sienge" && (
        <section className="quotation-operation-layout">
          <div className="card panel quotation-operation-main">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Operação Sienge</h2>
                <span className="panel-note">Criação, vínculo de insumos e inclusão de fornecedores</span>
              </div>
              <i className="badge">ID {quotation.id}</i>
            </div>

            <div className="quotation-operation-grid">
              <label>
                <span>Comprador Sienge</span>
                <input value={buyerId} onChange={(event) => setBuyerId(event.target.value)} placeholder="Ex.: comprador01" />
              </label>
              <label>
                <span>Data da cotação</span>
                <input type="date" value={quotationDate} onChange={(event) => setQuotationDate(event.target.value)} />
              </label>
              <label>
                <span>Solicitação de compra</span>
                <input value={purchaseRequestId} onChange={(event) => setPurchaseRequestId(event.target.value.replace(/\D/g, ""))} placeholder="ID da solicitação" />
              </label>
              <label>
                <span>Item da solicitação</span>
                <input value={purchaseRequestItemNumber} onChange={(event) => setPurchaseRequestItemNumber(event.target.value.replace(/\D/g, ""))} placeholder="Item" />
              </label>
              <label>
                <span>Entrega</span>
                <input value={deliveryRequirementNumber} onChange={(event) => setDeliveryRequirementNumber(event.target.value.replace(/\D/g, ""))} placeholder="1" />
              </label>
              <SiengeSupplierPicker
                value={supplierId}
                onChange={(next, supplier) => {
                  setSupplierId(next);
                  setSupplierDocument(supplier?.document || "");
                  setSupplierName(supplier?.name || "");
                }}
                compact
              />
            </div>

            <div className="quotation-operation-actions">
              <button className="button secondary" type="button" onClick={() => runSiengeAction("create", false)} disabled={!buyerId.trim() || loadingAction !== null}>
                Preparar criação
              </button>
              <button className="button" type="button" onClick={() => runSiengeAction("create", true)} disabled={!buyerId.trim() || loadingAction !== null}>
                {loadingAction === "create-confirm" ? "Gravando..." : "Criar cotação"}
              </button>
              <button className="button secondary" type="button" onClick={() => runSiengeAction("attach-items", false)} disabled={!purchaseRequestId || !purchaseRequestItemNumber || loadingAction !== null}>
                Preparar item
              </button>
              <button className="button" type="button" onClick={() => runSiengeAction("attach-items", true)} disabled={!purchaseRequestId || !purchaseRequestItemNumber || loadingAction !== null}>
                {loadingAction === "attach-items-confirm" ? "Vinculando..." : "Vincular item"}
              </button>
              <button className="button secondary" type="button" onClick={() => runSiengeAction("add-supplier", false)} disabled={!supplierId || !purchaseRequestItemNumber || loadingAction !== null}>
                Preparar fornecedor
              </button>
              <button className="button" type="button" onClick={() => runSiengeAction("add-supplier", true)} disabled={!supplierId || !purchaseRequestItemNumber || loadingAction !== null}>
                {loadingAction === "add-supplier-confirm" ? "Incluindo..." : "Incluir fornecedor"}
              </button>
              <button className="button secondary" type="button" onClick={() => generateSupplierPortalLink()} disabled={loadingAction !== null}>
                {loadingAction === "supplier-link" ? "Gerando..." : "Gerar link fornecedor"}
              </button>
            </div>
          </div>

          <aside className="card panel quotation-operation-side">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Contrato da API</h2>
                <span className="panel-note">Endpoints usados por esta tela</span>
              </div>
            </div>
            <div className="quotation-endpoint-list">
              <span><strong>POST</strong>/v1/purchase-quotations</span>
              <span><strong>POST</strong>/v1/purchase-quotations/{quotation.id}/items/from-purchase-request</span>
              <span><strong>POST</strong>/v1/purchase-quotations/{quotation.id}/items/{purchaseRequestItemNumber || "item"}/suppliers</span>
              <span><strong>LINK</strong>/portal-cotacao/[token]</span>
            </div>
            <div className="advanced-search-hint warn">
              O fornecedor entra no Sienge por item da cotacao. Para proposta com valores e prazo, use o link protegido e valide antes de gravar negociacoes.
            </div>
          </aside>

          {operationResult && (
            <div className="card panel quotation-operation-result">
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">{operationTitle}</h2>
                  <span className="panel-note">Resposta da rota de integração</span>
                </div>
              </div>
              <pre className="quotation-payload-preview">{operationResult}</pre>
            </div>
          )}
          {generatedSupplierLink && (
            <div className="card panel quotation-operation-result quotation-link-result">
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">Link do fornecedor</h2>
                </div>
                <i className="badge">Pronto</i>
              </div>
              <div className="quotation-copy-link">
                <input readOnly value={generatedSupplierLink.url} onFocus={(event) => event.currentTarget.select()} />
                <button className="button" type="button" onClick={() => copyInvitationLink(generatedSupplierLink.url)}>
                  Copiar link
                </button>
                <a className="button secondary" href={generatedSupplierLink.url} target="_blank" rel="noreferrer">
                  Abrir
                </a>
              </div>
              <div className="quotation-link-meta">
                <span><strong>Fornecedor</strong>{generatedSupplierLink.supplierName || "Não informado"}</span>
                <span><strong>Documento</strong>{generatedSupplierLink.document ? formatDocument(generatedSupplierLink.document) : "Não informado"}</span>
                <span><strong>Validade</strong>{generatedSupplierLink.expiresAt ? formatOptionalDate(generatedSupplierLink.expiresAt) : "7 dias"}</span>
                <span><strong>Status</strong>Copiável</span>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "insumos" && (
        <section className="card table-card quotation-detail-table">
          <table>
            <thead>
              <tr>
                <th>Insumo</th>
                <th>Detalhe</th>
                <th>Quantidade</th>
                <th>Unidade</th>
                <th>Observação</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {quotation.items.map((item) => (
                <tr key={item.itemNumber}>
                  <td><strong>{item.name}</strong><br /><span className="table-muted">#{item.productId || item.itemNumber}</span></td>
                  <td>{item.detail || "Sem detalhe"}</td>
                  <td>{item.quantity}</td>
                  <td>{item.unit}</td>
                  <td>{item.notes || "Sem observação"}</td>
                  <td>
                    <button className="payable-review-button compact" type="button" onClick={() => { setTab("sienge"); setPurchaseRequestItemNumber(String(item.itemNumber)); }}>
                      Usar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!quotation.items.length && <div className="empty-state">Nenhum insumo retornado para esta cotação.</div>}
        </section>
      )}

      {tab === "fornecedores" && (
        <section className="quotation-supplier-grid">
          <article className="card quotation-supplier-card quotation-add-supplier-card">
            <div>
              <span>Novo fornecedor</span>
              <h2>Enviar link de cotação</h2>
            </div>
            <SiengeSupplierPicker
              value={supplierId}
              onChange={(next, supplier) => {
                setSupplierId(next);
                setSupplierDocument(supplier?.document || "");
                setSupplierName(supplier?.name || "");
              }}
              compact
            />
            <button className="button" type="button" onClick={() => { setTab("sienge"); void generateSupplierPortalLink(); }} disabled={loadingAction !== null}>
              Gerar link
            </button>
          </article>
          {quotation.suppliers.map((supplier) => (
            <article className="card quotation-supplier-card" key={supplier.supplierId}>
              <div>
                <span>Fornecedor</span>
                <h2>{supplier.supplierName}</h2>
              </div>
              <strong>{formatCurrency(supplier.totalValue)}</strong>
              <div className="quotation-supplier-meta">
                <span>{supplier.negotiationCount} negociação(ões)</span>
                <span>{supplier.discount ? `${formatCurrency(supplier.discount)} desconto` : "Sem desconto"}</span>
                <span>{supplier.freight ? `${formatCurrency(supplier.freight)} frete` : "Sem frete"}</span>
              </div>
              {supplier.selected && <i className="badge">Selecionado</i>}
            </article>
          ))}
        </section>
      )}

      {tab === "links" && (
        <section className="quotation-links">
          <div className="quotation-detail-stats">
            <div className="card"><strong>{invitations.length}</strong><span>Links gerados</span></div>
            <div className="card"><strong>{invitations.filter((item) => item.status === "answered").length}</strong><span>Respondidos</span></div>
            <div className="card"><strong>{invitations.filter((item) => item.status === "pending").length}</strong><span>Aguardando</span></div>
            <div className="card"><strong>{invitations.filter((item) => item.status === "expired").length}</strong><span>Vencidos</span></div>
          </div>

          <section className="card quotation-comparison">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Gestão de links</h2>
                <span className="panel-note">Validade, fornecedor, status de resposta e ações rápidas</span>
              </div>
              <button className="button secondary" type="button" onClick={() => { setTab("fornecedores"); }}>
                Novo link
              </button>
            </div>

            {linkMessage && <div className="settings-inline-message">{linkMessage}</div>}

            {invitations.length ? (
              <div className="quotation-link-list">
                {invitations.map((invitation) => (
                  <article className="quotation-link-card" key={invitation.id}>
                    <div className="quotation-link-head">
                      <div>
                        <span>Link #{invitation.id}</span>
                        <h3>{invitation.supplierName || (invitation.document ? formatDocument(invitation.document) : "Fornecedor não informado")}</h3>
                        <small>Criado em {formatOptionalDate(invitation.createdAt)} - válido até {formatOptionalDate(invitation.expiresAt)}</small>
                      </div>
                      <i className={`badge ${invitation.status === "expired" ? "late" : invitation.status === "pending" ? "warn" : ""}`}>
                        {invitation.status === "answered" ? "Respondido" : invitation.status === "expired" ? "Vencido" : "Aguardando"}
                      </i>
                    </div>

                    <div className="quotation-link-meta">
                      <span><strong>Fornecedor</strong>{invitation.supplierName || "Não informado"}</span>
                      <span><strong>Documento</strong>{invitation.document ? formatDocument(invitation.document) : "Não informado"}</span>
                      <span><strong>Respostas</strong>{invitation.responseCount}</span>
                      <span><strong>Última resposta</strong>{invitation.lastResponseAt ? formatOptionalDate(invitation.lastResponseAt) : "Sem resposta"}</span>
                    </div>

                    <div className="quotation-link-url">
                      <span>{invitation.url}</span>
                    </div>

                    <div className="quotation-link-actions">
                      <button className="button secondary" type="button" onClick={() => copyInvitationLink(invitation.url)}>
                        Copiar
                      </button>
                      <button
                        className="button"
                        type="button"
                        disabled={loadingAction !== null}
                        onClick={() => generateSupplierPortalLink({
                          supplierId: invitation.supplierId,
                          supplierName: invitation.supplierName,
                          document: invitation.document
                        })}
                      >
                        {loadingAction === "supplier-link" ? "Gerando..." : "Regerar"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">Nenhum link foi gerado para esta cotação ainda.</div>
            )}
          </section>
        </section>
      )}

      {tab === "respostas" && (
        <section className="quotation-responses">
          <div className="quotation-detail-stats">
            <div className="card"><strong>{supplierResponses.length}</strong><span>Respostas recebidas</span></div>
            <div className="card"><strong>{responseStats.suppliers}</strong><span>Fornecedores únicos</span></div>
            <div className="card"><strong>{responseStats.attendedItems}</strong><span>Itens atendidos</span></div>
            <div className="card"><strong>{formatCurrency(responseStats.totalValue)}</strong><span>Total informado</span></div>
          </div>

          <section className="card quotation-comparison">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Respostas dos fornecedores</h2>
                <span className="panel-note">Propostas recebidas pelo link protegido desta cotação</span>
              </div>
              <button className="button secondary" type="button" onClick={() => exportSupplierResponses(quotation, supplierResponses)} disabled={!supplierResponses.length}>
                Exportar respostas
              </button>
            </div>

            {supplierResponses.length ? (
              <div className="quotation-response-list">
                {supplierResponses.map((response) => (
                  <article className="quotation-response-card" key={response.id}>
                    <div className="quotation-response-head">
                      <div>
                        <span>Resposta #{response.id}</span>
                        <h3>{response.supplierName}</h3>
                        <small>{formatDocument(response.document)} - {formatOptionalDate(response.createdAt)}</small>
                      </div>
                      <div>
                        <strong>{formatCurrency(response.totalValue)}</strong>
                        <i className={`badge ${response.registrationPending ? "warn" : ""}`}>
                          {response.registrationPending ? "Cadastro pendente" : "Cadastro local"}
                        </i>
                      </div>
                    </div>

                    <div className="quotation-response-contact">
                      <span><strong>E-mail</strong>{response.email || "Não informado"}</span>
                      <span><strong>Telefone</strong>{response.phone || "Não informado"}</span>
                      <span><strong>Itens atendidos</strong>{response.attendedCount} de {response.items.length}</span>
                    </div>

                    <div className="quotation-response-items">
                      <table>
                        <thead>
                          <tr>
                            <th>Insumo</th>
                            <th>Status</th>
                            <th>Qtd.</th>
                            <th>Valor unit.</th>
                            <th>Total</th>
                            <th>Prazo</th>
                            <th>Observação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {response.items.map((item) => {
                            const quotationItem = quotation.items.find((current) => current.itemNumber === item.itemNumber);
                            const total = item.attends ? (item.unitPrice || 0) * (item.quantity || 0) : 0;
                            return (
                              <tr key={`${response.id}-${item.itemNumber}`}>
                                <td><strong>{quotationItem?.name || `Item ${item.itemNumber}`}</strong><br /><span className="table-muted">#{item.itemNumber}</span></td>
                                <td><i className={`badge ${item.attends ? "" : "muted"}`}>{item.attends ? "Atende" : "Não atende"}</i></td>
                                <td>{item.attends ? item.quantity || 0 : "-"}</td>
                                <td>{item.attends ? formatCurrency(item.unitPrice || 0) : "-"}</td>
                                <td>{item.attends ? formatCurrency(total) : "-"}</td>
                                <td>{item.attends && item.deadlineDays ? `${item.deadlineDays} dia(s)` : "-"}</td>
                                <td>{item.notes || "Sem observação"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">Nenhuma resposta recebida pelo link desta cotação ainda.</div>
            )}

            {responseStats.pendingRegistrations > 0 && (
              <div className="advanced-search-hint warn">
                {responseStats.pendingRegistrations} fornecedor(es) responderam sem cadastro local confirmado. Valide o cadastro antes de integrar qualquer decisão ao Sienge.
              </div>
            )}
          </section>
        </section>
      )}

      {tab === "mapa" && (
        <section className="quotation-map-layout">
          <div className="card quotation-comparison quotation-item-map">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Mapa item a item</h2>
                <span className="panel-note">Preço, prazo, quantidade atendida e observação por insumo</span>
              </div>
              <button className="button secondary" type="button" onClick={() => exportItemComparison(quotation, supplierResponses)} disabled={!supplierResponses.length}>
                Exportar CSV
              </button>
            </div>

            {supplierResponses.length ? (
              <div className="quotation-item-comparison-list">
                {itemComparison.map((row) => (
                  <article className="quotation-item-comparison-card" key={row.itemNumber}>
                    <div className="quotation-item-comparison-head">
                      <div>
                        <span>Insumo #{row.item?.productId || row.itemNumber}</span>
                        <h3>{row.item?.name || `Item ${row.itemNumber}`}</h3>
                        <small>{row.item?.quantity || 0} {row.item?.unit || "un"} solicitados - {row.item?.detail || "Sem detalhe"}</small>
                      </div>
                      {row.best ? (
                        <div>
                          <strong>{formatCurrency(row.best.unitPrice)}</strong>
                          <small>{row.best.supplierName}</small>
                        </div>
                      ) : (
                        <i className="badge muted">Sem preço</i>
                      )}
                    </div>

                    <div className="quotation-item-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Fornecedor</th>
                            <th>Status</th>
                            <th>Preço unit.</th>
                            <th>Qtd. atendida</th>
                            <th>Total</th>
                            <th>Prazo</th>
                            <th>Observação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.offers.map((offer) => {
                            const isBest = row.best?.responseId === offer.responseId;
                            return (
                              <tr className={isBest ? "best-row" : ""} key={`${row.itemNumber}-${offer.responseId}`}>
                                <td>
                                  <strong>{offer.supplierName}</strong><br />
                                  <span className="table-muted">{formatDocument(offer.document)}</span>
                                </td>
                                <td>
                                  <i className={`badge ${offer.attends ? "" : "muted"}`}>
                                    {offer.attends ? isBest ? "Melhor preço" : "Atende" : offer.hasResponse ? "Não atende" : "Sem resposta"}
                                  </i>
                                </td>
                                <td>{offer.attends ? formatCurrency(offer.unitPrice) : "-"}</td>
                                <td>{offer.attends ? offer.quantity : "-"}</td>
                                <td>{offer.attends ? formatCurrency(offer.total) : "-"}</td>
                                <td>{offer.attends && offer.deadlineDays ? `${offer.deadlineDays} dia(s)` : "-"}</td>
                                <td>{offer.notes || "Sem observação"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">Nenhuma resposta itemizada recebida pelo link. Gere links para fornecedores e acompanhe as propostas na aba Respostas.</div>
            )}
          </div>

          <aside className="card quotation-best-price-panel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Melhores preços</h2>
                <span className="panel-note">Menor valor unitário por insumo</span>
              </div>
            </div>
            <div className="quotation-best-price-list">
              {itemComparison.filter((row) => row.best).map((row) => (
                <article key={row.itemNumber}>
                  <span>{row.item?.name || `Item ${row.itemNumber}`}</span>
                  <strong>{formatCurrency(row.best?.unitPrice || 0)}</strong>
                  <small>{row.best?.supplierName} - qtd. {row.best?.quantity || 0} - {row.best?.deadlineDays || 0} dia(s)</small>
                  {row.best?.notes && <p>{row.best.notes}</p>}
                </article>
              ))}
            </div>
            {!itemComparison.some((row) => row.best) && (
              <div className="empty-state">Ainda não há preços válidos para destacar.</div>
            )}
          </aside>
        </section>
      )}

      {tab === "aprovacao" && (
        <section className="quotation-approval-layout">
          <div className="card panel quotation-approval-main">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Aprovação do vencedor</h2>
                <span className="panel-note">Escolha por cotação inteira ou por item, sempre com justificativa</span>
              </div>
              <i className="badge">{approvalMode === "quotation" ? "Cotação inteira" : "Por item"}</i>
            </div>

            <div className="quotation-approval-mode">
              <button className={approvalMode === "quotation" ? "active" : ""} type="button" onClick={() => setApprovalMode("quotation")}>
                Cotação inteira
              </button>
              <button className={approvalMode === "item" ? "active" : ""} type="button" onClick={() => setApprovalMode("item")}>
                Por item
              </button>
            </div>

            {approvalMode === "quotation" ? (
              <div className="quotation-approval-form">
                <label>
                  <span>Fornecedor vencedor</span>
                  <select className="field" value={approvalResponseId} onChange={(event) => setApprovalResponseId(event.target.value)}>
                    <option value="">Selecione</option>
                    {supplierResponses.map((response) => (
                      <option value={response.id} key={response.id}>
                        {response.supplierName} - {formatCurrency(response.totalValue)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Justificativa</span>
                  <textarea className="field" value={approvalJustification} onChange={(event) => setApprovalJustification(event.target.value)} placeholder="Ex.: menor preço global, atende prazo e quantidade total." />
                </label>
              </div>
            ) : (
              <div className="quotation-approval-items">
                {itemComparison.map((row) => (
                  <article key={row.itemNumber}>
                    <div>
                      <span>Insumo #{row.item?.productId || row.itemNumber}</span>
                      <strong>{row.item?.name || `Item ${row.itemNumber}`}</strong>
                      <small>{row.item?.quantity || 0} {row.item?.unit || "un"} solicitados</small>
                    </div>
                    <select className="field" value={itemAwardSelections[row.itemNumber] || String(row.best?.responseId || "")} onChange={(event) => setItemAward(row.itemNumber, event.target.value)}>
                      <option value="">Selecione</option>
                      {row.offers.filter((offer) => offer.attends).map((offer) => (
                        <option value={offer.responseId} key={offer.responseId}>
                          {offer.supplierName} - {formatCurrency(offer.unitPrice)} - qtd. {offer.quantity}
                        </option>
                      ))}
                    </select>
                    <textarea
                      className="field"
                      value={itemAwardJustifications[row.itemNumber] || ""}
                      onChange={(event) => setItemJustification(row.itemNumber, event.target.value)}
                      placeholder={row.best ? `Sugestão: melhor preço com ${row.best.supplierName}.` : "Justifique a escolha deste item."}
                    />
                  </article>
                ))}
              </div>
            )}

            {approvalMode === "item" && (
              <label className="quotation-approval-common">
                <span>Justificativa padrão para itens sem texto próprio</span>
                <textarea className="field" value={approvalJustification} onChange={(event) => setApprovalJustification(event.target.value)} placeholder="Ex.: menor preço por item, respeitando quantidade atendida e prazo." />
              </label>
            )}

            {approvalMessage && <div className="settings-inline-message">{approvalMessage}</div>}
            <div className="quotation-operation-actions">
              <button className="button" type="button" disabled={approvalSaving || !supplierResponses.length} onClick={saveAwardDecision}>
                {approvalSaving ? "Salvando..." : "Salvar aprovação"}
              </button>
              {!supplierResponses.length && <span className="table-muted">Receba respostas de fornecedores antes de aprovar.</span>}
            </div>
          </div>

          <aside className="card panel quotation-approval-side">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Decisão salva</h2>
                <span className="panel-note">Registro local da aprovação</span>
              </div>
            </div>
            <div className="quotation-award-list">
              {awards.map((award) => (
                <article key={award.id}>
                  <span>{award.scope === "quotation" ? "Cotação inteira" : `Item ${award.itemNumber}`}</span>
                  <strong>{award.supplierName}</strong>
                  <small>{formatDocument(award.document)} - {formatOptionalDate(award.createdAt)}</small>
                  <p>{award.justification}</p>
                </article>
              ))}
            </div>
            {!awards.length && <div className="empty-state">Nenhuma aprovação salva para esta cotação.</div>}
            <div className="advanced-search-hint warn">
              Esta aprovação fica registrada na base local. A gravação da decisão dentro do Sienge ainda depende do endpoint validado para transformar a cotação em pedido/decisão.
            </div>
          </aside>
        </section>
      )}

      {tab === "cadastros" && (
        <section className="quotation-pending-suppliers">
          <div className="quotation-detail-stats">
            <div className="card"><strong>{pendingSuppliers.length}</strong><span>Cadastros pendentes</span></div>
            <div className="card"><strong>{pendingSuppliers.filter((response) => registrationReviews[response.document]?.status === "prepared").length}</strong><span>Preparados</span></div>
            <div className="card"><strong>{pendingSuppliers.filter((response) => registrationReviews[response.document]?.status === "created").length}</strong><span>Criados no Sienge</span></div>
            <div className="card"><strong>{pendingSuppliers.filter((response) => registrationReviews[response.document]?.status === "failed").length}</strong><span>Com erro</span></div>
          </div>

          <section className="card quotation-comparison">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Cadastro pendente de fornecedor</h2>
                <span className="panel-note">Revise CPF/CNPJ inexistente na base local e transforme em fornecedor no Sienge</span>
              </div>
              <i className="badge">/v1/creditors</i>
            </div>

            {pendingSuppliers.length ? (
              <div className="quotation-pending-list">
                {pendingSuppliers.map((response) => {
                  const document = response.document.replace(/\D/g, "");
                  const review = registrationReviews[document];
                  const status = review?.status || "pending";
                  const loadingPreview = pendingSupplierLoading === `${document}-preview`;
                  const loadingConfirm = pendingSupplierLoading === `${document}-confirm`;
                  return (
                    <article className="quotation-pending-card" key={document}>
                      <div className="quotation-pending-head">
                        <div>
                          <span>{formatDocument(document)}</span>
                          <h3>{response.supplierName}</h3>
                          <small>Resposta #{response.id} - recebida em {formatOptionalDate(response.createdAt)}</small>
                        </div>
                        <i className={`badge ${status === "created" ? "" : status === "failed" ? "late" : "warn"}`}>
                          {status === "created" ? "Criado" : status === "prepared" ? "Preparado" : status === "failed" ? "Erro" : "Pendente"}
                        </i>
                      </div>

                      <div className="quotation-pending-grid">
                        <span><strong>Tipo</strong>{document.length > 11 ? "Pessoa jurídica" : "Pessoa física"}</span>
                        <span><strong>Nome fantasia</strong>{registrationText(response.registration, "tradeName") || "Não informado"}</span>
                        <span><strong>E-mail</strong>{response.email || "Não informado"}</span>
                        <span><strong>Telefone</strong>{response.phone || "Não informado"}</span>
                        <span><strong>Cidade</strong>{registrationText(response.registration, "city") || "Não informado"}</span>
                        <span><strong>UF</strong>{registrationText(response.registration, "state") || "Não informado"}</span>
                      </div>

                      <div className="quotation-pending-actions">
                        <button className="button secondary" type="button" disabled={Boolean(pendingSupplierLoading)} onClick={() => submitPendingSupplier(response, false)}>
                          {loadingPreview ? "Preparando..." : "Preparar payload"}
                        </button>
                        <button className="button" type="button" disabled={Boolean(pendingSupplierLoading) || status === "created"} onClick={() => submitPendingSupplier(response, true)}>
                          {loadingConfirm ? "Criando..." : "Criar no Sienge"}
                        </button>
                      </div>

                      {review?.reviewedAt && (
                        <small className="quotation-pending-review">Última revisão: {formatOptionalDate(review.reviewedAt)}</small>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">Nenhum CPF/CNPJ pendente nesta cotação. Os fornecedores que responderam já existem na base local ou ainda não enviaram cadastro.</div>
            )}

            {pendingSupplierResult && (
              <pre className="quotation-payload-preview">{pendingSupplierResult}</pre>
            )}
          </section>
        </section>
      )}

      {tab === "historico" && (
        <section className="quotation-history-panel">
          <div className="quotation-detail-stats">
            <div className="card"><strong>{events.length}</strong><span>Eventos</span></div>
            <div className="card"><strong>{events.filter((event) => event.type === "link_sent").length}</strong><span>Links enviados</span></div>
            <div className="card"><strong>{events.filter((event) => event.type === "response_received").length}</strong><span>Respostas</span></div>
            <div className="card"><strong>{events.filter((event) => event.type === "integration_error").length}</strong><span>Erros</span></div>
          </div>

          <section className="card panel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Histórico da cotação</h2>
                <span className="panel-note">Eventos operacionais e integrações desta cotação</span>
              </div>
              <button className="button secondary" type="button" onClick={() => void refreshEvents()}>
                Atualizar
              </button>
            </div>

            {events.length ? (
              <div className="quotation-timeline">
                {events.map((event) => (
                  <article key={event.id}>
                    <div className="quotation-timeline-marker" />
                    <div className="quotation-timeline-body">
                      <div className="quotation-timeline-head">
                        <div>
                          <span>{formatOptionalDate(event.createdAt)}</span>
                          <h3>{event.title}</h3>
                        </div>
                        <i className={`badge ${eventTypeClass(event.type)}`}>{eventTypeLabel(event.type)}</i>
                      </div>
                      {event.description && <p>{event.description}</p>}
                      <div className="quotation-timeline-meta">
                        <span><strong>Fornecedor</strong>{event.supplierName || "Não informado"}</span>
                        <span><strong>Documento</strong>{event.document ? formatDocument(event.document) : "Não informado"}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">Nenhum evento operacional registrado para esta cotação ainda.</div>
            )}
          </section>
        </section>
      )}
    </main>
  );
}
