"use client";

import { I18nText } from "@/components/i18n/i18n-text";
import { FormEvent, useState } from "react";
import { IntegrationStamp } from "@/components/ui/integration-stamp";
import { formatCurrency, formatDate, formatOptionalDate } from "@/lib/formatters";

type Receipt = {
  grossAmount?: number;
  netAmount?: number;
  paymentDate?: string;
  calculationDate?: string;
  operationTypeName?: string;
  sequencialNumber?: number;
  registeredUserName?: string;
  registeredAt?: string;
  changedUserName?: string;
  changedAt?: string;
  auditSource?: string;
};

type Installment = {
  installmentNumber: number | string;
  installmentId: number;
  dueDate?: string;
  baseDate?: string;
  billDate?: string;
  issueDate?: string;
  amount: number;
  originalAmount?: number;
  balanceAmount?: number;
  correctedBalanceAmount?: number;
  discountAmount?: number;
  taxAmount?: number;
  documentForecast?: string;
  bearerId?: number;
  situation?: string;
  receipts?: Receipt[];
  __siengeIntegrationDay?: string;
  __siengeIntegratedAt?: string;
};

type BillDetails = {
  id?: number;
  companyId?: number;
  companyName?: string;
  clientId?: number;
  clientName?: string;
  projectId?: number;
  projectName?: string;
  businessAreaName?: string;
  documentIdentificationId?: string;
  documentNumber?: string;
  issueDate?: string;
  installmentsNumber?: number;
  totalInvoiceAmount?: number;
  discount?: number;
  originId?: string;
  mainUnit?: string;
  __siengeIntegrationDay?: string;
  __siengeIntegratedAt?: string;
};

function receiptValue(receipt: Receipt) {
  return receipt.netAmount || receipt.grossAmount || 0;
}

function openAmount(installment: Installment) {
  if (typeof installment.correctedBalanceAmount === "number") return installment.correctedBalanceAmount;
  if (typeof installment.balanceAmount === "number") return installment.balanceAmount;
  return installment.originalAmount || installment.amount || 0;
}

function formatDateTime(value?: string) {
  if (!value) return undefined;
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function ReceivableSettlement() {
  const [billId, setBillId] = useState("");
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [bill, setBill] = useState<BillDetails>();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState({ receiptsCategories: 0, bankMovements: 0 });

  async function search(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setInstallments([]);
    setBill(undefined);
    setMetadata({ receiptsCategories: 0, bankMovements: 0 });
    try {
      const response = await fetch(`/api/sienge/receivable-bills/${billId}/installments`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.suggestion || body.apiMessage || body.message || body.title || "Consulta não concluída.");
      setInstallments(body.installments || []);
      setBill(body.bill);
      setMetadata({
        receiptsCategories: body.receiptsCategories?.length || 0,
        bankMovements: body.bankMovements?.length || 0
      });
      if (!body.installments?.length) setMessage("Nenhuma parcela foi encontrada para este título.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="card settlement-search">
        <form onSubmit={search}>
          <label><span><I18nText text={"Código do título a receber no Sienge"} /></span><input required type="number" min="1" value={billId} onChange={(event) => setBillId(event.target.value)} placeholder="Ex.: 1000" data-i18n-placeholder={"Ex.: 1000"} /></label>
          <button className="button" disabled={loading}><I18nText text={loading ? "Consultando..." : "Buscar parcelas"} /></button>
        </form>
        <p><I18nText text={"A consulta mostra vencimento, saldo a receber, recebimentos já registrados e dia da integração."} /></p>
      </section>
      {message && <div className="card data-notice"><strong><I18nText text={"Consulta de parcelas"} /></strong><span><I18nText text={message} /></span></div>}
      {bill && <section className="card bill-overview">
        <div className="bill-overview-head">
          <div>
            <p className="eyebrow"><I18nText text={"Título a receber #"} />{bill.id || billId}</p>
            <h2>{[bill.documentIdentificationId, bill.documentNumber].filter(Boolean).join("-") || <I18nText text={"Documento não informado"} />}</h2>
            <span>{bill.clientName || `Cliente #${bill.clientId || "não informado"}`}</span>
          </div>
          <div><strong>{formatCurrency(bill.totalInvoiceAmount || 0)}</strong><span><I18nText text={"Valor bruto do título"} /></span></div>
        </div>
        <div className="bill-overview-grid">
          <div><span><I18nText text={"Empresa"} /></span><strong>{bill.companyName || `#${bill.companyId || "-"}`}</strong></div>
          <div><span><I18nText text={"Cliente"} /></span><strong>{bill.clientName || `#${bill.clientId || "-"}`}</strong></div>
          <div><span><I18nText text={"Projeto"} /></span><strong>{bill.projectName || bill.businessAreaName || `#${bill.projectId || "-"}`}</strong></div>
          <div><span><I18nText text={"Unidade"} /></span><strong>{bill.mainUnit || <I18nText text={"-"} />}</strong></div>
          <div><span><I18nText text={"Emissão"} /></span><strong>{bill.issueDate ? formatDate(bill.issueDate) : <I18nText text={"-"} />}</strong></div>
          <div><span><I18nText text={"Origem"} /></span><strong>{bill.originId || <I18nText text={"-"} />}</strong></div>
          <div><span><I18nText text={"Parcelas"} /></span><strong>{bill.installmentsNumber || installments.length}</strong></div>
          <div><span><I18nText text={"Desconto"} /></span><strong>{formatCurrency(bill.discount || 0)}</strong></div>
          <div><span><I18nText text={"Integração"} /></span><strong><IntegrationStamp record={bill} /></strong></div>
        </div>
        <div className="bill-allocations">
          <span><I18nText text={"Dados vinculados"} /></span>
          <strong>{metadata.receiptsCategories} <I18nText text={"apropriação(ões)"} /></strong>
          <strong>{metadata.bankMovements} <I18nText text={"movimento(s) bancário(s)"} /></strong>
        </div>
      </section>}
      <section className="settlement-grid">
        {installments.map((installment) => {
          const receipts = installment.receipts || [];
          const received = receipts.reduce((sum, receipt) => sum + receiptValue(receipt), 0);
          return (
            <article className="card settlement-card" key={installment.installmentId || installment.installmentNumber}>
              <div className="settlement-top"><span><I18nText text={"Parcela"} /> {installment.installmentNumber}</span><span className={`badge ${receipts.length ? "" : "pending"}`}>{installment.situation || <I18nText text={"Situação não informada"} />}</span></div>
              <strong>{formatCurrency(openAmount(installment))}</strong>
              <dl>
                <div><dt><I18nText text={"Valor original"} /></dt><dd>{formatCurrency(installment.originalAmount || installment.amount || 0)}</dd></div>
                <div><dt><I18nText text={"Saldo a receber"} /></dt><dd>{formatCurrency(openAmount(installment))}</dd></div>
                <div><dt><I18nText text={"Recebido"} /></dt><dd>{formatCurrency(received)}</dd></div>
                <div><dt><I18nText text={"Vencimento"} /></dt><dd>{formatOptionalDate(installment.dueDate)}</dd></div>
                <div><dt><I18nText text={"Competência"} /></dt><dd>{formatOptionalDate(installment.billDate)}</dd></div>
                <div><dt><I18nText text={"Data-base"} /></dt><dd>{formatOptionalDate(installment.baseDate)}</dd></div>
                <div><dt><I18nText text={"Previsão"} /></dt><dd><I18nText text={installment.documentForecast === "S" ? "Sim" : "Não"} /></dd></div>
                <div><dt><I18nText text={"Portador"} /></dt><dd>{installment.bearerId ? `#${installment.bearerId}` : <I18nText text={"Não informado"} />}</dd></div>
                <div><dt><I18nText text={"Integração"} /></dt><dd><IntegrationStamp record={installment} /></dd></div>
              </dl>
              <div className="payments-list">
                <h3><I18nText text={"Recebimentos"} /></h3>
                {receipts.length ? receipts.map((receipt, index) => (
                  <div key={`${receipt.sequencialNumber}-${index}`}>
                    <span>{receipt.paymentDate ? formatDate(receipt.paymentDate) : <I18nText text={"Sem data"} />}</span>
                    <strong>{formatCurrency(receiptValue(receipt))}</strong>
                    <span>{receipt.operationTypeName || <I18nText text={"Operação não informada"} />}</span>
                    <small>{receipt.calculationDate ? `Cálculo em ${formatDate(receipt.calculationDate)}` : <I18nText text={"Data de cálculo não informada"} />}</small>
                    <div className={receipt.registeredAt ? "receipt-audit" : "receipt-audit muted"}>
                      <span><I18nText text={"Cadastro da baixa"} /></span>
                      <strong>
                        {receipt.registeredAt
                          ? `${formatDateTime(receipt.registeredAt)}${receipt.registeredUserName ? ` por ${receipt.registeredUserName}` : ""}`
                          : <I18nText text={"Não disponível na API pública"} />}
                      </strong>
                    </div>
                  </div>
                )) : <p><I18nText text={"Nenhum recebimento retornado para esta parcela."} /></p>}
              </div>
              <button className="button secondary" type="button" disabled><I18nText text={"Baixa pela API indisponível"} /></button>
            </article>
          );
        })}
      </section>
      <div className="card settlement-notice">
        <strong><I18nText text={"Baixa de contas a receber"} /></strong>
        <p><I18nText text={"A especificação pública disponível permite consultar títulos, parcelas e recebimentos já registrados, mas não expõe um endpoint seguro para efetivar a baixa de contas a receber. Por isso, esta tela consulta e confere os recebimentos; a baixa operacional precisa ser feita no Sienge."} /></p>
      </div>
    </>
  );
}
