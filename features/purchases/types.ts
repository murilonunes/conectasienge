export type PurchaseOrderStatus = "PENDING" | "PARTIALLY_DELIVERED" | "FULLY_DELIVERED" | "CANCELED" | string;

export type PurchaseOrder = {
  id: number;
  formattedPurchaseOrderId?: string;
  status?: PurchaseOrderStatus;
  authorized?: boolean;
  disapproved?: boolean;
  deliveryLate?: boolean;
  consistent?: string;
  supplierId?: number;
  buildingId?: number;
  buyerId?: string;
  date?: string;
  internalNotes?: string;
  costCenterId?: number;
  departamentId?: number;
  companyBillId?: number;
  forecastBillId?: number;
  discount?: number;
  increase?: number;
  totalAmount?: number;
  createdBy?: string;
  createdAt?: string;
  modifiedAt?: string;
  authorizedAt?: string;
  sentDate?: string;
  notes?: string;
  paymentCondition?: string;
};

export type PurchaseInvoice = {
  sequentialNumber: number;
  documentId?: string;
  number?: string;
  series?: string;
  supplierId?: number;
  companyId?: number;
  movementTypeId?: number;
  movementDate?: string;
  issueDate?: string;
  consistency?: string;
  createdBy?: string;
  createdAt?: string;
};

export type PurchaseRequestItem = {
  purchaseRequestId: number;
  itemNumber: number;
  productId?: number;
  productDescription?: string;
  detailId?: number;
  detailDescription?: string;
  trademarkId?: number;
  trademarkDescription?: string;
  quantity?: number;
  unitySymbol?: string;
  notes?: string;
  authorized?: boolean;
  disapproved?: boolean;
  competenceLevel?: number;
  estimatedDeliveryTime?: number;
};

export type PurchaseQuotationItem = {
  purchaseQuotationItemId?: number;
  buildingId?: number;
  productId?: number;
  productDescription?: string;
  detailDescription?: string;
  quantity?: number;
  unitySimbol?: string;
  unitySymbol?: string;
  notes?: string;
};

export type PurchaseQuotationNegotiation = {
  negotiationId?: number;
  registeredDate?: string;
  responseDate?: string;
  expirationDate?: string;
  sellersName?: string;
  totalValue?: number;
  discount?: number;
  freight?: number;
  negotiationItems?: Array<{
    selectedOption?: boolean;
    totalValue?: number;
    unitPrice?: number;
    negotiatedQuantity?: number;
    quotedQuantity?: number;
  }>;
};

export type PurchaseQuotationSupplier = {
  supplierId?: number;
  negotiations?: PurchaseQuotationNegotiation[];
};

export type PurchaseQuotation = {
  purchaseQuotationId: number;
  registeredDate?: string;
  lastModification?: string;
  purchaseQuotationDate?: string;
  sentDate?: string;
  responseDeadline?: string;
  notes?: string;
  minNumberOfSuppliers?: number;
  suggestedNumberOfSuppliers?: number;
  buyerId?: string;
  purchaseQuotationItems?: PurchaseQuotationItem[];
  purchaseQuotationSuppliers?: PurchaseQuotationSupplier[];
};

export type PurchaseSourceStat = {
  key: "orders" | "invoices" | "requests" | "quotations";
  label: string;
  endpoint: string;
  apiCount: number;
  loadedCount: number;
  status: "ok" | "partial" | "empty" | "error";
};

export type PurchaseFlowItem = {
  id: string;
  kind: "request" | "quotation" | "order" | "invoice";
  kindLabel: string;
  code: string;
  title: string;
  subtitle: string;
  date?: string;
  futureDate?: string;
  amount: number;
  quantity?: number;
  status: string;
  pending: boolean;
  late?: boolean;
  buyer?: string;
  supplier?: string;
  building?: string;
  raw: PurchaseOrder | PurchaseInvoice | PurchaseRequestItem | PurchaseQuotation;
};
