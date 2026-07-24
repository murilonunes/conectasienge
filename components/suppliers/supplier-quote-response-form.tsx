"use client";

import { I18nText } from "@/components/i18n/i18n-text";
import { useEffect, useMemo, useRef, useState } from "react";
import type { QuotationItemSummary } from "@/features/quotations/data";
import { formatCurrency } from "@/lib/formatters";
import { daysUntilQuotationDeadline, quotationDeadlineEnd } from "@/lib/quotation-deadline";
import type { SupplierQuoteProposalAttachment, SupplierQuoteResponseSummary } from "@/lib/supplier-quote-portal";
import { FreightStep } from "./supplier-quote-response-form/freight-step";
import { IdentityStep } from "./supplier-quote-response-form/identity-step";
import { ItemsStep } from "./supplier-quote-response-form/items-step";
import { PaymentStep } from "./supplier-quote-response-form/payment-step";
import { ReviewStep } from "./supplier-quote-response-form/review-step";
import { defaultInstallments, initialItems, itemTotal } from "./supplier-quote-response-form/helpers";
import type { CashDiscountChoice, CashDiscountMode, FreightType, InstallmentRow, RegistrationData, ResponseItem, TermPaymentChoice, WizardStep } from "./supplier-quote-response-form/types";
import { SupplierQuoteSubmittedView } from "./supplier-quote-submitted-view";

const wizardSteps: Array<{ id: WizardStep; label: string }> = [
  { id: 1, label: "Dados do fornecedor" },
  { id: 2, label: "Itens" },
  { id: 3, label: "Pagamento" },
  { id: 4, label: "Frete e entrega" },
  { id: 5, label: "Conferência" }
];

type SupplierQuoteResponseFormProps = {
  token: string;
  quotationCode: string;
  items: QuotationItemSummary[];
  initialSupplier?: {
    supplierId?: number;
    supplierName?: string;
    document?: string;
    email?: string;
    phone?: string;
    locked?: boolean;
  };
  responseDeadline?: string;
};

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function validDocument(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 || digits.length === 14;
}

export function SupplierQuoteResponseForm({ token, quotationCode, items, initialSupplier, responseDeadline }: SupplierQuoteResponseFormProps) {
  const fixedSupplier = initialSupplier?.locked ? initialSupplier : undefined;
  const deadlineDaysLeft = daysUntilQuotationDeadline(responseDeadline);
  const deadlineEnd = quotationDeadlineEnd(responseDeadline);
  const [supplierName, setSupplierName] = useState(initialSupplier?.supplierName || "");
  const [document, setDocument] = useState(initialSupplier?.document || "");
  const [email, setEmail] = useState(initialSupplier?.email || "");
  const [phone, setPhone] = useState(initialSupplier?.phone || "");
  const [registration, setRegistration] = useState<RegistrationData>({ tradeName: "", city: "", state: "" });
  const [responseItems, setResponseItems] = useState(() => initialItems(items));
  const [offersCash, setOffersCash] = useState(true);
  const [cashDiscountChoice, setCashDiscountChoice] = useState<CashDiscountChoice>("");
  const [cashDiscountMode, setCashDiscountMode] = useState<CashDiscountMode>("");
  const [cashDiscountPercentage, setCashDiscountPercentage] = useState("");
  const [cashDiscountValue, setCashDiscountValue] = useState("");
  const [termPaymentChoice, setTermPaymentChoice] = useState<TermPaymentChoice>("");
  const [offersTerm, setOffersTerm] = useState(false);
  const [installments, setInstallments] = useState<InstallmentRow[]>(() => defaultInstallments());
  const [freightType, setFreightType] = useState<FreightType>("");
  const [freightPrice, setFreightPrice] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [proposalAttachment, setProposalAttachment] = useState<SupplierQuoteProposalAttachment | undefined>();
  const [checkingDocument, setCheckingDocument] = useState(false);
  const [supplierExists, setSupplierExists] = useState<boolean | undefined>(fixedSupplier ? true : undefined);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedResponse, setSubmittedResponse] = useState<SupplierQuoteResponseSummary | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [maxStepReached, setMaxStepReached] = useState<WizardStep>(1);
  const [stepMessage, setStepMessage] = useState("");
  const [validationAttempts, setValidationAttempts] = useState<Partial<Record<WizardStep, boolean>>>({});
  const stepNavRef = useRef<HTMLDivElement>(null);
  const stepperRef = useRef<HTMLElement>(null);
  const previousStep = useRef<WizardStep>(1);

  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    stepperRef.current?.scrollIntoView({ block: "start" });
  }, [step]);

  const quotedCount = useMemo(() => responseItems.filter((item) => item.attends).length, [responseItems]);
  const quotedTotal = useMemo(() => responseItems.reduce((sum, item) => sum + itemTotal(item), 0), [responseItems]);
  const invalidQuotedCount = useMemo(() => responseItems.filter((item) => {
    if (!item.attends) return false;
    const original = items.find((current) => current.itemNumber === item.itemNumber);
    const requestedQuantity = Number(original?.quantity || 0);
    const quantity = Number(item.quantity || 0);
    if (Number(item.unitPrice) <= 0 || quantity <= 0 || requestedQuantity <= 0) return true;
    if (quantity > requestedQuantity) return true;
    if (item.partial) return quantity >= requestedQuantity;
    return quantity !== requestedQuantity;
  }).length, [items, responseItems]);

  const installmentsTotalPercentage = useMemo(
    () => Math.round(installments.reduce((sum, installment) => sum + (Number(installment.percentage) || 0), 0) * 100) / 100,
    [installments]
  );
  const installmentsTotalValid = Math.abs(installmentsTotalPercentage - 100) < 0.01;
  const cashDiscountAmount = useMemo(() => {
    if (cashDiscountChoice !== "yes") return 0;
    if (cashDiscountMode === "value") return Math.min(quotedTotal, Math.max(0, Number(cashDiscountValue) || 0));
    if (cashDiscountMode === "percentage") {
      return quotedTotal * (Math.min(100, Math.max(0, Number(cashDiscountPercentage) || 0)) / 100);
    }
    return 0;
  }, [cashDiscountChoice, cashDiscountMode, cashDiscountPercentage, cashDiscountValue, quotedTotal]);
  const effectiveCashDiscountPercentage = useMemo(() => {
    if (quotedTotal <= 0) return 0;
    return Math.round((cashDiscountAmount / quotedTotal) * 10000) / 100;
  }, [cashDiscountAmount, quotedTotal]);
  const cashPrice = useMemo(
    () => Math.max(0, quotedTotal - cashDiscountAmount),
    [quotedTotal, cashDiscountAmount]
  );

  function addInstallment() {
    setInstallments((current) => [...current, { days: "", percentage: "" }]);
  }

  function removeInstallment(index: number) {
    setInstallments((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function updateInstallment(index: number, field: keyof InstallmentRow, value: string) {
    setInstallments((current) => current.map((installment, currentIndex) => (
      currentIndex === index ? { ...installment, [field]: value } : installment
    )));
  }

  function replaceInstallments(nextInstallments: InstallmentRow[]) {
    setInstallments(nextInstallments.length ? nextInstallments : []);
  }

  function chooseTermPayment(choice: TermPaymentChoice) {
    setTermPaymentChoice(choice);
    setOffersTerm(choice === "yes");
    if (choice !== "yes") setInstallments([]);
  }

  function chooseCashDiscount(choice: CashDiscountChoice) {
    setCashDiscountChoice(choice);
    if (choice !== "yes") {
      setCashDiscountMode("");
      setCashDiscountPercentage("");
      setCashDiscountValue("");
    }
  }

  function chooseOffersCash(value: boolean) {
    setOffersCash(value);
    if (!value) {
      setCashDiscountChoice("");
      setCashDiscountMode("");
      setCashDiscountPercentage("");
      setCashDiscountValue("");
    }
  }

  function chooseCashDiscountMode(value: CashDiscountMode) {
    setCashDiscountMode(value);
    setCashDiscountPercentage("");
    setCashDiscountValue("");
  }

  function arrayBufferToBase64(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 8192;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      const chunk = bytes.subarray(index, index + chunkSize);
      for (let chunkIndex = 0; chunkIndex < chunk.length; chunkIndex += 1) {
        binary += String.fromCharCode(chunk[chunkIndex]);
      }
    }
    return window.btoa(binary);
  }

  async function attachSupplierProposal(file: File | undefined) {
    if (!file) return;
    const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
    if (!allowedTypes.has(file.type)) {
      setStepMessage("Anexe a proposta em PDF, JPG ou PNG.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setStepMessage("O anexo da proposta deve ter no máximo 2 MB.");
      return;
    }
    const dataUrl = `data:${file.type};base64,${arrayBufferToBase64(await file.arrayBuffer())}`;
    setProposalAttachment({
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      dataUrl,
      uploadedAt: new Date().toISOString()
    });
    setStepMessage("");
  }

  const identityValid = Boolean(supplierName.trim()) && validDocument(document) && validEmail(email) && validPhone(phone);
  const itemsValid = quotedCount > 0 && invalidQuotedCount === 0;
  const cashDiscountDecisionValid = !offersCash || cashDiscountChoice === "yes" || cashDiscountChoice === "no";
  const cashDiscountInputValid = !offersCash || cashDiscountChoice !== "yes" || (
    cashDiscountMode === "percentage"
      ? Number(cashDiscountPercentage) > 0 && Number(cashDiscountPercentage) <= 100
      : cashDiscountMode === "value"
        ? Number(cashDiscountValue) > 0 && Number(cashDiscountValue) <= quotedTotal
        : false
  );
  const termDecisionValid = termPaymentChoice === "yes" || termPaymentChoice === "no";
  const termInstallmentsValid = termPaymentChoice !== "yes" || (installments.length > 0 && installmentsTotalValid);
  const paymentValid = cashDiscountDecisionValid && cashDiscountInputValid && termDecisionValid && (offersCash || offersTerm) && termInstallmentsValid;
  const freightValid = Boolean(freightType) && Number(deliveryDays) > 0 && (freightType !== "PAID" || Number(freightPrice) > 0);
  const canSubmit = identityValid && itemsValid && paymentValid && freightValid;

  const stepValid: Record<WizardStep, boolean> = {
    1: identityValid,
    2: itemsValid,
    3: paymentValid,
    4: freightValid,
    5: canSubmit
  };

  function paymentStepMessage() {
    if (!cashDiscountDecisionValid) return "Informe se oferece desconto à vista: Sim ou Não.";
    if (!cashDiscountInputValid) return "Escolha percentual ou valor e informe um desconto à vista válido.";
    if (!termDecisionValid) return "Informe se aceita pagamento a prazo: Sim ou Não.";
    if (offersTerm && !installments.length) return "Gere as parcelas automaticamente ou adicione ao menos uma parcela manualmente.";
    if (offersTerm && !installmentsTotalValid) return "As parcelas do pagamento a prazo devem somar 100% do valor.";
    return "Marque ao menos uma forma de pagamento: à vista, a prazo ou as duas.";
  }

  const stepMessages: Record<WizardStep, string> = {
    1: "Informe CPF/CNPJ válido, razão social ou nome, e-mail válido e telefone com DDD para continuar.",
    2: "Marque ao menos um item, informe valor e use Parcial quando a quantidade for menor que a solicitada.",
    3: paymentStepMessage(),
    4: "Escolha uma opção de frete e informe o prazo geral de entrega em dias.",
    5: "Revise os passos anteriores: fornecedor, itens, pagamento e frete."
  };
  const nextActionLabels: Record<WizardStep, string> = {
    1: "Continuar para itens",
    2: "Continuar para pagamento",
    3: "Continuar para frete",
    4: "Continuar para conferência",
    5: "Enviar proposta"
  };
  const backActionLabels: Record<WizardStep, string> = {
    1: "",
    2: "Voltar para dados",
    3: "Voltar para itens",
    4: "Voltar para pagamento",
    5: "Voltar para frete"
  };

  function goToStep(target: WizardStep) {
    if (target <= maxStepReached) {
      setStepMessage("");
      setStep(target);
    }
  }

  function goNext() {
    if (!stepValid[step]) {
      setValidationAttempts((current) => ({ ...current, [step]: true }));
      setStepMessage(stepMessages[step]);
      window.setTimeout(() => stepNavRef.current?.scrollIntoView({ block: "nearest" }), 80);
      return;
    }
    setStepMessage("");
    const next = Math.min(5, step + 1) as WizardStep;
    setMaxStepReached((current) => (current > next ? current : next));
    setStep(next);
  }

  function goBack() {
    setStepMessage("");
    setStep((current) => Math.max(1, current - 1) as WizardStep);
  }

  useEffect(() => {
    const clean = document.replace(/\D/g, "");
    if (fixedSupplier && supplierName && email && phone) {
      setSupplierExists(true);
      setCheckingDocument(false);
      return;
    }
    if (clean.length < 11) {
      setSupplierExists(fixedSupplier ? true : undefined);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCheckingDocument(true);
      try {
        const response = await fetch(`/api/supplier-portal/suppliers?token=${encodeURIComponent(token)}&q=${encodeURIComponent(clean)}&limit=1`, { signal: controller.signal });
        if (!response.ok) return;
        const json = await response.json() as { suppliers: Array<{ name: string; email?: string; phone?: string }> };
        const supplier = json.suppliers[0];
        setSupplierExists(fixedSupplier ? true : Boolean(supplier));
        if (supplier && !supplierName) setSupplierName(supplier.name);
        if (supplier && !email) setEmail(supplier.email || "");
        if (supplier && !phone) setPhone(supplier.phone || "");
      } finally {
        setCheckingDocument(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [document, email, fixedSupplier, phone, supplierName, token]);

  function updateItem(itemNumber: number, field: keyof ResponseItem, value: string | boolean) {
    setResponseItems((current) => current.map((item) => (
      item.itemNumber === itemNumber ? nextResponseItem(item, field, value) : item
    )));
  }

  function nextResponseItem(item: ResponseItem, field: keyof ResponseItem, value: string | boolean): ResponseItem {
    const original = items.find((current) => current.itemNumber === item.itemNumber);
    const requestedQuantity = String(original?.quantity || "");
    if (field === "attends") {
      return {
        ...item,
        attends: value === true,
        partial: false,
        quantity: value === true ? requestedQuantity : item.quantity
      };
    }
    if (field === "partial") {
      const partial = value === true;
      return {
        ...item,
        partial,
        quantity: partial
          ? (Number(item.quantity) >= Number(requestedQuantity) ? "" : item.quantity)
          : requestedQuantity
      };
    }
    if (field === "quantity") {
      const requested = Number(requestedQuantity) || 0;
      const quantity = Math.max(0, Math.min(requested, Number(value) || 0));
      return { ...item, quantity: value === "" ? "" : String(quantity) };
    }
    return { ...item, [field]: value };
  }

  async function submit() {
    if (!canSubmit) {
      setMessage("Revise fornecedor, CPF/CNPJ, e-mail, telefone e valores dos itens marcados.");
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
          partial: item.partial,
          unitPrice: Number(item.unitPrice || 0),
          quantity: Number(item.quantity || 0),
          deadlineDays: Number(item.deadlineDays || 0),
          notes: item.notes
        })),
        commercialTerms: {
          offersCash,
          cashDiscountMode: cashDiscountChoice === "yes" && cashDiscountMode ? cashDiscountMode : "none",
          cashDiscountPercentage: effectiveCashDiscountPercentage,
          cashDiscountValue: cashDiscountChoice === "yes" ? Math.round(cashDiscountAmount * 100) / 100 : 0,
          offersTerm,
          installments: installments.map((installment) => ({
            days: Number(installment.days || 0),
            percentage: Number(installment.percentage || 0)
          })),
          freightType,
          freightPrice: Number(freightPrice || 0),
          deliveryDays: Number(deliveryDays || 0),
          generalNotes
        },
        proposalAttachment
      };
      const response = await fetch("/api/supplier-portal/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Não foi possível enviar a proposta.");
      const createdAt = String(json.createdAt || new Date().toISOString());
      setSubmittedResponse({
        id: Number(json.responseId || 0),
        quotationId: 0,
        supplierName,
        document,
        email,
        phone,
        registration: supplierExists ? undefined : registration,
        registrationPending: Boolean(json.registrationPending),
        items: payload.items,
        attendedCount: payload.items.filter((item) => item.attends).length,
        totalValue: payload.items.reduce((sum, item) => sum + (item.attends ? item.unitPrice * item.quantity : 0), 0),
        commercialTerms: {
          offersCash,
          cashDiscountMode: cashDiscountChoice === "yes" && cashDiscountMode ? cashDiscountMode : "none",
          cashDiscountPercentage: effectiveCashDiscountPercentage,
          cashDiscountValue: cashDiscountChoice === "yes" ? Math.round(cashDiscountAmount * 100) / 100 : 0,
          offersTerm,
          installments: payload.commercialTerms.installments,
          freightType: freightType || "NONE",
          freightPrice: Number(freightPrice || 0),
          deliveryDays: Number(deliveryDays || 0),
          generalNotes
        },
        proposalAttachment,
        createdAt
      });
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

  if (submitted && submittedResponse) {
    return (
      <SupplierQuoteSubmittedView
        token={token}
        quotationCode={quotationCode}
        items={items}
        response={submittedResponse}
        message={message}
        canRequestNewLink={false}
      />
    );
  }

  return (
    <section className="supplier-portal-form">
      <header className="supplier-public-hero">
        <div>
          <span><I18nText text={"Portal de cotação"} /></span>
          <h1><I18nText text={"Cotação #"} />{quotationCode}</h1>
          {deadlineEnd && deadlineDaysLeft !== undefined && deadlineDaysLeft >= 0 && (
            <p className={`supplier-deadline-note ${deadlineDaysLeft <= 1 ? "warn" : ""}`}>
              <I18nText text={"Prazo para envio:"} /> {deadlineEnd.toLocaleDateString("pt-BR")}
              {deadlineDaysLeft === 0 ? <I18nText text={" — encerra hoje"} /> : deadlineDaysLeft === 1 ? <I18nText text={" — falta 1 dia"} /> : ` — faltam ${deadlineDaysLeft} dias`}
            </p>
          )}
        </div>
        <div className="supplier-public-hero-metrics">
          <strong className="count">{items.length}<small><I18nText text={"Itens"} /></small></strong>
          <strong className="count">{quotedCount}<small><I18nText text={"Marcados"} /></small></strong>
          <strong className="amount">{formatCurrency(quotedTotal)}<small><I18nText text={"Total"} /></small></strong>
        </div>
      </header>

      <nav className="supplier-stepper" ref={stepperRef}>
        {wizardSteps.map((item) => (
          <button
            key={item.id}
            type="button"
            className={step === item.id ? "active" : step > item.id ? "done" : item.id > maxStepReached ? "future" : ""}
            aria-disabled={item.id > maxStepReached}
            onClick={() => (item.id <= maxStepReached ? goToStep(item.id) : goNext())}
          >
            <i>{step > item.id ? <I18nText text={"✓"} /> : item.id}</i>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="supplier-public-stack">
        {step === 1 && (
          <IdentityStep
            document={document}
            supplierName={supplierName}
            email={email}
            phone={phone}
            registration={registration}
            checkingDocument={checkingDocument}
            supplierExists={supplierExists}
            showValidation={Boolean(validationAttempts[1])}
            lockedFields={{
              document: Boolean(fixedSupplier?.document),
              supplierName: Boolean(fixedSupplier?.supplierName),
              email: Boolean(fixedSupplier?.email),
              phone: Boolean(fixedSupplier?.phone)
            }}
            onDocumentChange={setDocument}
            onSupplierNameChange={setSupplierName}
            onEmailChange={setEmail}
            onPhoneChange={setPhone}
            onRegistrationChange={setRegistration}
          />
        )}

        {step === 2 && (
          <ItemsStep
            items={items}
            responseItems={responseItems}
            showValidation={Boolean(validationAttempts[2])}
            onItemChange={updateItem}
          />
        )}

        {step === 3 && (
          <PaymentStep
            offersCash={offersCash}
            cashDiscountChoice={cashDiscountChoice}
            cashDiscountMode={cashDiscountMode}
            offersTerm={offersTerm}
            termPaymentChoice={termPaymentChoice}
            cashDiscountPercentage={cashDiscountPercentage}
            cashDiscountValue={cashDiscountValue}
            cashDiscountAmount={cashDiscountAmount}
            cashPrice={cashPrice}
            installments={installments}
            installmentsTotalPercentage={installmentsTotalPercentage}
            installmentsTotalValid={installmentsTotalValid}
            showValidation={Boolean(validationAttempts[3])}
            onOffersCashChange={chooseOffersCash}
            onCashDiscountChoiceChange={chooseCashDiscount}
            onCashDiscountModeChange={chooseCashDiscountMode}
            onTermPaymentChoiceChange={chooseTermPayment}
            onCashDiscountPercentageChange={setCashDiscountPercentage}
            onCashDiscountValueChange={setCashDiscountValue}
            onInstallmentChange={updateInstallment}
            onInstallmentsReplace={replaceInstallments}
            onAddInstallment={addInstallment}
            onRemoveInstallment={removeInstallment}
          />
        )}

        {step === 4 && (
          <FreightStep
            freightType={freightType}
            freightPrice={freightPrice}
            deliveryDays={deliveryDays}
            generalNotes={generalNotes}
            showValidation={Boolean(validationAttempts[4])}
            onFreightTypeChange={setFreightType}
            onFreightPriceChange={setFreightPrice}
            onDeliveryDaysChange={setDeliveryDays}
            onGeneralNotesChange={setGeneralNotes}
          />
        )}

        {step === 5 && (
          <ReviewStep
            document={document}
            supplierName={supplierName}
            email={email}
            phone={phone}
            items={items}
            responseItems={responseItems}
            quotedCount={quotedCount}
            offersCash={offersCash}
            offersTerm={offersTerm}
            cashDiscountPercentage={String(effectiveCashDiscountPercentage)}
            cashDiscountMode={cashDiscountChoice === "yes" && cashDiscountMode ? cashDiscountMode : "none"}
            cashDiscountValue={cashDiscountChoice === "yes" ? String(Math.round(cashDiscountAmount * 100) / 100) : ""}
            cashPrice={cashPrice}
            installments={installments}
            freightType={freightType}
            freightPrice={freightPrice}
            deliveryDays={deliveryDays}
            generalNotes={generalNotes}
            proposalAttachment={proposalAttachment}
            onProposalAttachmentChange={(file) => void attachSupplierProposal(file)}
            onProposalAttachmentRemove={() => setProposalAttachment(undefined)}
            onEditStep={goToStep}
          />
        )}

        <div className="card supplier-step-nav" ref={stepNavRef}>
          {stepMessage && <div className="settings-inline-message">{stepMessage}</div>}
          {message && <div className="settings-inline-message">{message}</div>}
          <div className={`supplier-step-actions ${step === 1 ? "single" : ""}`}>
            {step > 1 && (
              <button className="button secondary supplier-step-secondary" type="button" onClick={goBack}>{backActionLabels[step]}</button>
            )}
            {step < 5 ? (
              <button className="button supplier-step-primary" type="button" onClick={goNext}>{nextActionLabels[step]}</button>
            ) : (
              <button className="button supplier-step-primary" type="button" disabled={submitting || !canSubmit} onClick={submit}>
                {submitting ? <I18nText text={"Enviando proposta..."} /> : nextActionLabels[step]}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
