export type UpdateArea = "all" | "payables" | "receivables" | "sales" | "inventory" | "purchases" | "reconciliation" | "contracts";

export const updateAreas: Array<{ key: UpdateArea; label: string; note: string; historyKey?: string }> = [
  { key: "all", label: "Todas as áreas", note: "Atualiza todos os dados usados pelos portais." },
  { key: "payables", label: "Contas a pagar", note: "Títulos, parcelas, agenda e busca avançada.", historyKey: "payables" },
  { key: "receivables", label: "Contas a receber", note: "Previsão de recebimentos e parcelas em aberto.", historyKey: "receivables" },
  { key: "sales", label: "Vendas", note: "Contratos de vendas e gráficos comerciais.", historyKey: "sales" },
  { key: "contracts", label: "Contratos", note: "Contratos de fornecimento, saldos e medições.", historyKey: "contracts" },
  { key: "inventory", label: "Estoque e patrimônio", note: "Unidades imobiliárias, bens móveis e bens imóveis.", historyKey: "inventory" },
  { key: "purchases", label: "Compras", note: "Solicitações, cotações, pedidos e notas.", historyKey: "purchases" },
  { key: "reconciliation", label: "Conciliação", note: "Movimentos bancários e itens a conciliar.", historyKey: "reconciliation" }
];

export function isUpdateArea(value: unknown): value is UpdateArea {
  return updateAreas.some((area) => area.key === value);
}

export function updateAreaLabel(value: UpdateArea) {
  return updateAreas.find((area) => area.key === value)?.label || "Atualização";
}
