import "server-only";
import { conciliacaoApi } from "@/lib/api/financeiro";
import { SiengeApiError, type SiengeErrorDetails, type SiengeRequestProgress } from "@/lib/api/sienge";
import type { BankMovement, ReconciliationSummary } from "./types";
import { isLinked, isReconciled, movementAmount } from "./utils";

type BankMovementResponse = {
  data?: BankMovement[];
};

export type ReconciliationResult = {
  movements: BankMovement[];
  totalCount: number;
  error?: SiengeErrorDetails;
};

const START_DATE = "2000-01-01";

const iso = (date: Date) => date.toISOString().slice(0, 10);

function wideEndDate() {
  const today = new Date();
  return new Date(today.getFullYear() + 2, 11, 31, 12).toISOString().slice(0, 10);
}

export async function loadReconciliationMovements(onProgress?: (progress: SiengeRequestProgress) => void): Promise<ReconciliationResult> {
  try {
    onProgress?.({
      stage: "prepare-query",
      message: "Preparando consulta ampla de movimentos bancários.",
      detail: `${START_DATE} até ${wideEndDate()}`
    });
    const response = await conciliacaoApi.bankMovements<BankMovementResponse>({
      startDate: START_DATE,
      endDate: wideEndDate(),
      selectionType: "M",
      onlyDetachedMovement: "N"
    }, false, onProgress);
    onProgress?.({
      stage: "analyze",
      message: "Organizando movimentos para exibição.",
      detail: `${response.data?.length || 0} movimento(s) retornado(s)`
    });
    const movements = (response.data || []).sort((left, right) => String(right.bankMovementDate || "").localeCompare(String(left.bankMovementDate || "")));
    return { movements, totalCount: movements.length };
  } catch (error) {
    return {
      movements: [],
      totalCount: 0,
      error: error instanceof SiengeApiError ? {
        ...error.details,
        explanation: error.details.status === 403
          ? "A credencial não possui acesso ao Bulk-data de movimentos de Caixa e Bancos."
          : error.details.explanation,
        suggestion: error.details.status === 403
          ? "Libere o pacote Bulk-data Caixas e Bancos no Painel de Integrações do Sienge."
          : error.details.suggestion
      } : {
        method: "GET",
        endpoint: "/bulk-data/v1/bank-movement",
        title: "Não foi possível montar o portal de conciliação",
        explanation: error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
        suggestion: "Confira o acesso à API bulk de movimentos bancários.",
        occurredAt: new Date().toISOString()
      }
    };
  }
}

export function analyzeReconciliation(movements: BankMovement[]): ReconciliationSummary {
  const byAccount = new Map<string, { label: string; value: number; count: number }>();
  movements.forEach((movement) => {
    const label = movement.accountNumber || "Conta não informada";
    const current = byAccount.get(label) || { label, value: 0, count: 0 };
    current.value += movementAmount(movement);
    current.count += 1;
    byAccount.set(label, current);
  });

  const reconciled = movements.filter(isReconciled);
  const unreconciled = movements.filter((movement) => !isReconciled(movement));
  return {
    totalAmount: movements.reduce((sum, movement) => sum + movementAmount(movement), 0),
    reconciledAmount: reconciled.reduce((sum, movement) => sum + movementAmount(movement), 0),
    unreconciledAmount: unreconciled.reduce((sum, movement) => sum + movementAmount(movement), 0),
    reconciledCount: reconciled.length,
    unreconciledCount: unreconciled.length,
    detachedCount: movements.filter((movement) => !isLinked(movement)).length,
    linkedCount: movements.filter(isLinked).length,
    byAccount: Array.from(byAccount.values()).sort((left, right) => Math.abs(right.value) - Math.abs(left.value)).slice(0, 8)
  };
}
