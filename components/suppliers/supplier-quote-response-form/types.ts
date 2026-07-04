export type ResponseItem = {
  itemNumber: number;
  attends: boolean;
  unitPrice: string;
  quantity: string;
  deadlineDays: string;
  notes: string;
};

export type InstallmentRow = {
  days: string;
  percentage: string;
};

export type FreightType = "" | "NONE" | "INCLUDED" | "PAID";

export type RegistrationData = {
  tradeName: string;
  city: string;
  state: string;
};

export type WizardStep = 1 | 2 | 3 | 4 | 5;
