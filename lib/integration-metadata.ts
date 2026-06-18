export type SiengeIntegrationMetadata = {
  __siengeIntegrationDay?: string;
  __siengeIntegratedAt?: string;
};

export function annotateSiengeRecord<T>(item: T, day: string, integratedAt: string): T {
  if (!item || typeof item !== "object" || Array.isArray(item)) return item;
  return {
    ...item,
    __siengeIntegrationDay: day,
    __siengeIntegratedAt: integratedAt
  };
}

export function annotateSiengeResponse<T>(value: T, day: string, integratedAt: string): T {
  if (!value || typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map((item) => annotateSiengeRecord(item, day, integratedAt)) as T;
  }

  const response = value as Record<string, unknown>;
  const hasList = Array.isArray(response.results) || Array.isArray(response.data);
  return {
    ...response,
    ...(!hasList ? { __siengeIntegrationDay: day, __siengeIntegratedAt: integratedAt } : {}),
    ...(Array.isArray(response.results)
      ? { results: response.results.map((item) => annotateSiengeRecord(item, day, integratedAt)) }
      : {}),
    ...(Array.isArray(response.data)
      ? { data: response.data.map((item) => annotateSiengeRecord(item, day, integratedAt)) }
      : {})
  } as T;
}

function metadata(item?: unknown): SiengeIntegrationMetadata {
  return (item && typeof item === "object" ? item : {}) as SiengeIntegrationMetadata;
}

export function integrationDateLabel(item?: unknown) {
  const meta = metadata(item);
  if (!meta.__siengeIntegrationDay && !meta.__siengeIntegratedAt) return "Integração não informada";
  const value = meta.__siengeIntegratedAt || `${meta.__siengeIntegrationDay}T12:00:00`;
  try {
    return `Integrado em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value))}`;
  } catch {
    return `Integrado em ${meta.__siengeIntegrationDay || meta.__siengeIntegratedAt}`;
  }
}

export function integrationDateTimeLabel(item?: unknown) {
  const meta = metadata(item);
  if (!meta.__siengeIntegrationDay && !meta.__siengeIntegratedAt) return "Integração não informada";
  const value = meta.__siengeIntegratedAt || `${meta.__siengeIntegrationDay}T12:00:00`;
  try {
    return `Integrado em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))}`;
  } catch {
    return `Integrado em ${meta.__siengeIntegrationDay || meta.__siengeIntegratedAt}`;
  }
}
