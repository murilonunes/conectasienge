import { integrationDateLabel } from "@/lib/integration-metadata";

export function IntegrationStamp({ record }: { record?: unknown }) {
  return <span className="integration-stamp">{integrationDateLabel(record)}</span>;
}
