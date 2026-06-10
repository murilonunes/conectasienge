import type { SiengeErrorDetails } from "@/lib/api/sienge";

export type ScheduledPayable = {
  companyName?: string;
  creditorId?: number;
  creditorName?: string;
  billId: number;
  installmentId: number;
  documentIdentificationId?: string;
  documentNumber?: string;
  originalAmount?: number;
  balanceAmount?: number;
  correctedBalanceAmount?: number;
  dueDate: string;
  authorizationStatus?: string;
  payments?: { netAmount?: number; paymentDate?: string }[];
};

export type ScheduleBucket = {
  id: "today" | "week" | "month" | "nextMonth" | "secondMonth";
  label: string;
  note: string;
  items: ScheduledPayable[];
  amount: number;
};

export type PayablesScheduleResult = {
  items: ScheduledPayable[];
  buckets: ScheduleBucket[];
  totalAmount: number;
  totalCount: number;
  authorizedCount: number;
  error?: SiengeErrorDetails;
};
