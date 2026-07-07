// Regras de prazo da cotação compartilhadas entre as rotas do portal, a página
// pública e as telas internas. O prazo vale até o fim do dia informado.

export function quotationDeadlineEnd(deadline?: string): Date | undefined {
  const match = String(deadline || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return undefined;
  const end = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59, 999);
  return Number.isFinite(end.getTime()) ? end : undefined;
}

export function quotationClosedForResponses(deadline?: string, now = new Date()) {
  const end = quotationDeadlineEnd(deadline);
  return Boolean(end && now.getTime() > end.getTime());
}

// Dias corridos restantes até o fim do prazo: 0 = encerra hoje; undefined = sem prazo.
export function daysUntilQuotationDeadline(deadline?: string, now = new Date()): number | undefined {
  const end = quotationDeadlineEnd(deadline);
  if (!end) return undefined;
  const remaining = end.getTime() - now.getTime();
  if (remaining < 0) return -1;
  return Math.floor(remaining / 86400000);
}

// Validade do link limitada ao prazo da cotação: nunca além do fim do prazo,
// com um mínimo de 1 hora para links gerados em cima da hora.
export function cappedExpiresInDays(requestedDays: number, deadline?: string, now = new Date()): number {
  const days = Number.isFinite(requestedDays) && requestedDays > 0 ? requestedDays : 7;
  const end = quotationDeadlineEnd(deadline);
  if (!end) return days;
  const untilDeadlineDays = (end.getTime() - now.getTime()) / 86400000;
  if (untilDeadlineDays <= 0) return days;
  return Math.max(1 / 24, Math.min(days, untilDeadlineDays));
}
