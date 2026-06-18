import "server-only";
import { contratosApi } from "@/lib/api/financeiro";
import { SiengeApiError, type SiengeErrorDetails } from "@/lib/api/sienge";
import type { SalesContract, SalesSummary } from "./types";

export type SalesResult = {
  contracts: SalesContract[];
  totalCount: number;
  error?: SiengeErrorDetails;
};

export async function loadSalesContracts(forceRefresh = false, forceReplaceFinalized = false): Promise<SalesResult> {
  try {
    const limit = 200;
    const response = await contratosApi.sales<SalesContract>({ limit, offset: 0 }, forceRefresh, forceReplaceFinalized);
    const totalCount = response.resultSetMetadata?.count ?? response.results.length;
    const remainingPages = Math.max(0, Math.ceil(totalCount / limit) - 1);
    const additionalResponses = await Promise.all(Array.from({ length: remainingPages }, (_, index) =>
      contratosApi.sales<SalesContract>({ limit, offset: (index + 1) * limit }, forceRefresh, forceReplaceFinalized)
    ));
    const contracts = [
      ...(response.results || []),
      ...additionalResponses.flatMap((page) => page.results || [])
    ];
    return {
      contracts,
      totalCount
    };
  } catch (error) {
    const details = error instanceof SiengeApiError ? error.details : undefined;
    return {
      contracts: [],
      totalCount: 0,
      error: details ? {
        ...details,
        explanation: details.status === 403
          ? "O Sienge reconheceu a autenticação, mas bloqueou o acesso aos contratos de vendas."
          : details.explanation,
        suggestion: details.status === 403
          ? "No Painel de Integrações do Sienge, libere Contratos de Vendas para esta credencial."
          : details.suggestion
      } : {
        method: "GET",
        endpoint: "/v1/sales-contracts",
        title: "Não foi possível consultar contratos de vendas",
        explanation: error instanceof Error ? error.message : "Ocorreu um erro inesperado.",
        suggestion: "Verifique a permissão de Contratos de Vendas no Sienge.",
        occurredAt: new Date().toISOString()
      }
    };
  }
}

function groupContracts(contracts: SalesContract[], label: (contract: SalesContract) => string) {
  const groups = new Map<string, { label: string; value: number; count: number }>();
  contracts.forEach((contract) => {
    const key = label(contract);
    const current = groups.get(key) || { label: key, value: 0, count: 0 };
    current.value += contract.totalSellingValue || contract.value || 0;
    current.count += 1;
    groups.set(key, current);
  });
  return Array.from(groups.values()).sort((a, b) => b.value - a.value);
}

export function analyzeSales(contracts: SalesContract[]): SalesSummary {
  const totalValue = contracts.reduce((sum, contract) => sum + (contract.totalSellingValue || contract.value || 0), 0);
  const conditions = contracts.flatMap((contract) => contract.paymentConditions || []);
  const outstandingBalance = conditions.reduce((sum, condition) => sum + (condition.outstandingBalance || 0), 0);
  const amountPaid = conditions.reduce((sum, condition) => sum + (condition.amountPaid || 0), 0);
  const monthlyMap = new Map<string, { label: string; value: number; count: number; order: number }>();
  contracts.forEach((contract) => {
    const rawDate = contract.issueDate || contract.contractDate;
    if (!rawDate) return;
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return;
    const label = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(date);
    const current = monthlyMap.get(label) || {
      label,
      value: 0,
      count: 0,
      order: date.getFullYear() * 12 + date.getMonth()
    };
    current.value += contract.totalSellingValue || contract.value || 0;
    current.count += 1;
    monthlyMap.set(label, current);
  });

  return {
    totalValue,
    outstandingBalance,
    amountPaid,
    averageValue: contracts.length ? totalValue / contracts.length : 0,
    activeCount: contracts.filter((contract) => !/cancelad|distrat/i.test(contract.situation || "")).length,
    cancelledCount: contracts.filter((contract) => /cancelad|distrat/i.test(contract.situation || "")).length,
    byEnterprise: groupContracts(contracts, (contract) => contract.enterpriseName || "Empreendimento não informado").slice(0, 8),
    bySituation: groupContracts(contracts, (contract) => contract.situation || "Situação não informada"),
    monthlySales: Array.from(monthlyMap.values()).sort((a, b) => a.order - b.order)
  };
}
