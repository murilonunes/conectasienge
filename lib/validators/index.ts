export const isDocumentId = (value: string) => /^[A-Za-z0-9./-]{3,40}$/.test(value.trim());
export const isPositiveAmount = (value: number) => Number.isFinite(value) && value > 0;
