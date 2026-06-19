import type { ScreenUpdateHistory } from "@/lib/api/sienge-history";
import type { UpdateAreaDefinition } from "@/lib/sienge-update-areas";

export type UpdateAreaStatus = {
  status: ScreenUpdateHistory["status"];
  lastUpdatedAt?: string;
  description: string;
  successCount: number;
  errorCount: number;
};

export function areaStatus(history: ScreenUpdateHistory[], area: UpdateAreaDefinition): UpdateAreaStatus {
  if (area.key === "all") {
    const updated = history.filter((item) => item.status === "updated").length;
    const warning = history.filter((item) => item.status === "warning").length;
    return {
      status: warning ? "warning" as const : updated ? "updated" as const : "empty" as const,
      lastUpdatedAt: history.map((item) => item.lastUpdatedAt).filter(Boolean).sort().at(-1),
      description: `${updated} de ${history.length} áreas com dados salvos`,
      successCount: history.reduce((sum, item) => sum + item.successCount, 0),
      errorCount: history.reduce((sum, item) => sum + item.errorCount, 0)
    };
  }
  const item = history.find((entry) => entry.key === area.historyKey);
  return {
    status: item?.status || "empty" as const,
    lastUpdatedAt: item?.lastUpdatedAt,
    description: item?.description || area.note,
    successCount: item?.successCount || 0,
    errorCount: item?.errorCount || 0
  };
}

export function buildUpdateAreaStatuses(history: ScreenUpdateHistory[], areas: UpdateAreaDefinition[]) {
  return Object.fromEntries(
    areas.map((area) => [area.key, areaStatus(history, area)])
  );
}
