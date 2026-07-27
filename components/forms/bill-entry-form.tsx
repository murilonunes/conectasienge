"use client";

import { I18nText } from "@/components/i18n/i18n-text";
import { FormEvent, useMemo, useState } from "react";
import { SiengeSupplierPicker } from "@/components/suppliers/sienge-supplier-picker";
import { formatCurrency, formatDate } from "@/lib/formatters";

type FormData = {
  debtorId: string;
  creditorId: string;
  documentIdentificationId: string;
  documentNumber: string;
  issueDate: string;
  baseDate: string;
  billDate: string;
  dueDate: string;
  indexId: string;
  installmentsNumber: string;
  totalInvoiceAmount: string;
  discount: string;
  notes: string;
};

const today = new Date().toISOString().slice(0, 10);
const initialData: FormData = {
  debtorId: "", creditorId: "", documentIdentificationId: "NF", documentNumber: "",
  issueDate: today, baseDate: today, billDate: today, dueDate: today,
  indexId: "1", installmentsNumber: "1", totalInvoiceAmount: "", discount: "0", notes: ""
};

export function BillEntryForm() {
  const [data, setData] = useState(initialData);
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string }>();
  const netAmount = useMemo(() => Number(data.totalInvoiceAmount || 0) - Number(data.discount || 0), [data]);

  const update = (field: keyof FormData, value: string) => setData((current) => ({ ...current, [field]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!reviewing) {
      setReviewing(true);
      setResult(undefined);
      return;
    }
    setSubmitting(true);
    setResult(undefined);
    try {
      const response = await fetch("/api/sienge/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.suggestion || body.apiMessage || body.message || body.title || "Não foi possível criar o título.");
      setResult({ type: "success", message: body.message });
      setData(initialData);
      setReviewing(false);
    } catch (error) {
      setResult({ type: "error", message: error instanceof Error ? error.message : "Erro inesperado." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="operation-layout">
      <section className="card operation-card">
        <div className="form-section-head"><span><I18nText text={"01"} /></span><div><h2><I18nText text={"Identificação do título"} /></h2><p><I18nText text={"Códigos conforme cadastrados no Sienge."} /></p></div></div>
        <div className="form-grid">
          <label><span><I18nText text={"Empresa devedora *"} /></span><input required type="number" min="1" value={data.debtorId} onChange={(e) => update("debtorId", e.target.value)} placeholder="Código da empresa" data-i18n-placeholder={"Código da empresa"} /></label>
          <SiengeSupplierPicker value={data.creditorId} onChange={(next) => update("creditorId", next)} label="Credor" required compact />
          <label><span><I18nText text={"Código do documento *"} /></span><input required value={data.documentIdentificationId} onChange={(e) => update("documentIdentificationId", e.target.value.toUpperCase())} placeholder="NF" data-i18n-placeholder={"NF"} /></label>
          <label><span><I18nText text={"Número do documento *"} /></span><input required value={data.documentNumber} onChange={(e) => update("documentNumber", e.target.value)} placeholder="Ex.: 2026-0042" data-i18n-placeholder={"Ex.: 2026-0042"} /></label>
        </div>
      </section>

      <section className="card operation-card">
        <div className="form-section-head"><span><I18nText text={"02"} /></span><div><h2><I18nText text={"Datas e parcelamento"} /></h2><p><I18nText text={"O Sienge gerará as parcelas com base nestas informações."} /></p></div></div>
        <div className="form-grid three">
          <label><span><I18nText text={"Emissão *"} /></span><input required type="date" value={data.issueDate} onChange={(e) => update("issueDate", e.target.value)} /></label>
          <label><span><I18nText text={"Competência *"} /></span><input required type="date" value={data.billDate} onChange={(e) => update("billDate", e.target.value)} /></label>
          <label><span><I18nText text={"Data-base *"} /></span><input required type="date" value={data.baseDate} onChange={(e) => update("baseDate", e.target.value)} /></label>
          <label><span><I18nText text={"Primeiro vencimento *"} /></span><input required type="date" value={data.dueDate} onChange={(e) => update("dueDate", e.target.value)} /></label>
          <label><span><I18nText text={"Quantidade de parcelas *"} /></span><input required type="number" min="1" value={data.installmentsNumber} onChange={(e) => update("installmentsNumber", e.target.value)} /></label>
          <label><span><I18nText text={"Indexador *"} /></span><input required type="number" min="1" value={data.indexId} onChange={(e) => update("indexId", e.target.value)} /></label>
        </div>
      </section>

      <section className="card operation-card">
        <div className="form-section-head"><span><I18nText text={"03"} /></span><div><h2><I18nText text={"Valores e observações"} /></h2><p><I18nText text={"Confira os valores antes de enviar."} /></p></div></div>
        <div className="form-grid">
          <label><span><I18nText text={"Valor bruto *"} /></span><input required type="number" min="0.01" step="0.01" value={data.totalInvoiceAmount} onChange={(e) => update("totalInvoiceAmount", e.target.value)} placeholder="0,00" data-i18n-placeholder={"0,00"} /></label>
          <label><span><I18nText text={"Desconto"} /></span><input type="number" min="0" step="0.01" value={data.discount} onChange={(e) => update("discount", e.target.value)} /></label>
          <label className="full-field"><span><I18nText text={"Observações"} /></span><textarea maxLength={500} value={data.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Informações adicionais do título" data-i18n-placeholder={"Informações adicionais do título"} /></label>
        </div>
      </section>

      <aside className="card operation-summary">
        <p className="eyebrow"><I18nText text={reviewing ? "Revisão final" : "Resumo"} /></p>
        <h2>{formatCurrency(netAmount)}</h2>
        <dl>
          <div><dt><I18nText text={"Documento"} /></dt><dd>{data.documentIdentificationId}<I18nText text={"-"} />{data.documentNumber || <I18nText text={"-"} />}</dd></div>
          <div><dt><I18nText text={"Credor"} /></dt><dd><I18nText text={"#"} />{data.creditorId || <I18nText text={"-"} />}</dd></div>
          <div><dt><I18nText text={"Vencimento"} /></dt><dd>{data.dueDate ? formatDate(data.dueDate) : <I18nText text={"-"} />}</dd></div>
          <div><dt><I18nText text={"Parcelas"} /></dt><dd>{data.installmentsNumber}</dd></div>
        </dl>
        {reviewing && <div className="operation-warning"><strong><I18nText text={"Ação real"} /></strong><span><I18nText text={"Ao confirmar, um título será criado no Sienge."} /></span></div>}
        {result && <div className={`form-result ${result.type}`}><I18nText text={result.message} /></div>}
        <button className="button operation-submit" disabled={submitting}>{submitting ? <I18nText text={"Enviando..."} /> : reviewing ? <I18nText text={"Confirmar lançamento"} /> : <I18nText text={"Revisar lançamento"} />}</button>
        {reviewing && <button type="button" className="button secondary operation-submit" onClick={() => setReviewing(false)}><I18nText text={"Voltar e editar"} /></button>}
      </aside>
    </form>
  );
}
