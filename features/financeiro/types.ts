export type EntryStatus = "Completo" | "Incompleto" | "Em inclusão" | "Pendente" | "Em atraso";

export type FinancialEntry = {
  id: number;
  document: string;
  description: string;
  party: string;
  dueDate: string;
  amount: number;
  status: EntryStatus;
  kind: "payable" | "receivable";
  originId?: string;
};
