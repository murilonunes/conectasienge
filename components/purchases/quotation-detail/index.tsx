"use client";

import { useMemo, useState } from "react";
import type { QuotationSummary } from "@/features/quotations/data";
import { formatCurrency, formatOptionalDate } from "@/lib/formatters";
import type { SupplierQuoteAwardSummary, SupplierQuoteEventSummary, SupplierQuoteInvitationSummary, SupplierQuoteResponseSummary, SupplierRegistrationReview } from "@/lib/supplier-quote-portal";
import type { OperationResultKind } from "../operation-result-panel";
import { confirmSiengeWrite, exportComparison, exportItemComparison, numberOrUndefined, registrationText, siengeActionQuestions } from "./helpers";
import { AprovacaoTab } from "./tabs/aprovacao-tab";
import { CadastrosTab } from "./tabs/cadastros-tab";
import { FornecedoresTab } from "./tabs/fornecedores-tab";
import { HistoricoTab } from "./tabs/historico-tab";
import { InsumosTab } from "./tabs/insumos-tab";
import { LinksTab } from "./tabs/links-tab";
import { MapaTab } from "./tabs/mapa-tab";
import { ResumoTab } from "./tabs/resumo-tab";
import { RespostasTab } from "./tabs/respostas-tab";
import { SiengeTab } from "./tabs/sienge-tab";
import { tabs, type ApprovalMode, type DetailTab, type DetailTabGroup, type GeneratedSupplierLink, type NegotiationDispatch, type SiengeAction } from "./types";

type DetailTabConfig = (typeof tabs)[number];

const tabGroups = tabs.reduce<Array<{ group: DetailTabGroup; items: DetailTabConfig[] }>>((groups, item) => {
  const current = groups.find((group) => group.group === item.group);
  if (current) {
    current.items.push(item);
    return groups;
  }
  return [...groups, { group: item.group, items: [item] }];
}, []);

export function QuotationDetail({
  quotation,
  supplierResponses = [],
  supplierAwards = [],
  supplierInvitations = [],
  supplierEvents = [],
  supplierReviews = {},
  knownBuyerIds = []
}: {
  quotation: QuotationSummary;
  supplierResponses?: SupplierQuoteResponseSummary[];
  supplierAwards?: SupplierQuoteAwardSummary[];
  supplierInvitations?: SupplierQuoteInvitationSummary[];
  supplierEvents?: SupplierQuoteEventSummary[];
  supplierReviews?: Record<string, SupplierRegistrationReview>;
  knownBuyerIds?: string[];
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
  const [directItemBuildingId, setDirectItemBuildingId] = useState("");
  const [directItemProductId, setDirectItemProductId] = useState("");
  const [directItemQuantity, setDirectItemQuantity] = useState("");
  const [directItemUnity, setDirectItemUnity] = useState("");
  const [directItemNeedDate, setDirectItemNeedDate] = useState(new Date().toISOString().slice(0, 10));
  const [operationResult, setOperationResult] = useState("");
  const [operationTitle, setOperationTitle] = useState("Retorno da integração");
  const [operationKind, setOperationKind] = useState<OperationResultKind>("info");
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
  const [pendingSupplierKind, setPendingSupplierKind] = useState<OperationResultKind>("info");
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
          partial: Boolean(quotedItem?.partial),
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
    if (confirm && !confirmSiengeWrite(siengeActionQuestions[action])) return;
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
          : undefined,
        item: action === "add-item"
          ? {
              buildingId: Number(directItemBuildingId) || undefined,
              productId: Number(directItemProductId) || undefined,
              quantity: Number(directItemQuantity) || undefined,
              unitySymbol: directItemUnity.trim() || undefined,
              deliveryRequirements: [{
                requirementDate: directItemNeedDate,
                requirementQuantity: Number(directItemQuantity) || 0
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
      setOperationKind(confirm ? (response.ok ? "success" : "error") : "info");
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
      setOperationKind("error");
      return undefined;
    } finally {
      setLoadingAction(null);
    }
  }

  function negotiationPayloadFromResponse(dispatch: NegotiationDispatch) {
    const selected = new Set(dispatch.selectedItems || []);
    const terms = dispatch.response.commercialTerms;
    const discountValue = terms.offersCash
      ? Math.round(dispatch.response.totalValue * (terms.cashDiscountPercentage / 100) * 100) / 100
      : 0;

    const paymentOptions = [];
    if (terms.offersCash) {
      paymentOptions.push({
        description: terms.cashDiscountPercentage > 0 ? `À vista com ${terms.cashDiscountPercentage}% de desconto` : "À vista",
        selected: true,
        paymentTerms: [{ numberOfdays: 0, percentage: 100 }]
      });
    }
    if (terms.offersTerm) {
      const termInstallments = terms.installments.filter((installment) => installment.percentage > 0);
      paymentOptions.push({
        description: termInstallments.length
          ? `A prazo (${termInstallments.map((installment) => `${installment.percentage}% em ${installment.days}d`).join(" + ")})`
          : "A prazo",
        selected: !terms.offersCash,
        paymentTerms: termInstallments.length
          ? termInstallments.map((installment) => ({ numberOfdays: installment.days, percentage: installment.percentage }))
          : [{ numberOfdays: 30, percentage: 100 }]
      });
    }
    if (!paymentOptions.length) {
      paymentOptions.push({ description: "À vista", selected: true, paymentTerms: [{ numberOfdays: 0, percentage: 100 }] });
    }

    return {
      supplierAnswerDate: dispatch.response.createdAt.slice(0, 10),
      internalNotes: `Resposta #${dispatch.response.id} recebida pelo portal do fornecedor em ${dispatch.response.createdAt.slice(0, 10)}.`,
      supplierNotes: terms.generalNotes || undefined,
      discount: discountValue,
      freightType: terms.freightType,
      freightPrice: terms.freightPrice,
      paymentTerms: paymentOptions,
      authorize: dispatch.authorize === true,
      items: dispatch.response.items
        .filter((item) => item.attends)
        .map((item) => {
          const quotationItem = quotation.items.find((current) => current.itemNumber === item.itemNumber);
          return {
            quotationItemNumber: item.itemNumber,
            quotedQuantity: quotationItem?.quantity || item.quantity || 0,
            negotiatedQuantity: item.quantity || quotationItem?.quantity || 0,
            unitPrice: item.unitPrice || 0,
            selected: selected.has(item.itemNumber),
            supplierNotes: item.notes || undefined
          };
        })
    };
  }

  async function runNegotiationAction(dispatches: NegotiationDispatch[], confirm: boolean, title: string) {
    if (confirm) {
      const suppliers = dispatches.map((dispatch) => dispatch.response.supplierName).join(", ");
      const question = dispatches.length > 1
        ? `Gravar e autorizar a negociação de ${dispatches.length} fornecedor(es) (${suppliers}) no Sienge agora?`
        : `Gravar a negociação de ${suppliers} no Sienge agora?`;
      if (!confirmSiengeWrite(question)) return;
    }
    setLoadingAction(confirm ? "negotiation-confirm" : "negotiation-preview");
    setOperationTitle(confirm ? title : `${title} (conferência)`);
    setOperationResult("");
    setGeneratedSupplierLink(undefined);
    setTab("sienge");

    try {
      const results = [];
      for (const dispatch of dispatches) {
        const response = await fetch("/api/sienge/purchase-quotations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "send-negotiation",
            confirm,
            dryRun: !confirm,
            purchaseQuotationId: quotation.id,
            supplierId: dispatch.response.supplierId,
            negotiation: negotiationPayloadFromResponse(dispatch)
          })
        });
        const json = await response.json();
        results.push({
          supplier: dispatch.response.supplierName,
          supplierId: dispatch.response.supplierId,
          ok: response.ok,
          ...json
        });
        if (confirm && !response.ok) break;
      }
      setOperationResult(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
      setOperationKind(confirm ? (results.every((result) => result.ok) ? "success" : "error") : "info");
      if (confirm) void refreshEvents();
    } finally {
      setLoadingAction(null);
    }
  }

  function buildAwardDispatches(): { dispatches: NegotiationDispatch[]; error?: string } {
    if (!awards.length) return { dispatches: [], error: "Salve a aprovação antes de registrar a decisão no Sienge." };

    const selectionsByResponse = new Map<number, number[]>();
    awards.forEach((award) => {
      if (award.scope === "quotation") {
        const response = supplierResponses.find((current) => current.id === award.responseId);
        selectionsByResponse.set(award.responseId, response?.items.filter((item) => item.attends).map((item) => item.itemNumber) || []);
      } else if (award.itemNumber) {
        selectionsByResponse.set(award.responseId, [...(selectionsByResponse.get(award.responseId) || []), award.itemNumber]);
      }
    });

    const dispatches: NegotiationDispatch[] = [];
    const missingSupplier: string[] = [];
    selectionsByResponse.forEach((selectedItems, responseId) => {
      const response = supplierResponses.find((current) => current.id === responseId);
      if (!response) return;
      if (!response.supplierId) {
        missingSupplier.push(response.supplierName);
        return;
      }
      dispatches.push({ response, selectedItems, authorize: true });
    });

    if (missingSupplier.length) {
      return { dispatches: [], error: `Crie no Sienge o cadastro de: ${missingSupplier.join(", ")} (aba Cadastros) antes de registrar a decisão.` };
    }
    return { dispatches };
  }

  async function sendAwardsToSienge(confirm: boolean) {
    const { dispatches, error } = buildAwardDispatches();
    if (error) {
      setApprovalMessage(error);
      return;
    }
    setApprovalMessage("");
    await runNegotiationAction(dispatches, confirm, "Decisão registrada no Sienge");
  }

  async function openComparisonMapPdf() {
    setLoadingAction("comparison-map");
    try {
      const response = await fetch(`/api/sienge/purchase-quotations?type=comparison-map&quotationId=${quotation.id}`, { cache: "no-store" });
      const json = await response.json() as { urls?: string[]; message?: string };
      if (!response.ok || !json.urls?.length) {
        setOperationTitle("Mapa comparativo do Sienge");
        setOperationResult(JSON.stringify(json, null, 2));
        setOperationKind("error");
        setTab("sienge");
        return;
      }
      window.open(json.urls[0], "_blank", "noopener");
    } finally {
      setLoadingAction(null);
    }
  }

  async function revokeInvitation(invitationId: number) {
    setLoadingAction("revoke-link");
    setLinkMessage("");
    try {
      const response = await fetch("/api/supplier-portal/invitations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotationId: quotation.id, invitationId })
      });
      const json = await response.json() as { invitations?: SupplierQuoteInvitationSummary[]; message?: string };
      if (!response.ok) throw new Error(json.message || "Não foi possível revogar o link.");
      if (json.invitations) setInvitations(json.invitations);
      setLinkMessage("Link revogado. O fornecedor não consegue mais enviar propostas por ele.");
      void refreshEvents();
    } catch (error) {
      setLinkMessage(error instanceof Error ? error.message : "Erro inesperado ao revogar o link.");
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
    if (confirm && !confirmSiengeWrite(`Criar o fornecedor ${response.supplierName} no Sienge agora?`)) return;
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
      setPendingSupplierKind(confirm ? (siengeResponse.ok ? "success" : "error") : "info");
      if (confirm) void refreshEvents();
    } catch (error) {
      const result = { message: error instanceof Error ? error.message : "Erro inesperado ao processar fornecedor." };
      await updateRegistrationReview(document, "failed", result);
      setPendingSupplierResult(JSON.stringify(result, null, 2));
      setPendingSupplierKind("error");
    } finally {
      setPendingSupplierLoading(null);
    }
  }

  function handleSupplierChange(next: string, supplier?: { document?: string; name?: string }) {
    setSupplierId(next);
    setSupplierDocument(supplier?.document || "");
    setSupplierName(supplier?.name || "");
  }

  const siengeForm = {
    buyerId,
    quotationDate,
    purchaseRequestId,
    purchaseRequestItemNumber,
    deliveryRequirementNumber,
    supplierId,
    directItemBuildingId,
    directItemProductId,
    directItemQuantity,
    directItemUnity,
    directItemNeedDate
  };

  const siengeFormSetters: Record<keyof typeof siengeForm, (value: string) => void> = {
    buyerId: setBuyerId,
    quotationDate: setQuotationDate,
    purchaseRequestId: setPurchaseRequestId,
    purchaseRequestItemNumber: setPurchaseRequestItemNumber,
    deliveryRequirementNumber: setDeliveryRequirementNumber,
    supplierId: setSupplierId,
    directItemBuildingId: setDirectItemBuildingId,
    directItemProductId: setDirectItemProductId,
    directItemQuantity: setDirectItemQuantity,
    directItemUnity: setDirectItemUnity,
    directItemNeedDate: setDirectItemNeedDate
  };

  function handleSiengeFormChange<K extends keyof typeof siengeForm>(field: K, value: typeof siengeForm[K]) {
    siengeFormSetters[field](value);
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
        {tabGroups.map((group) => (
          <div className="quotation-detail-tab-group" key={group.group}>
            <span>{group.group}</span>
            <div>
              {group.items.map((item) => (
                <button className={tab === item.key ? "active" : ""} key={item.key} type="button" onClick={() => setTab(item.key)}>
                  {item.label}
                  {tabCounts[item.key] !== undefined && <strong>{tabCounts[item.key]}</strong>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {tab === "resumo" && (
        <ResumoTab quotation={quotation} bestSupplier={bestSupplier} hasPortalResponses={supplierResponses.length > 0} />
      )}

      {tab === "sienge" && (
        <SiengeTab
          quotationId={quotation.id}
          knownBuyerIds={knownBuyerIds}
          form={siengeForm}
          onFormChange={handleSiengeFormChange}
          onSupplierChange={handleSupplierChange}
          loadingAction={loadingAction}
          onRunAction={runSiengeAction}
          onGenerateLink={() => void generateSupplierPortalLink()}
          operationResult={operationResult}
          operationTitle={operationTitle}
          operationKind={operationKind}
          generatedSupplierLink={generatedSupplierLink}
          onCopyLink={copyInvitationLink}
        />
      )}

      {tab === "insumos" && (
        <InsumosTab
          quotation={quotation}
          onUseItem={(nextTab, itemNumber) => { setTab(nextTab); setPurchaseRequestItemNumber(String(itemNumber)); }}
        />
      )}

      {tab === "fornecedores" && (
        <FornecedoresTab
          quotation={quotation}
          supplierId={supplierId}
          onSupplierChange={handleSupplierChange}
          onGoToTab={setTab}
          onGenerateLink={() => void generateSupplierPortalLink()}
          loadingAction={loadingAction}
        />
      )}

      {tab === "links" && (
        <LinksTab
          invitations={invitations}
          linkMessage={linkMessage}
          loadingAction={loadingAction}
          onGoToTab={setTab}
          onCopyLink={copyInvitationLink}
          onRegenerateLink={(invitation) => void generateSupplierPortalLink({
            supplierId: invitation.supplierId,
            supplierName: invitation.supplierName,
            document: invitation.document
          })}
          onRevokeLink={revokeInvitation}
        />
      )}

      {tab === "respostas" && (
        <RespostasTab
          quotation={quotation}
          supplierResponses={supplierResponses}
          responseStats={responseStats}
          loadingAction={loadingAction}
          onSendNegotiation={(response, confirm) => void runNegotiationAction([{ response }], confirm, "Negociação enviada ao Sienge")}
        />
      )}

      {tab === "mapa" && (
        <MapaTab
          quotation={quotation}
          supplierResponses={supplierResponses}
          itemComparison={itemComparison}
          loadingAction={loadingAction}
          onExportPdf={() => void openComparisonMapPdf()}
        />
      )}

      {tab === "aprovacao" && (
        <AprovacaoTab
          supplierResponses={supplierResponses}
          itemComparison={itemComparison}
          approvalMode={approvalMode}
          onApprovalModeChange={setApprovalMode}
          approvalResponseId={approvalResponseId}
          onApprovalResponseIdChange={setApprovalResponseId}
          approvalJustification={approvalJustification}
          onApprovalJustificationChange={setApprovalJustification}
          itemAwardSelections={itemAwardSelections}
          onItemAwardChange={setItemAward}
          itemAwardJustifications={itemAwardJustifications}
          onItemJustificationChange={setItemJustification}
          approvalMessage={approvalMessage}
          approvalSaving={approvalSaving}
          onSaveAward={() => void saveAwardDecision()}
          awards={awards}
          onSendAwardsToSienge={(confirm) => void sendAwardsToSienge(confirm)}
          loadingAction={loadingAction}
        />
      )}

      {tab === "cadastros" && (
        <CadastrosTab
          pendingSuppliers={pendingSuppliers}
          registrationReviews={registrationReviews}
          pendingSupplierLoading={pendingSupplierLoading}
          pendingSupplierResult={pendingSupplierResult}
          pendingSupplierKind={pendingSupplierKind}
          onSubmitPendingSupplier={(response, confirm) => void submitPendingSupplier(response, confirm)}
        />
      )}

      {tab === "historico" && (
        <HistoricoTab events={events} onRefresh={() => void refreshEvents()} />
      )}
    </main>
  );
}
