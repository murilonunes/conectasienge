import { ResourceTraceability } from "@/components/purchases/resource-traceability";
import { ApiErrorNotice } from "@/components/ui/api-error-notice";
import { PageHeading } from "@/components/ui/page-heading";
import { loadResourceTraceability } from "@/features/resource-traceability/data";

export const dynamic = "force-dynamic";

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function ResourceTraceabilityPage({ searchParams = {} }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const result = await loadResourceTraceability(param(searchParams.q), param(searchParams.insumo));

  return (
    <>
      <PageHeading
        eyebrow="Compras"
        title="Rastreabilidade de insumos"
        subtitle="Solicitações, pedidos e notas fiscais relacionados ao mesmo insumo."
      />
      {result.error ? <ApiErrorNotice error={result.error} /> : <ResourceTraceability result={result} />}
    </>
  );
}
