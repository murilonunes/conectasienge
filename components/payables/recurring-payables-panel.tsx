"use client";

import { useMemo, useState } from "react";
import { PrintPanelButton } from "@/components/ui/print-panel-button";
import type { RecurringPayablesResult } from "@/features/payables-recurring/data";
import { formatCurrency, formatOptionalDate } from "@/lib/formatters";

type WindowOption = "3" | "6" | "9" | "12" | "year";

const windowLabels: Record<WindowOption, string> = {
  "3": "3 meses",
  "6": "6 meses",
  "9": "9 meses",
  "12": "12 meses",
  year: "No ano"
};

function targetMonths(monthKeys: string[], option: WindowOption, currentYear: string) {
  if (option === "year") return monthKeys.filter((key) => key.startsWith(currentYear));
  const count = Number(option);
  return monthKeys.slice(Math.max(0, monthKeys.length - count));
}

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(new Date(year, month - 1, 1));
}

export function RecurringPayablesPanel({ result }: { result: RecurringPayablesResult }) {
  const [windowOption, setWindowOption] = useState<WindowOption>("3");
  const currentYear = String(new Date(result.generatedAt).getFullYear());
  const months = useMemo(() => targetMonths(result.monthKeys, windowOption, currentYear), [result.monthKeys, windowOption, currentYear]);

  const candidates = useMemo(() => {
    if (months.length < 2) return [];
    return result.creditors
      .filter((creditor) => months.every((month) => creditor.monthsWithBill.includes(month)))
      .map((creditor) => ({
        ...creditor,
        periodAmount: months.reduce((total, month) => total + (creditor.amountByMonth[month] || 0), 0)
      }))
      .sort((left, right) => right.periodAmount - left.periodAmount);
  }, [result.creditors, months]);

  return (
    <section className="card panel recurring-payables-panel" data-print-panel>
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Recorrentes sem lançamento futuro</h2>
          <span className="panel-note">
            Fornecedores com título todo mês no período escolhido (pago ou não), sem nenhum título futuro cadastrado em Contas a pagar
          </span>
        </div>
        <PrintPanelButton />
      </div>

      <div className="recurring-payables-window">
        {(Object.keys(windowLabels) as WindowOption[]).map((option) => (
          <button
            className={windowOption === option ? "active" : ""}
            key={option}
            type="button"
            onClick={() => setWindowOption(option)}
          >
            {windowLabels[option]}
          </button>
        ))}
      </div>

      <p className="recurring-payables-summary">
        {months.length < 2
          ? "Escolha um período com pelo menos 2 meses para comparar."
          : `Considerando ${months.length} ${months.length === 1 ? "mês" : "meses"} (${monthLabel(months[0])} a ${monthLabel(months[months.length - 1])}): ${candidates.length} fornecedor(es) com título em todos os meses do período, sem título futuro registrado.`}
      </p>

      {candidates.length ? (
        <div className="table-card recurring-payables-table">
          <table>
            <thead>
              <tr>
                <th>Fornecedor</th>
                <th>Categoria</th>
                <th>Meses com título</th>
                <th>Total no período</th>
                <th>Média mensal</th>
                <th>Último vencimento</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((creditor) => (
                <tr key={creditor.creditorId}>
                  <td><strong>{creditor.creditorName}</strong></td>
                  <td>{creditor.category || "Não informada"}</td>
                  <td>{months.length}/{months.length} meses</td>
                  <td>{formatCurrency(creditor.periodAmount)}</td>
                  <td>{formatCurrency(creditor.periodAmount / months.length)}</td>
                  <td>{formatOptionalDate(creditor.lastDueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : months.length >= 2 ? (
        <div className="empty-state">Nenhum fornecedor recorrente sem título futuro cadastrado nesse período.</div>
      ) : null}
    </section>
  );
}
