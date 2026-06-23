"use client";

import { IntegrationStamp } from "@/components/ui/integration-stamp";
import { LocalDataList } from "@/components/ui/local-data-list";
import { formatCurrency, formatOptionalDate } from "@/lib/formatters";

type ReceivableReceipt = {
  grossAmount?: number;
  netAmount?: number;
};

type ReceivableInstallment = {
  companyId?: number;
  companyName?: string;
  projectId?: number;
  projectName?: string;
  businessAreaName?: string;
  clientId?: number;
  clientName?: string;
  billId?: number;
  receivableBillId?: number;
  installmentId?: number;
  documentIdentificationId?: string;
  documentNumber?: string;
  documentForecast?: string;
  originalAmount?: number;
  balanceAmount?: number;
  correctedBalanceAmount?: number;
  dueDate?: string;
  mainUnit?: string;
  installmentNumber?: string;
  receipts?: ReceivableReceipt[];
  __siengeIntegrationDay?: string;
  __siengeIntegratedAt?: string;
};

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function receivableOpenAmount(entry: ReceivableInstallment) {
  const corrected = numberValue(entry.correctedBalanceAmount);
  if (corrected !== undefined) return corrected;
  const balance = numberValue(entry.balanceAmount);
  if (balance !== undefined) return balance;
  return numberValue(entry.originalAmount) ?? 0;
}

function receivablePaidAmount(entry: ReceivableInstallment) {
  return (entry.receipts || []).reduce((sum, receipt) => {
    const value = numberValue(receipt.netAmount) ?? numberValue(receipt.grossAmount) ?? 0;
    return sum + value;
  }, 0);
}

function receivableDocument(entry: ReceivableInstallment) {
  const title = entry.billId || entry.receivableBillId;
  const document = [entry.documentIdentificationId, entry.documentNumber].filter(Boolean).join(" - ");
  return document || (title ? `Título #${title}` : "Título sem número");
}

function receivableStatus(entry: ReceivableInstallment) {
  const amount = receivableOpenAmount(entry);
  if (amount <= 0) return "Recebido";
  const dueDate = parseDate(entry.dueDate);
  if (!dueDate) return "Sem vencimento";
  const today = parseDate(new Date().toISOString().slice(0, 10)) || new Date();
  if (dueDate < today) return "Em atraso";
  if (entry.documentForecast === "S") return "Previsto";
  return "A receber";
}

function titleNumber(entry: ReceivableInstallment) {
  return entry.billId || entry.receivableBillId || "sem número";
}

function badgeClass(status: string) {
  if (status === "Em atraso") return "badge late";
  if (status === "Previsto" || status === "Sem vencimento") return "badge pending";
  return "badge";
}

export function ReceivablesForecastTable({
  entries,
  totalEntries = entries.length
}: {
  entries: ReceivableInstallment[];
  totalEntries?: number;
}) {
  return (
    <section className="card table-card">
      <div className="panel-head table-head">
        <div>
          <h2 className="panel-title">Parcelas previstas a receber</h2>
          <span className="panel-note">
            {entries.length < totalEntries
              ? `Exibindo ${entries.length} de ${totalEntries} parcelas abertas por vencimento`
              : `${entries.length} parcelas abertas por vencimento`}
          </span>
        </div>
      </div>
      <LocalDataList
        items={entries}
        itemLabel="parcelas"
        emptyMessage="Nenhuma parcela aberta encontrada para a previsão."
        renderItems={(pageItems) => (
          <table>
            <thead>
              <tr>
                <th>Título</th>
                <th>Cliente</th>
                <th>Vencimento</th>
                <th>Projeto / unidade</th>
                <th>Valor em aberto</th>
                <th>Recebido</th>
                <th>Situação</th>
                <th>Integração</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((entry) => {
                const status = receivableStatus(entry);
                return (
                  <tr key={`${entry.billId || entry.receivableBillId || "bill"}-${entry.installmentId || "installment"}-${entry.dueDate || "date"}`}>
                    <td>
                      <strong>{receivableDocument(entry)}</strong>
                      <br />
                      <span className="table-muted">Título #{titleNumber(entry)} - Parcela {entry.installmentNumber || entry.installmentId || "não informada"}</span>
                    </td>
                    <td>
                      {entry.clientName || "Cliente não informado"}
                      <br />
                      <span className="table-muted">{entry.clientId ? `Cliente #${entry.clientId}` : entry.companyName || ""}</span>
                    </td>
                    <td>{formatOptionalDate(entry.dueDate)}</td>
                    <td>
                      {entry.projectName || entry.businessAreaName || "Não informado"}
                      <br />
                      <span className="table-muted">{entry.mainUnit || entry.companyName || ""}</span>
                    </td>
                    <td><strong>{formatCurrency(receivableOpenAmount(entry))}</strong></td>
                    <td>
                      {formatCurrency(receivablePaidAmount(entry))}
                      <br />
                      <span className="table-muted">{entry.receipts?.length || 0} baixa{entry.receipts?.length === 1 ? "" : "s"}</span>
                    </td>
                    <td><span className={badgeClass(status)}>{status}</span></td>
                    <td><IntegrationStamp record={entry} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      />
    </section>
  );
}
