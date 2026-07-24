"use client";

import { I18nText } from "@/components/i18n/i18n-text";
import { IntegrationStamp } from "@/components/ui/integration-stamp";
import { LocalDataList } from "@/components/ui/local-data-list";
import type { FinancialEntry } from "@/features/financeiro/types";
import { formatCurrency, formatDate } from "@/lib/formatters";

export function FinancialTable({ entries, dateHeading = "Vencimento" }: { entries: FinancialEntry[]; dateHeading?: string }) {
  return (
    <div className="card table-card">
      <LocalDataList
        items={entries}
        itemLabel="títulos"
        emptyMessage="Nenhum título encontrado."
        renderItems={(pageItems) => (
          <table>
            <thead>
              <tr>
                <th><I18nText text={"Documento"} /></th>
                <th><I18nText text={"Descrição"} /></th>
                <th><I18nText text={"Credor"} /></th>
                <th><I18nText text={"Origem"} /></th>
                <th>{dateHeading}</th>
                <th><I18nText text={"Valor"} /></th>
                <th><I18nText text={"Status"} /></th>
                <th><I18nText text={"Integração"} /></th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((entry) => (
                <tr key={entry.id}>
                  <td><strong>{entry.document}</strong></td>
                  <td>{entry.description}</td>
                  <td>{entry.party}</td>
                  <td>{entry.originId || <I18nText text={"-"} />}</td>
                  <td>{formatDate(entry.dueDate)}</td>
                  <td><strong>{formatCurrency(entry.amount)}</strong></td>
                  <td><span className={`badge ${entry.status === "Pendente" ? "pending" : entry.status === "Em atraso" ? "late" : ""}`}>{entry.status}</span></td>
                  <td><IntegrationStamp record={entry} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      />
    </div>
  );
}
