export type UpdateArea = "all" | "reports" | "payables" | "receivables" | "sales" | "inventory" | "purchases" | "reconciliation" | "contracts";

export type UpdateAreaDefinition = { key: UpdateArea; label: string; note: string; historyKey?: string };

export const updateAreas: UpdateAreaDefinition[] = [
  { key: "all", label: "Todas as áreas", note: "Atualiza todos os dados usados pelos portais." },
  { key: "payables", label: "Contas a pagar", note: "Títulos, parcelas, agenda e busca avançada.", historyKey: "payables" },
  { key: "receivables", label: "Contas a receber", note: "Previsão de recebimentos e parcelas em aberto.", historyKey: "receivables" },
  { key: "sales", label: "Vendas", note: "Contratos de vendas e gráficos comerciais.", historyKey: "sales" },
  { key: "contracts", label: "Contratos", note: "Contratos de fornecimento, saldos e medições.", historyKey: "contracts" },
  { key: "inventory", label: "Estoque e patrimônio", note: "Unidades, patrimônio, tabelas de preço, mapa imobiliário, reservas e insumos.", historyKey: "inventory" },
  { key: "purchases", label: "Compras", note: "Solicitações, cotações, pedidos e notas.", historyKey: "purchases" },
  { key: "reconciliation", label: "Conciliação", note: "Movimentos bancários e itens a conciliar.", historyKey: "reconciliation" }
];

export const reportUpdateAreas: UpdateAreaDefinition[] = [
  { key: "reports", label: "Todos os relatórios", note: "Atualiza os dados usados pela Central de relatórios." },
  ...updateAreas.filter((area) => ["payables", "receivables", "sales", "contracts", "inventory", "purchases"].includes(area.key))
];

export function isUpdateArea(value: unknown): value is UpdateArea {
  return value === "reports" || updateAreas.some((area) => area.key === value);
}

export function updateAreaLabel(value: UpdateArea) {
  if (value === "reports") return "Relatórios";
  return updateAreas.find((area) => area.key === value)?.label || "Atualização";
}
