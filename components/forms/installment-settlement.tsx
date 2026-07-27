"use client";

import { I18nText } from "@/components/i18n/i18n-text";
import { FormEvent, useState } from "react";
import { PayableChargeReviewButton } from "@/components/payables/payable-charge-review-button";
import { IntegrationStamp } from "@/components/ui/integration-stamp";
import { analyzePayableCharge } from "@/lib/payables-abuse-analysis";
import { formatCurrency, formatDate } from "@/lib/formatters";

type Payment = {
  amount?: number;
  grossAmount?: number;
  netAmount?: number;
  paymentDate?: string;
};

type Installment = {
  installmentNumber: number;
  dueDate: string;
  baseDate?: string;
  billDate?: string;
  amount: number;
  originalAmount?: number;
  balanceAmount?: number;
  correctedBalanceAmount?: number;
  indexId?: number;
  paymentTypeId?: number;
  situation?: string;
  paymentType?: string;
  authorizationStatus?: string;
  payments?: Payment[];
  sentToBank?: boolean;
  batchNumber?: number;
  __siengeIntegrationDay?: string;
  __siengeIntegratedAt?: string;
};

type BillDetails = {
  id?: number;
  debtorId?: number;
  creditorId?: number;
  documentIdentificationId?: string;
  documentNumber?: string;
  issueDate?: string;
  installmentsNumber?: number;
  totalInvoiceAmount?: number;
  discount?: number;
  status?: string;
  originId?: string;
  notes?: string;
  registeredBy?: string;
  registeredDate?: string;
  __siengeIntegrationDay?: string;
  __siengeIntegratedAt?: string;
};

type NamedAllocation = { costCenterName?: string; financialCategoryName?: string; buildingName?: string; buildingUnitName?: string; name?: string; percentage?: number; rate?: number };

export function InstallmentSettlement() {
  const [billId, setBillId] = useState("");
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [bill, setBill] = useState<BillDetails>();
  const [allocations, setAllocations] = useState<{ budgetCategories: NamedAllocation[]; buildingsCost: NamedAllocation[]; departmentsCost: NamedAllocation[]; attachments: unknown[] }>({ budgetCategories: [], buildingsCost: [], departmentsCost: [], attachments: [] });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function search(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setInstallments([]);
    setBill(undefined);
    try {
      const response = await fetch(`/api/sienge/bills/${billId}/installments`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.suggestion || body.apiMessage || body.message || body.title || "Consulta não concluída.");
      setInstallments(body.installments || []);
      setBill(body.bill);
      setAllocations({ budgetCategories: body.budgetCategories || [], buildingsCost: body.buildingsCost || [], departmentsCost: body.departmentsCost || [], attachments: body.attachments || [] });
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
          <label><span><I18nText text={"Código do título no Sienge"} /></span><input required type="number" min="1" value={billId} onChange={(e) => setBillId(e.target.value)} placeholder="Ex.: 1000" data-i18n-placeholder={"Ex.: 1000"} /></label>
          <button className="button" disabled={loading}><I18nText text={loading ? "Consultando..." : "Buscar parcelas"} /></button>
        </form>
        <p><I18nText text={"A consulta mostra vencimento, valores original/corrigido, situação atual da parcela e dia da integração."} /></p>
      </section>
      {message && <div className="card data-notice"><strong><I18nText text={"Consulta de parcelas"} /></strong><span><I18nText text={message} /></span></div>}
      {bill && <section className="card bill-overview">
        <div className="bill-overview-head"><div><p className="eyebrow"><I18nText text={"Título #"} />{bill.id || billId}</p><h2>{bill.documentIdentificationId}<I18nText text={"-"} />{bill.documentNumber}</h2><span>{bill.notes || <I18nText text={"Sem observações cadastradas"} />}</span></div><div><strong>{formatCurrency(bill.totalInvoiceAmount || 0)}</strong><span><I18nText text={"Valor bruto do título"} /></span></div></div>
        <div className="bill-overview-grid">
          <div><span><I18nText text={"Empresa devedora"} /></span><strong><I18nText text={"#"} />{bill.debtorId || <I18nText text={"-"} />}</strong></div>
          <div><span><I18nText text={"Credor"} /></span><strong><I18nText text={"#"} />{bill.creditorId || <I18nText text={"-"} />}</strong></div>
          <div><span><I18nText text={"Emissão"} /></span><strong>{bill.issueDate ? formatDate(bill.issueDate) : <I18nText text={"-"} />}</strong></div>
          <div><span><I18nText text={"Origem"} /></span><strong>{bill.originId || <I18nText text={"-"} />}</strong></div>
          <div><span><I18nText text={"Parcelas"} /></span><strong>{bill.installmentsNumber || installments.length}</strong></div>
          <div><span><I18nText text={"Desconto"} /></span><strong>{formatCurrency(bill.discount || 0)}</strong></div>
          <div><span><I18nText text={"Consistência"} /></span><strong>{bill.status === "S" ? <I18nText text={"Completo"} /> : bill.status === "I" ? <I18nText text={"Em inclusão"} /> : <I18nText text={"Incompleto"} />}</strong></div>
          <div><span><I18nText text={"Anexos"} /></span><strong>{allocations.attachments.length}</strong></div>
          <div><span><I18nText text={"Integração"} /></span><strong><IntegrationStamp record={bill} /></strong></div>
        </div>
        {(allocations.budgetCategories.length > 0 || allocations.buildingsCost.length > 0 || allocations.departmentsCost.length > 0) && <div className="bill-allocations">
          <span><I18nText text={"Apropriações vinculadas"} /></span>
          <strong>{allocations.budgetCategories.length} <I18nText text={"financeiras"} /></strong>
          <strong>{allocations.buildingsCost.length} <I18nText text={"obras"} /></strong>
          <strong>{allocations.departmentsCost.length} <I18nText text={"departamentos"} /></strong>
        </div>}
      </section>}
      <section className="settlement-grid">
        {installments.map((installment) => {
          const review = analyzePayableCharge(installment);
          return (
            <article className="card settlement-card" key={installment.installmentNumber}>
              <div className="settlement-top"><span><I18nText text={"Parcela"} /> {installment.installmentNumber}</span><span className={`badge ${installment.situation === "Totalmente paga" ? "" : "pending"}`}>{installment.situation || <I18nText text={"Situação não informada"} />}</span></div>
              <strong>{formatCurrency(review.correctedAmount)}</strong>
              <dl>
                <div><dt><I18nText text={"Valor original"} /></dt><dd>{formatCurrency(review.originalAmount)}</dd></div>
                <div><dt><I18nText text={"Valor corrigido"} /></dt><dd>{formatCurrency(review.correctedAmount)}</dd></div>
                <div><dt><I18nText text={"Acréscimo corrigido"} /></dt><dd>{formatCurrency(review.correctedIncrease)}</dd></div>
                <div><dt><I18nText text={"Multa/juros pagos a mais"} /></dt><dd>{formatCurrency(review.paidIncrease)}</dd></div>
                <div><dt><I18nText text={"Vencimento"} /></dt><dd>{formatDate(installment.dueDate)}</dd></div>
                <div><dt><I18nText text={"Competência"} /></dt><dd>{installment.billDate ? formatDate(installment.billDate) : <I18nText text={"Não informada"} />}</dd></div>
                <div><dt><I18nText text={"Data-base"} /></dt><dd>{installment.baseDate ? formatDate(installment.baseDate) : <I18nText text={"Não informada"} />}</dd></div>
                <div><dt><I18nText text={"Indexador"} /></dt><dd>{installment.indexId ? `#${installment.indexId}` : <I18nText text={"Não informado"} />}</dd></div>
                <div><dt><I18nText text={"Forma"} /></dt><dd>{installment.paymentType || (installment.paymentTypeId ? `#${installment.paymentTypeId}` : <I18nText text={"Não informada"} />)}</dd></div>
                <div><dt><I18nText text={"Enviada ao banco"} /></dt><dd><I18nText text={installment.sentToBank ? "Sim" : "Não"} /></dd></div>
                <div><dt><I18nText text={"Lote bancário"} /></dt><dd>{installment.batchNumber || <I18nText text={"Não gerado"} />}</dd></div>
                <div><dt><I18nText text={"Integração"} /></dt><dd><IntegrationStamp record={installment} /></dd></div>
              </dl>
              <PayableChargeReviewButton item={installment} title={`Título #${bill?.id || billId} / Parcela ${installment.installmentNumber}`} />
            </article>
          );
        })}
      </section>
      <div className="card settlement-notice"><strong><I18nText text={"Consulta operacional"} /></strong><p><I18nText text={"Esta tela confere parcelas, vencimentos, valores, integrações e baixas já registradas no banco local. Alterações de instrução de pagamento e baixa financeira devem ser feitas diretamente no Sienge."} /></p></div>
    </>
  );
}
