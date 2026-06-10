import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  receivableDocument,
  receivableOpenAmount,
  receivablePaidAmount,
  receivableStatus,
  type ReceivableInstallment
} from "@/features/receivables-forecast/sienge-data";

function safeDate(value?: string) {
  if (!value) return "Não informada";
  try {
    return formatDate(value);
  } catch {
    return value;
  }
}

function titleNumber(entry: ReceivableInstallment) {
  return entry.billId || entry.receivableBillId || "sem número";
}

function badgeClass(status: string) {
  if (status === "Em atraso") return "badge late";
  if (status === "Previsto" || status === "Sem vencimento") return "badge pending";
  return "badge";
}

export function ReceivablesForecastTable({ entries }: { entries: ReceivableInstallment[] }) {
  const visibleEntries = entries.slice(0, 120);

  return (
    <section className="card table-card">
      <div className="panel-head table-head">
        <div>
          <h2 className="panel-title">Parcelas previstas a receber</h2>
          <span className="panel-note">
            {visibleEntries.length} de {entries.length} parcelas abertas exibidas por vencimento
          </span>
        </div>
      </div>
      {visibleEntries.length ? (
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
            </tr>
          </thead>
          <tbody>
            {visibleEntries.map((entry) => {
              const status = receivableStatus(entry);
              return (
                <tr key={`${entry.billId || entry.receivableBillId || "bill"}-${entry.installmentId || "installment"}-${entry.dueDate || "date"}`}>
                  <td>
                    <strong>{receivableDocument(entry)}</strong>
                    <br />
                    <span className="table-muted">Título #{titleNumber(entry)} · Parcela {entry.installmentNumber || entry.installmentId || "não informada"}</span>
                  </td>
                  <td>
                    {entry.clientName || "Cliente não informado"}
                    <br />
                    <span className="table-muted">{entry.clientId ? `Cliente #${entry.clientId}` : entry.companyName || ""}</span>
                  </td>
                  <td>{safeDate(entry.dueDate)}</td>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div className="empty-state">Nenhuma parcela aberta retornada para a previsão.</div>
      )}
    </section>
  );
}
