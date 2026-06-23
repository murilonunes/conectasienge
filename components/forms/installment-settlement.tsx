"use client";

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
          <label><span>Código do título no Sienge</span><input required type="number" min="1" value={billId} onChange={(e) => setBillId(e.target.value)} placeholder="Ex.: 1000" /></label>
          <button className="button" disabled={loading}>{loading ? "Consultando..." : "Buscar parcelas"}</button>
        </form>
        <p>A consulta mostra vencimento, valores original/corrigido, situação atual da parcela e dia da integração.</p>
      </section>
      {message && <div className="card data-notice"><strong>Consulta de parcelas</strong><span>{message}</span></div>}
      {bill && <section className="card bill-overview">
        <div className="bill-overview-head"><div><p className="eyebrow">Título #{bill.id || billId}</p><h2>{bill.documentIdentificationId}-{bill.documentNumber}</h2><span>{bill.notes || "Sem observações cadastradas"}</span></div><div><strong>{formatCurrency(bill.totalInvoiceAmount || 0)}</strong><span>Valor bruto do título</span></div></div>
        <div className="bill-overview-grid">
          <div><span>Empresa devedora</span><strong>#{bill.debtorId || "-"}</strong></div>
          <div><span>Credor</span><strong>#{bill.creditorId || "-"}</strong></div>
          <div><span>Emissão</span><strong>{bill.issueDate ? formatDate(bill.issueDate) : "-"}</strong></div>
          <div><span>Origem</span><strong>{bill.originId || "-"}</strong></div>
          <div><span>Parcelas</span><strong>{bill.installmentsNumber || installments.length}</strong></div>
          <div><span>Desconto</span><strong>{formatCurrency(bill.discount || 0)}</strong></div>
          <div><span>Consistência</span><strong>{bill.status === "S" ? "Completo" : bill.status === "I" ? "Em inclusão" : "Incompleto"}</strong></div>
          <div><span>Anexos</span><strong>{allocations.attachments.length}</strong></div>
          <div><span>Integração</span><strong><IntegrationStamp record={bill} /></strong></div>
        </div>
        {(allocations.budgetCategories.length > 0 || allocations.buildingsCost.length > 0 || allocations.departmentsCost.length > 0) && <div className="bill-allocations">
          <span>Apropriações vinculadas</span>
          <strong>{allocations.budgetCategories.length} financeiras</strong>
          <strong>{allocations.buildingsCost.length} obras</strong>
          <strong>{allocations.departmentsCost.length} departamentos</strong>
        </div>}
      </section>}
      <section className="settlement-grid">
        {installments.map((installment) => {
          const review = analyzePayableCharge(installment);
          return (
            <article className="card settlement-card" key={installment.installmentNumber}>
              <div className="settlement-top"><span>Parcela {installment.installmentNumber}</span><span className={`badge ${installment.situation === "Totalmente paga" ? "" : "pending"}`}>{installment.situation || "Situação não informada"}</span></div>
              <strong>{formatCurrency(review.correctedAmount)}</strong>
              <dl>
                <div><dt>Valor original</dt><dd>{formatCurrency(review.originalAmount)}</dd></div>
                <div><dt>Valor corrigido</dt><dd>{formatCurrency(review.correctedAmount)}</dd></div>
                <div><dt>Acréscimo corrigido</dt><dd>{formatCurrency(review.correctedIncrease)}</dd></div>
                <div><dt>Multa/juros pagos a mais</dt><dd>{formatCurrency(review.paidIncrease)}</dd></div>
                <div><dt>Vencimento</dt><dd>{formatDate(installment.dueDate)}</dd></div>
                <div><dt>Competência</dt><dd>{installment.billDate ? formatDate(installment.billDate) : "Não informada"}</dd></div>
                <div><dt>Data-base</dt><dd>{installment.baseDate ? formatDate(installment.baseDate) : "Não informada"}</dd></div>
                <div><dt>Indexador</dt><dd>{installment.indexId ? `#${installment.indexId}` : "Não informado"}</dd></div>
                <div><dt>Forma</dt><dd>{installment.paymentType || (installment.paymentTypeId ? `#${installment.paymentTypeId}` : "Não informada")}</dd></div>
                <div><dt>Enviada ao banco</dt><dd>{installment.sentToBank ? "Sim" : "Não"}</dd></div>
                <div><dt>Lote bancário</dt><dd>{installment.batchNumber || "Não gerado"}</dd></div>
                <div><dt>Integração</dt><dd><IntegrationStamp record={installment} /></dd></div>
              </dl>
              <PayableChargeReviewButton item={installment} title={`Título #${bill?.id || billId} / Parcela ${installment.installmentNumber}`} />
            </article>
          );
        })}
      </section>
      <div className="card settlement-notice"><strong>Consulta operacional</strong><p>Esta tela confere parcelas, vencimentos, valores, integrações e baixas já registradas no banco local. Alterações de instrução de pagamento e baixa financeira devem ser feitas diretamente no Sienge.</p></div>
    </>
  );
}
