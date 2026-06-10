import { formatCurrency, formatDate } from "@/lib/formatters";
import type { FinancialEntry } from "@/features/financeiro/types";

export function FinancialTable({ entries, dateHeading = "Vencimento" }: { entries: FinancialEntry[]; dateHeading?: string }) {
  return (
    <div className="card table-card">
      <table>
        <thead><tr><th>Documento</th><th>Descrição</th><th>Credor</th><th>Origem</th><th>{dateHeading}</th><th>Valor</th><th>Status</th></tr></thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td><strong>{entry.document}</strong></td><td>{entry.description}</td><td>{entry.party}</td>
              <td>{entry.originId || "—"}</td>
              <td>{formatDate(entry.dueDate)}</td><td><strong>{formatCurrency(entry.amount)}</strong></td>
              <td><span className={`badge ${entry.status === "Pendente" ? "pending" : entry.status === "Em atraso" ? "late" : ""}`}>{entry.status}</span></td>
            </tr>
          ))}
          {!entries.length && <tr><td colSpan={7} className="empty-state">Nenhum título encontrado.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
