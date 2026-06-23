"use client";

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
      const response = await fetch(`/api/sienge/receivable-bills/${billId}/installments`);
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
          <label><span>Código do título a receber no Sienge</span><input required type="number" min="1" value={billId} onChange={(event) => setBillId(event.target.value)} placeholder="Ex.: 1000" /></label>
          <button className="button" disabled={loading}>{loading ? "Consultando..." : "Buscar parcelas"}</button>
        </form>
        <p>A consulta mostra vencimento, saldo a receber, recebimentos já registrados e dia da integração.</p>
      </section>
      {message && <div className="card data-notice"><strong>Consulta de parcelas</strong><span>{message}</span></div>}
      {bill && <section className="card bill-overview">
        <div className="bill-overview-head">
          <div>
            <p className="eyebrow">Título a receber #{bill.id || billId}</p>
            <h2>{[bill.documentIdentificationId, bill.documentNumber].filter(Boolean).join("-") || "Documento não informado"}</h2>
            <span>{bill.clientName || `Cliente #${bill.clientId || "não informado"}`}</span>
          </div>
          <div><strong>{formatCurrency(bill.totalInvoiceAmount || 0)}</strong><span>Valor bruto do título</span></div>
        </div>
        <div className="bill-overview-grid">
          <div><span>Empresa</span><strong>{bill.companyName || `#${bill.companyId || "-"}`}</strong></div>
          <div><span>Cliente</span><strong>{bill.clientName || `#${bill.clientId || "-"}`}</strong></div>
          <div><span>Projeto</span><strong>{bill.projectName || bill.businessAreaName || `#${bill.projectId || "-"}`}</strong></div>
          <div><span>Unidade</span><strong>{bill.mainUnit || "-"}</strong></div>
          <div><span>Emissão</span><strong>{bill.issueDate ? formatDate(bill.issueDate) : "-"}</strong></div>
          <div><span>Origem</span><strong>{bill.originId || "-"}</strong></div>
          <div><span>Parcelas</span><strong>{bill.installmentsNumber || installments.length}</strong></div>
          <div><span>Desconto</span><strong>{formatCurrency(bill.discount || 0)}</strong></div>
          <div><span>Integração</span><strong><IntegrationStamp record={bill} /></strong></div>
        </div>
        <div className="bill-allocations">
          <span>Dados vinculados</span>
          <strong>{metadata.receiptsCategories} apropriação(ões)</strong>
          <strong>{metadata.bankMovements} movimento(s) bancário(s)</strong>
        </div>
      </section>}
      <section className="settlement-grid">
        {installments.map((installment) => {
          const receipts = installment.receipts || [];
          const received = receipts.reduce((sum, receipt) => sum + receiptValue(receipt), 0);
          return (
            <article className="card settlement-card" key={installment.installmentId || installment.installmentNumber}>
              <div className="settlement-top"><span>Parcela {installment.installmentNumber}</span><span className={`badge ${receipts.length ? "" : "pending"}`}>{installment.situation || "Situação não informada"}</span></div>
              <strong>{formatCurrency(openAmount(installment))}</strong>
              <dl>
                <div><dt>Valor original</dt><dd>{formatCurrency(installment.originalAmount || installment.amount || 0)}</dd></div>
                <div><dt>Saldo a receber</dt><dd>{formatCurrency(openAmount(installment))}</dd></div>
                <div><dt>Recebido</dt><dd>{formatCurrency(received)}</dd></div>
                <div><dt>Vencimento</dt><dd>{formatOptionalDate(installment.dueDate)}</dd></div>
                <div><dt>Competência</dt><dd>{formatOptionalDate(installment.billDate)}</dd></div>
                <div><dt>Data-base</dt><dd>{formatOptionalDate(installment.baseDate)}</dd></div>
                <div><dt>Previsão</dt><dd>{installment.documentForecast === "S" ? "Sim" : "Não"}</dd></div>
                <div><dt>Portador</dt><dd>{installment.bearerId ? `#${installment.bearerId}` : "Não informado"}</dd></div>
                <div><dt>Integração</dt><dd><IntegrationStamp record={installment} /></dd></div>
              </dl>
              <div className="payments-list">
                <h3>Recebimentos</h3>
                {receipts.length ? receipts.map((receipt, index) => (
                  <div key={`${receipt.sequencialNumber}-${index}`}>
                    <span>{receipt.paymentDate ? formatDate(receipt.paymentDate) : "Sem data"}</span>
                    <strong>{formatCurrency(receiptValue(receipt))}</strong>
                    <span>{receipt.operationTypeName || "Operação não informada"}</span>
                    <small>{receipt.calculationDate ? `Cálculo em ${formatDate(receipt.calculationDate)}` : "Data de cálculo não informada"}</small>
                  </div>
                )) : <p>Nenhum recebimento retornado para esta parcela.</p>}
              </div>
              <button className="button secondary" type="button" disabled>Baixa pela API indisponível</button>
            </article>
          );
        })}
      </section>
      <div className="card settlement-notice">
        <strong>Baixa de contas a receber</strong>
        <p>A especificação pública disponível permite consultar títulos, parcelas e recebimentos já registrados, mas não expõe um endpoint seguro para efetivar a baixa de contas a receber. Por isso, esta tela consulta e confere os recebimentos; a baixa operacional precisa ser feita no Sienge.</p>
      </div>
    </>
  );
}
