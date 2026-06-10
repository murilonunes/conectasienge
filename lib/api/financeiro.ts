import { siengeRequest, type SiengePage, type SiengeRequestProgress } from "./sienge";

export type SiengeListFilters = {
  [key: string]: string | number | boolean | Array<string | number> | undefined;
  offset?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
};

export const contasPagarApi = {
  list: <T>(filters: SiengeListFilters = {}) =>
    siengeRequest<SiengePage<T>>("/v1/bills", filters),
  get: <T>(billId: number) =>
    siengeRequest<T>(`/v1/bills/${billId}`),
  installments: <T>(billId: number) =>
    siengeRequest<SiengePage<T>>(`/v1/bills/${billId}/installments`),
  create: <T>(payload: unknown) =>
    siengeRequest<T>("/v1/bills", {}, { method: "POST", body: payload }),
  updatePaymentInformation: <T>(billId: number, installmentId: number, type: string, payload: unknown) =>
    siengeRequest<T>(`/v1/bills/${billId}/installments/${installmentId}/payment-information/${type}`, {}, { method: "PATCH", body: payload }),
  advancedSearch: <T>(filters: SiengeListFilters, forceRefresh = false) =>
    siengeRequest<T>("/bulk-data/v1/outcome", filters, { cache: forceRefresh ? "refresh" : "daily" }),
  budgetCategories: <T>(billId: number) =>
    siengeRequest<SiengePage<T>>(`/v1/bills/${billId}/budget-categories`),
  buildingsCost: <T>(billId: number) =>
    siengeRequest<SiengePage<T>>(`/v1/bills/${billId}/buildings-cost`),
  departmentsCost: <T>(billId: number) =>
    siengeRequest<SiengePage<T>>(`/v1/bills/${billId}/departments-cost`),
  attachments: <T>(billId: number) =>
    siengeRequest<SiengePage<T>>(`/v1/bills/${billId}/attachments`)
};

export const credoresApi = {
  list: <T>(filters: SiengeListFilters = {}, forceRefresh = false) =>
    siengeRequest<SiengePage<T>>("/v1/creditors", filters, { cache: forceRefresh ? "refresh" : "daily" }),
  get: <T>(creditorId: number) =>
    siengeRequest<T>(`/v1/creditors/${creditorId}`)
};

export const contasReceberApi = {
  list: <T>(customerId: number, filters: SiengeListFilters = {}) =>
    siengeRequest<SiengePage<T>>("/v1/accounts-receivable/receivable-bills", { ...filters, customerId }),
  get: <T>(receivableBillId: number) =>
    siengeRequest<T>(`/v1/accounts-receivable/receivable-bills/${receivableBillId}`),
  incomeForecast: <T>(filters: SiengeListFilters = {}, forceRefresh = false) =>
    siengeRequest<T>("/bulk-data/v1/income", filters, { cache: forceRefresh ? "refresh" : "daily" })
};

export const contratosApi = {
  supply: <T>(filters: SiengeListFilters = {}) =>
    siengeRequest<SiengePage<T>>("/v1/supply-contracts", filters),
  sales: <T>(filters: SiengeListFilters = {}) =>
    siengeRequest<SiengePage<T>>("/v1/sales-contracts", filters)
};

export const conciliacaoApi = {
  bankMovements: <T>(filters: SiengeListFilters = {}, forceRefresh = false, onProgress?: (progress: SiengeRequestProgress) => void) =>
    siengeRequest<T>("/bulk-data/v1/bank-movement", filters, { cache: forceRefresh ? "refresh" : "daily", onProgress }),
  accountStatements: <T>(filters: SiengeListFilters = {}, forceRefresh = false, onProgress?: (progress: SiengeRequestProgress) => void) =>
    siengeRequest<SiengePage<T>>("/v1/accounts-statements", filters, { cache: forceRefresh ? "refresh" : "daily", onProgress })
};

export const estoqueApi = {
  units: <T>(filters: SiengeListFilters = {}, forceRefresh = false) =>
    siengeRequest<SiengePage<T>>("/v1/units", filters, { cache: forceRefresh ? "refresh" : "daily" }),
  movable: <T>(filters: SiengeListFilters = {}, forceRefresh = false) =>
    siengeRequest<SiengePage<T>>("/v1/patrimony/movable", filters, { cache: forceRefresh ? "refresh" : "daily" }),
  fixed: <T>(filters: SiengeListFilters = {}, forceRefresh = false) =>
    siengeRequest<SiengePage<T>>("/v1/patrimony/fixed", filters, { cache: forceRefresh ? "refresh" : "daily" })
};

export const comprasApi = {
  purchaseOrders: <T>(filters: SiengeListFilters = {}, forceRefresh = false) =>
    siengeRequest<SiengePage<T>>("/v1/purchase-orders", filters, { cache: forceRefresh ? "refresh" : "daily" }),
  purchaseInvoices: <T>(filters: SiengeListFilters = {}, forceRefresh = false) =>
    siengeRequest<SiengePage<T>>("/v1/purchase-invoices", filters, { cache: forceRefresh ? "refresh" : "daily" }),
  purchaseRequestItems: <T>(filters: SiengeListFilters = {}, forceRefresh = false) =>
    siengeRequest<SiengePage<T>>("/v1/purchase-requests/all/items", filters, { cache: forceRefresh ? "refresh" : "daily" }),
  purchaseQuotations: <T>(filters: SiengeListFilters = {}, forceRefresh = false) =>
    siengeRequest<T>("/bulk-data/v1/purchase-quotations", filters, { cache: forceRefresh ? "refresh" : "daily" })
};
