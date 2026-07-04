"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type PaymentType = "cash" | "term";

type InstallmentRow = {
  days: string;
  percentage: string;
};

function defaultInstallments(): InstallmentRow[] {
  return [{ days: "30", percentage: "100" }];
}

type WizardStep = 1 | 2 | 3 | 4;

const wizardSteps: Array<{ id: WizardStep; label: string }> = [
  { id: 1, label: "Identificação" },
  { id: 2, label: "Itens" },
  { id: 3, label: "Condições" },
  { id: 4, label: "Revisão" }
];

function paymentSummaryText(paymentType: PaymentType, cashDiscountPercentage: string, installments: InstallmentRow[]) {
  if (paymentType === "cash") {
    const discount = Number(cashDiscountPercentage) || 0;
    return discount > 0 ? `À vista, ${discount}% de desconto` : "À vista";
  }
  const parts = installments
    .filter((installment) => Number(installment.percentage) > 0)
    .map((installment) => `${Number(installment.percentage) || 0}% em ${Number(installment.days) || 0}d`);
  return parts.length ? parts.join(" + ") : "A prazo";
}

function freightSummaryText(freightType: "NONE" | "INCLUDED" | "PAID", freightPrice: string) {
  if (freightType === "INCLUDED") return "Incluso no preço";
  if (freightType === "PAID") return `A pagar - ${formatCurrency(Number(freightPrice) || 0)}`;
  return "Sem frete";
}

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
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [cashDiscountPercentage, setCashDiscountPercentage] = useState("");
  const [installments, setInstallments] = useState<InstallmentRow[]>(() => defaultInstallments());
  const [freightType, setFreightType] = useState<"NONE" | "INCLUDED" | "PAID">("NONE");
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
    () => installments.reduce((sum, installment) => sum + (Number(installment.percentage) || 0), 0),
    [installments]
  );
  const cashPrice = useMemo(
    () => quotedTotal * (1 - Math.min(100, Math.max(0, Number(cashDiscountPercentage) || 0)) / 100),
    [quotedTotal, cashDiscountPercentage]
  );

  function addInstallment() {
    setInstallments((current) => [...current, { days: "", percentage: "" }]);
  }

  function removeInstallment(index: number) {
    setInstallments((current) => current.filter((_, current_index) => current_index !== index));
  }

  function updateInstallment(index: number, field: keyof InstallmentRow, value: string) {
    setInstallments((current) => current.map((installment, current_index) => (
      current_index === index ? { ...installment, [field]: value } : installment
    )));
  }
  const identityValid = Boolean(supplierName.trim()) && document.replace(/\D/g, "").length >= 11;
  const itemsValid = quotedCount > 0 && missingQuotedValues === 0;
  const canSubmit = identityValid && itemsValid;

  const stepValid: Record<WizardStep, boolean> = {
    1: identityValid,
    2: itemsValid,
    3: true,
    4: canSubmit
  };

  const stepMessages: Record<WizardStep, string> = {
    1: "Informe o CPF/CNPJ e a razão social ou nome do fornecedor para continuar.",
    2: "Marque ao menos um item e preencha valor e quantidade dele para continuar.",
    3: "",
    4: "Preencha fornecedor, CPF/CNPJ e valor dos itens marcados."
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
    const next = Math.min(4, step + 1) as WizardStep;
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
        })),
        commercialTerms: {
          paymentType,
          cashDiscountPercentage: Number(cashDiscountPercentage || 0),
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
          <strong>{items.length}<small>Itens</small></strong>
          <strong>{quotedCount}<small>Marcados</small></strong>
          <strong>{formatCurrency(quotedTotal)}<small>Total</small></strong>
        </div>
      </header>

      <nav className="supplier-stepper" ref={stepperRef}>
        {wizardSteps.map((item) => (
          <button
            key={item.id}
            type="button"
            className={step === item.id ? "active" : step > item.id ? "done" : item.id > maxStepReached ? "future" : ""}
            onClick={() => (item.id <= maxStepReached ? goToStep(item.id) : goNext())}
          >
            <i>{step > item.id ? "✓" : item.id}</i>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="supplier-public-main">
        <div className="supplier-public-stack">
          {step === 1 && (
            <section className="card supplier-portal-card supplier-identity-card">
              <div className="supplier-card-head">
                <span>Passo 1 de 4</span>
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
          )}

          {step === 2 && (
            <section className="card supplier-portal-card">
              <div className="supplier-card-head">
                <span>Passo 2 de 4</span>
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
                        <label><span>Prazo de entrega (dias)</span><input disabled={!current.attends} value={current.deadlineDays} onChange={(event) => updateItem(item.itemNumber, "deadlineDays", event.target.value)} type="number" min="0" /></label>
                        <label><span>Observação</span><input disabled={!current.attends} value={current.notes} onChange={(event) => updateItem(item.itemNumber, "notes", event.target.value)} /></label>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="card supplier-portal-card">
              <div className="supplier-card-head">
                <span>Passo 3 de 4</span>
                <h2>Pagamento e frete</h2>
              </div>

              <div className="supplier-payment-toggle">
                <button type="button" className={paymentType === "cash" ? "active" : ""} onClick={() => setPaymentType("cash")}>À vista</button>
                <button type="button" className={paymentType === "term" ? "active" : ""} onClick={() => setPaymentType("term")}>A prazo</button>
              </div>

              {paymentType === "cash" ? (
                <div className="supplier-portal-grid">
                  <label>
                    <span>Desconto à vista (%)</span>
                    <input value={cashDiscountPercentage} onChange={(event) => setCashDiscountPercentage(event.target.value)} type="number" min="0" max="100" step="0.1" placeholder="0" />
                  </label>
                  <div className="supplier-payment-preview">
                    <span>Preço à vista</span>
                    <strong>{formatCurrency(cashPrice)}</strong>
                  </div>
                </div>
              ) : (
                <div className="supplier-installments">
                  {installments.map((installment, index) => (
                    <div className="supplier-installment-row" key={index}>
                      <label>
                        <span>Dias</span>
                        <input value={installment.days} onChange={(event) => updateInstallment(index, "days", event.target.value)} type="number" min="0" placeholder="30" />
                      </label>
                      <label>
                        <span>% do valor</span>
                        <input value={installment.percentage} onChange={(event) => updateInstallment(index, "percentage", event.target.value)} type="number" min="0" max="100" step="0.1" placeholder="100" />
                      </label>
                      {installments.length > 1 && (
                        <button type="button" className="supplier-installment-remove" onClick={() => removeInstallment(index)}>Remover</button>
                      )}
                    </div>
                  ))}
                  <div className="supplier-installment-actions">
                    <button type="button" className="button secondary" onClick={addInstallment}>Adicionar parcela</button>
                    <span className={installmentsTotalPercentage === 100 ? "done" : "warn"}>Total: {installmentsTotalPercentage}%{installmentsTotalPercentage !== 100 ? " (deveria somar 100%)" : ""}</span>
                  </div>
                </div>
              )}

              <div className="supplier-portal-grid">
                <label>
                  <span>Frete</span>
                  <select value={freightType} onChange={(event) => setFreightType(event.target.value as "NONE" | "INCLUDED" | "PAID")}>
                    <option value="NONE">Sem frete</option>
                    <option value="INCLUDED">Incluso no preço</option>
                    <option value="PAID">A pagar à parte</option>
                  </select>
                </label>
                {freightType === "PAID" && (
                  <label>
                    <span>Valor do frete</span>
                    <input value={freightPrice} onChange={(event) => setFreightPrice(event.target.value)} type="number" min="0" step="0.01" placeholder="0,00" />
                  </label>
                )}
                <label className="supplier-general-notes">
                  <span>Observação geral da proposta</span>
                  <textarea value={generalNotes} onChange={(event) => setGeneralNotes(event.target.value)} placeholder="Condições adicionais, validade da proposta, etc." rows={2} />
                </label>
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="card supplier-portal-card">
              <div className="supplier-card-head">
                <span>Passo 4 de 4</span>
                <h2>Confira antes de enviar</h2>
              </div>

              <div className="supplier-review-section">
                <div className="supplier-review-section-head">
                  <h3>Identificação</h3>
                  <button type="button" className="supplier-review-edit" onClick={() => goToStep(1)}>Editar</button>
                </div>
                <div className="supplier-review-grid">
                  <span><strong>CPF/CNPJ</strong>{document ? formatDocument(document) : "Não informado"}</span>
                  <span><strong>Razão social / Nome</strong>{supplierName || "Não informado"}</span>
                  <span><strong>E-mail</strong>{email || "Não informado"}</span>
                  <span><strong>Telefone</strong>{phone || "Não informado"}</span>
                </div>
              </div>

              <div className="supplier-review-section">
                <div className="supplier-review-section-head">
                  <h3>Itens da cotação</h3>
                  <button type="button" className="supplier-review-edit" onClick={() => goToStep(2)}>Editar</button>
                </div>
                {quotedCount ? (
                  <div className="supplier-review-items">
                    <div className="supplier-review-items-row supplier-review-items-head">
                      <span>Insumo</span><span>Qtd.</span><span>Valor unit.</span><span>Total</span>
                    </div>
                    {responseItems.filter((item) => item.attends).map((item) => {
                      const original = items.find((current) => current.itemNumber === item.itemNumber);
                      return (
                        <div className="supplier-review-items-row" key={item.itemNumber}>
                          <span>{original?.name || `Item ${item.itemNumber}`}</span>
                          <span>{item.quantity} {original?.unit || ""}</span>
                          <span>{formatCurrency(Number(item.unitPrice || 0))}</span>
                          <strong>{formatCurrency(itemTotal(item))}</strong>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="table-muted">Nenhum item marcado.</p>
                )}
              </div>

              <div className="supplier-review-section">
                <div className="supplier-review-section-head">
                  <h3>Condições comerciais</h3>
                  <button type="button" className="supplier-review-edit" onClick={() => goToStep(3)}>Editar</button>
                </div>
                <div className="supplier-review-grid">
                  <span><strong>Pagamento</strong>{paymentSummaryText(paymentType, cashDiscountPercentage, installments)}</span>
                  <span><strong>Frete</strong>{freightSummaryText(freightType, freightPrice)}</span>
                </div>
                {generalNotes && <p className="quotation-response-notes">{generalNotes}</p>}
              </div>
            </section>
          )}

          <div className="card supplier-step-nav" ref={stepNavRef}>
            {stepMessage && <div className="settings-inline-message">{stepMessage}</div>}
            {message && <div className="settings-inline-message">{message}</div>}
            <div className={`supplier-step-actions ${step === 1 ? "single" : ""}`}>
              {step > 1 && (
                <button className="button secondary" type="button" onClick={goBack}>Voltar</button>
              )}
              {step < 4 ? (
                <button className="button" type="button" onClick={goNext}>Continuar</button>
              ) : (
                <button className="button" type="button" disabled={submitting || !canSubmit} onClick={submit}>
                  {submitting ? "Enviando..." : "Enviar proposta"}
                </button>
              )}
            </div>
          </div>
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
        </aside>
      </div>
    </section>
  );
}
