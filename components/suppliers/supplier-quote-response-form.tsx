"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { QuotationItemSummary } from "@/features/quotations/data";
import { formatCurrency } from "@/lib/formatters";
import { FreightStep } from "./supplier-quote-response-form/freight-step";
import { IdentityStep } from "./supplier-quote-response-form/identity-step";
import { ItemsStep } from "./supplier-quote-response-form/items-step";
import { PaymentStep } from "./supplier-quote-response-form/payment-step";
import { ReviewStep } from "./supplier-quote-response-form/review-step";
import { defaultInstallments, initialItems, itemTotal } from "./supplier-quote-response-form/helpers";
import type { FreightType, InstallmentRow, RegistrationData, ResponseItem, WizardStep } from "./supplier-quote-response-form/types";

const wizardSteps: Array<{ id: WizardStep; label: string }> = [
  { id: 1, label: "Identificação" },
  { id: 2, label: "Itens" },
  { id: 3, label: "Pagamento" },
  { id: 4, label: "Frete" },
  { id: 5, label: "Revisão" }
];

type SupplierQuoteResponseFormProps = {
  token: string;
  quotationCode: string;
  items: QuotationItemSummary[];
  initialDocument?: string;
};

export function SupplierQuoteResponseForm({ token, quotationCode, items, initialDocument = "" }: SupplierQuoteResponseFormProps) {
  const [supplierName, setSupplierName] = useState("");
  const [document, setDocument] = useState(initialDocument);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [registration, setRegistration] = useState<RegistrationData>({ tradeName: "", city: "", state: "" });
  const [responseItems, setResponseItems] = useState(() => initialItems(items));
  const [offersCash, setOffersCash] = useState(true);
  const [cashDiscountPercentage, setCashDiscountPercentage] = useState("");
  const [offersTerm, setOffersTerm] = useState(false);
  const [installments, setInstallments] = useState<InstallmentRow[]>(() => defaultInstallments());
  const [freightType, setFreightType] = useState<FreightType>("NONE");
  const [freightPrice, setFreightPrice] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [checkingDocument, setCheckingDocument] = useState(false);
  const [supplierExists, setSupplierExists] = useState<boolean | undefined>();
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<WizardStep>(1);
  const [maxStepReached, setMaxStepReached] = useState<WizardStep>(1);
  const [stepMessage, setStepMessage] = useState("");
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
  const completedQuotedCount = useMemo(() => responseItems.filter((item) => item.attends && Number(item.unitPrice) > 0 && Number(item.quantity) > 0).length, [responseItems]);
  const missingQuotedValues = quotedCount - completedQuotedCount;

  const installmentsTotalPercentage = useMemo(
    () => Math.round(installments.reduce((sum, installment) => sum + (Number(installment.percentage) || 0), 0) * 100) / 100,
    [installments]
  );
  const installmentsTotalValid = Math.abs(installmentsTotalPercentage - 100) < 0.01;
  const cashPrice = useMemo(
    () => quotedTotal * (1 - Math.min(100, Math.max(0, Number(cashDiscountPercentage) || 0)) / 100),
    [quotedTotal, cashDiscountPercentage]
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

  const identityValid = Boolean(supplierName.trim()) && document.replace(/\D/g, "").length >= 11;
  const itemsValid = quotedCount > 0 && missingQuotedValues === 0;
  const paymentValid = (offersCash || offersTerm) && (!offersTerm || installmentsTotalValid);
  const freightValid = freightType !== "PAID" || Number(freightPrice) > 0;
  const canSubmit = identityValid && itemsValid && paymentValid && freightValid;

  const stepValid: Record<WizardStep, boolean> = {
    1: identityValid,
    2: itemsValid,
    3: paymentValid,
    4: freightValid,
    5: canSubmit
  };

  const stepMessages: Record<WizardStep, string> = {
    1: "Informe o CPF/CNPJ e a razão social ou nome do fornecedor para continuar.",
    2: "Marque ao menos um item e preencha valor e quantidade dele para continuar.",
    3: offersTerm && !installmentsTotalValid
      ? "As parcelas do pagamento a prazo devem somar 100% do valor."
      : "Marque ao menos uma forma de pagamento: à vista, a prazo ou as duas.",
    4: "Informe o valor do frete a pagar ou escolha outra opção de frete.",
    5: "Revise os passos anteriores: fornecedor, itens, pagamento e frete."
  };

  function goToStep(target: WizardStep) {
    if (target <= maxStepReached) {
      setStepMessage("");
      setStep(target);
    }
  }

  function goNext() {
    if (!stepValid[step]) {
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
  }, [document, supplierName, token]);

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
        })),
        commercialTerms: {
          offersCash,
          cashDiscountPercentage: Number(cashDiscountPercentage || 0),
          offersTerm,
          installments: installments.map((installment) => ({
            days: Number(installment.days || 0),
            percentage: Number(installment.percentage || 0)
          })),
          freightType,
          freightPrice: Number(freightPrice || 0),
          generalNotes
        }
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
          <strong className="count">{items.length}<small>Itens</small></strong>
          <strong className="count">{quotedCount}<small>Marcados</small></strong>
          <strong className="amount">{formatCurrency(quotedTotal)}<small>Total</small></strong>
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
            <i>{step > item.id ? "✓" : item.id}</i>
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
            onItemChange={updateItem}
          />
        )}

        {step === 3 && (
          <PaymentStep
            offersCash={offersCash}
            offersTerm={offersTerm}
            cashDiscountPercentage={cashDiscountPercentage}
            cashPrice={cashPrice}
            installments={installments}
            installmentsTotalPercentage={installmentsTotalPercentage}
            installmentsTotalValid={installmentsTotalValid}
            onOffersCashChange={setOffersCash}
            onOffersTermChange={setOffersTerm}
            onCashDiscountPercentageChange={setCashDiscountPercentage}
            onInstallmentChange={updateInstallment}
            onAddInstallment={addInstallment}
            onRemoveInstallment={removeInstallment}
          />
        )}

        {step === 4 && (
          <FreightStep
            freightType={freightType}
            freightPrice={freightPrice}
            generalNotes={generalNotes}
            onFreightTypeChange={setFreightType}
            onFreightPriceChange={setFreightPrice}
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
            cashDiscountPercentage={cashDiscountPercentage}
            cashPrice={cashPrice}
            installments={installments}
            freightType={freightType}
            freightPrice={freightPrice}
            generalNotes={generalNotes}
            onEditStep={goToStep}
          />
        )}

        <div className="card supplier-step-nav" ref={stepNavRef}>
          {stepMessage && <div className="settings-inline-message">{stepMessage}</div>}
          {message && <div className="settings-inline-message">{message}</div>}
          <div className={`supplier-step-actions ${step === 1 ? "single" : ""}`}>
            {step > 1 && (
              <button className="button secondary" type="button" onClick={goBack}>Voltar</button>
            )}
            {step < 5 ? (
              <button className="button" type="button" onClick={goNext}>Continuar</button>
            ) : (
              <button className="button" type="button" disabled={submitting || !canSubmit} onClick={submit}>
                {submitting ? "Enviando..." : "Enviar proposta"}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
