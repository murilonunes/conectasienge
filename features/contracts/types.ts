import type { SiengeErrorDetails } from "@/lib/api/sienge";

export type SupplyContract = {
  id?: number;
  contractId?: number;
  number?: string | number;
  contractNumber?: string | number;
  supplierId?: number;
  creditorId?: number;
  supplierName?: string;
  creditorName?: string;
  companyName?: string;
  buildingName?: string;
  projectName?: string;
  object?: string;
  description?: string;
  situation?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  issueDate?: string;
  signatureDate?: string;
  contractDate?: string;
  totalValue?: number;
  contractValue?: number;
  value?: number;
  balanceAmount?: number;
  measuredAmount?: number;
  accumulatedMeasuredValue?: number;
  __siengeIntegrationDay?: string;
  __siengeIntegratedAt?: string;
  [key: string]: unknown;
};

export type ContractsResult = {
  contracts: SupplyContract[];
  totalCount: number;
  error?: SiengeErrorDetails;
};

export type ContractsSummary = {
  totalValue: number;
  measuredValue: number;
  balanceValue: number;
  activeCount: number;
  closedCount: number;
  suppliersCount: number;
  byStatus: Array<{ label: string; value: number; count: number }>;
};
