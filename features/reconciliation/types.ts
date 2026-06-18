export type BankMovement = {
  bankMovementId?: number;
  billId?: number;
  installmentId?: number;
  bankMovementAmount?: number;
  documentIdentificationId?: string;
  documentIdentificationName?: string;
  documentIdentificationNumber?: string;
  bankMovementOriginId?: string;
  bankMovementHistoricId?: string;
  bankMovementHistoricName?: string;
  bankMovementOperationId?: number;
  bankMovementOperationName?: string;
  bankMovementOperationType?: string;
  bankMovementReconcile?: string;
  bankMovementDate?: string;
  billDate?: string;
  accountNumber?: string;
  companyId?: number;
  companyName?: string;
  groupCompanyId?: number;
  groupCompanyName?: string;
  holdingId?: number;
  holdingName?: string;
  subsidiaryId?: number;
  subsidiaryName?: string;
  creditorId?: number;
  creditorName?: string;
  clientId?: number;
  clientName?: string;
  financialCategories?: unknown[];
  departamentCosts?: unknown[];
  buldingCosts?: unknown[];
  __siengeIntegrationDay?: string;
  __siengeIntegratedAt?: string;
};

export type ReconciliationSummary = {
  totalAmount: number;
  reconciledAmount: number;
  unreconciledAmount: number;
  reconciledCount: number;
  unreconciledCount: number;
  detachedCount: number;
  linkedCount: number;
  byAccount: { label: string; value: number; count: number }[];
  monthly: ReconciliationMonthlySummary[];
};

export type ReconciliationMonthlySummary = {
  key: string;
  label: string;
  totalAmount: number;
  totalCount: number;
  reconciledAmount: number;
  reconciledCount: number;
  unreconciledAmount: number;
  unreconciledCount: number;
  linkedCount: number;
  detachedCount: number;
};

export type ReconciliationAccountOption = {
  accountNumber: string;
  label: string;
  count: number;
};
