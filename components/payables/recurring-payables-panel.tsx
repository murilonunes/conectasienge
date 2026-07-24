"use client";

import { I18nText } from "@/components/i18n/i18n-text";
import { useMemo, useState } from "react";
import { PrintPanelButton } from "@/components/ui/print-panel-button";
import type { RecurringPayablesResult } from "@/features/payables-recurring/data";
import { formatCurrency, formatOptionalDate } from "@/lib/formatters";

type WindowOption = "3" | "6" | "9" | "12" | "year";
type FutureMode = "missing" | "scheduled";

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
  const [futureMode, setFutureMode] = useState<FutureMode>("missing");
  const currentYear = String(new Date(result.generatedAt).getFullYear());
  const months = useMemo(() => targetMonths(result.monthKeys, windowOption, currentYear), [result.monthKeys, windowOption, currentYear]);

  const candidates = useMemo(() => {
    if (months.length < 2) return [];
    return result.creditors
      .filter((creditor) => (
        months.every((month) => creditor.monthsWithBill.includes(month))
        && creditor.hasFutureBill === (futureMode === "scheduled")
      ))
      .map((creditor) => ({
        ...creditor,
        periodAmount: months.reduce((total, month) => total + (creditor.amountByMonth[month] || 0), 0)
      }))
      .sort((left, right) => right.periodAmount - left.periodAmount);
  }, [result.creditors, months, futureMode]);

  const futureDescription = futureMode === "scheduled"
    ? "com título no passado e também com lançamento futuro"
    : "com título no passado e sem lançamento futuro";

  return (
    <section className="card panel recurring-payables-panel" data-print-panel>
      <div className="panel-head">
        <div>
          <h2 className="panel-title"><I18nText text={"Pagamentos recorrentes"} /></h2>
          <span className="panel-note">
            <I18nText text={"Compare fornecedores com títulos recorrentes no histórico e confira se já existem lançamentos futuros em Contas a pagar"} />
          </span>
        </div>
        <PrintPanelButton />
      </div>

      <div className="recurring-payables-filters">
        <div className="recurring-payables-filter-group">
          <span><I18nText text={"Situação"} /></span>
          <div className="recurring-payables-window" aria-label="Situação dos lançamentos futuros" data-i18n-aria-label={"Situação dos lançamentos futuros"}>
            <button className={futureMode === "missing" ? "active" : ""} type="button" onClick={() => setFutureMode("missing")}>
              <I18nText text={"Sem futuro"} />
            </button>
            <button className={futureMode === "scheduled" ? "active" : ""} type="button" onClick={() => setFutureMode("scheduled")}>
              <I18nText text={"Passado + futuro"} />
            </button>
          </div>
        </div>
        <div className="recurring-payables-filter-group">
          <span><I18nText text={"Período histórico"} /></span>
          <div className="recurring-payables-window" aria-label="Período histórico da recorrência" data-i18n-aria-label={"Período histórico da recorrência"}>
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
        </div>
      </div>

      <p className="recurring-payables-summary">
        {months.length < 2
          ? <I18nText text={"Escolha um período com pelo menos 2 meses para comparar."} />
          : `Considerando ${months.length} ${months.length === 1 ? "mês" : "meses"} (${monthLabel(months[0])} a ${monthLabel(months[months.length - 1])}): ${candidates.length} fornecedor(es) ${futureDescription}.`}
      </p>

      {candidates.length ? (
        <div className="table-card recurring-payables-table">
          <table>
            <thead>
              <tr>
                <th><I18nText text={"Fornecedor"} /></th>
                <th><I18nText text={"Categoria"} /></th>
                <th><I18nText text={"Meses com título"} /></th>
                <th><I18nText text={"Total no período"} /></th>
                <th><I18nText text={"Média mensal"} /></th>
                <th><I18nText text={"Último no histórico"} /></th>
                <th><I18nText text={"Próximo futuro"} /></th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((creditor) => (
                <tr key={creditor.creditorId}>
                  <td><strong>{creditor.creditorName}</strong></td>
                  <td>{creditor.category || <I18nText text={"Não informada"} />}</td>
                  <td>{months.length}<I18nText text={"/"} />{months.length} <I18nText text={"meses"} /></td>
                  <td>{formatCurrency(creditor.periodAmount)}</td>
                  <td>{formatCurrency(creditor.periodAmount / months.length)}</td>
                  <td>{formatOptionalDate(creditor.lastDueDate)}</td>
                  <td>
                    {creditor.nextFutureDueDate
                      ? `${formatOptionalDate(creditor.nextFutureDueDate)} | ${creditor.futureBillCount} ${creditor.futureBillCount === 1 ? "título" : "títulos"}`
                      : <I18nText text={"Não cadastrado"} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : months.length >= 2 ? (
        <div className="empty-state">
          <I18nText text={"Nenhum fornecedor recorrente"} /> <I18nText text={futureMode === "scheduled" ? "com lançamento futuro" : "sem lançamento futuro"} /> <I18nText text={"nesse período."} />
        </div>
      ) : null}
    </section>
  );
}
