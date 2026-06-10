import "server-only";
import { contasPagarApi } from "@/lib/api/financeiro";
import { SiengeApiError } from "@/lib/api/sienge";
import type { PayablesScheduleResult, ScheduleBucket, ScheduledPayable } from "./types";

const iso = (date: Date) => date.toISOString().slice(0, 10);
const atDay = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`);
const amount = (item: ScheduledPayable) => item.correctedBalanceAmount ?? item.balanceAmount ?? item.originalAmount ?? 0;
const BULK_START_DATE = "2000-01-01";

export async function loadPayablesSchedule(): Promise<PayablesScheduleResult> {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const end = new Date(today.getFullYear(), today.getMonth() + 3, 0, 12);
  const bulkEnd = new Date(today.getFullYear() + 2, 11, 31, 12);

  try {
    const response = await contasPagarApi.advancedSearch<{ data?: ScheduledPayable[] }>({
      startDate: BULK_START_DATE,
      endDate: iso(bulkEnd),
      selectionType: "D",
      correctionIndexerId: 1,
      correctionDate: iso(today),
      withBankMovements: false,
      withAuthorizations: true
    });
    const items = (response.data || [])
      .filter((item) => amount(item) > 0)
      .filter((item) => {
        const date = atDay(item.dueDate);
        return date >= today && date <= end;
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + (today.getDay() === 0 ? 0 : 7 - today.getDay()));
    const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 12);
    const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0, 12);

    const definitions: Omit<ScheduleBucket, "items" | "amount">[] = [
      { id: "today", label: "Hoje", note: "Vencimentos do dia" },
      { id: "week", label: "Restante da semana", note: "Até domingo" },
      { id: "month", label: "Restante do mês", note: new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(today) },
      { id: "nextMonth", label: "Próximo mês", note: new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(today.getFullYear(), today.getMonth() + 1, 1)) },
      { id: "secondMonth", label: "Mês seguinte", note: new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(today.getFullYear(), today.getMonth() + 2, 1)) }
    ];

    const buckets = definitions.map((definition) => {
      const bucketItems = items.filter((item) => {
        const date = atDay(item.dueDate);
        if (definition.id === "today") return iso(date) === iso(today);
        if (definition.id === "week") return date > today && date <= weekEnd;
        if (definition.id === "month") return date > weekEnd && date <= currentMonthEnd;
        if (definition.id === "nextMonth") return date > currentMonthEnd && date <= nextMonthEnd;
        return date > nextMonthEnd && date <= end;
      });
      return { ...definition, items: bucketItems, amount: bucketItems.reduce((sum, item) => sum + amount(item), 0) };
    });

    return {
      items,
      buckets,
      totalAmount: items.reduce((sum, item) => sum + amount(item), 0),
      totalCount: items.length,
      authorizedCount: items.filter((item) => item.authorizationStatus === "S").length
    };
  } catch (error) {
    return {
      items: [],
      buckets: [],
      totalAmount: 0,
      totalCount: 0,
      authorizedCount: 0,
      error: error instanceof SiengeApiError ? {
        ...error.details,
        explanation: error.details.status === 403 ? "A credencial não possui acesso ao Bulk-data de Parcelas a Pagar." : error.details.explanation,
        suggestion: error.details.status === 403 ? "Libere o pacote Bulk-data Parcelas a Pagar no Painel de Integrações do Sienge." : error.details.suggestion
      } : {
        method: "GET",
        endpoint: "/bulk-data/v1/outcome",
        title: "Não foi possível montar a agenda de pagamentos",
        explanation: error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
        suggestion: "Confira o acesso à API bulk de contas a pagar.",
        occurredAt: new Date().toISOString()
      }
    };
  }
}
