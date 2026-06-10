export type SalesCustomer = {
  id: number;
  name: string;
  main?: boolean;
  participationPercentage?: number;
};

export type SalesUnit = {
  id: number;
  name: string;
  main?: boolean;
  participationPercentage?: number;
};

export type PaymentCondition = {
  conditionTypeName?: string;
  installmentsNumber?: number;
  openInstallmentsNumber?: number;
  totalValue?: number;
  outstandingBalance?: number;
  amountPaid?: number;
  firstPayment?: string;
  indexerName?: string;
};

export type SalesContract = {
  id: number;
  number: string;
  externalId?: string;
  companyName?: string;
  enterpriseId?: number;
  enterpriseName?: string;
  receivableBillId?: number;
  contractDate?: string;
  issueDate?: string;
  expectedDeliveryDate?: string;
  keysDeliveredAt?: string;
  situation?: string;
  value?: number;
  totalSellingValue?: number;
  discountPercentage?: number;
  cancellationDate?: string;
  cancellationReason?: string;
  salesContractCustomers?: SalesCustomer[];
  salesContractUnits?: SalesUnit[];
  paymentConditions?: PaymentCondition[];
};

export type SalesSummary = {
  totalValue: number;
  outstandingBalance: number;
  amountPaid: number;
  averageValue: number;
  activeCount: number;
  cancelledCount: number;
  byEnterprise: { label: string; value: number; count: number }[];
  bySituation: { label: string; value: number; count: number }[];
  monthlySales: { label: string; value: number; count: number }[];
};
