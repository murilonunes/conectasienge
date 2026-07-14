import { PurchasesPortal } from "@/components/purchases/purchases-portal";
import { ApiErrorNotice } from "@/components/ui/api-error-notice";
import { PageHeading } from "@/components/ui/page-heading";
import { analyzePurchases, loadPurchases } from "@/features/purchases/data";
import { buildSupplyOverview, filterPurchasesBySupplyPeriod, supplyPeriodFilterFromParams } from "@/features/purchases/supply-overview";

export const dynamic = "force-dynamic";

export default async function PurchasesPage({ searchParams = {} }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const result = await loadPurchases();
  const periodFilter = supplyPeriodFilterFromParams(searchParams);
  const filtered = filterPurchasesBySupplyPeriod(result, periodFilter);
  const summary = analyzePurchases(filtered.purchases);
  const overview = buildSupplyOverview(filtered.purchases, periodFilter, filtered.undatedRequests);
  const totalRecords = analyzePurchases(result).flow.length;
  const { flow, ...summaryWithoutFlow } = summary;

  return (
    <>
      <PageHeading
        eyebrow="Portal de compras"
        title="Suprimentos"
        subtitle="O cenário atual da cadeia de compras: o que espera cotação, o que espera decisão, o que está a caminho e o que travou."
      />

      {result.error ? (
        <ApiErrorNotice error={result.error} />
      ) : (
        <PurchasesPortal
          summary={summaryWithoutFlow}
          overview={overview}
          totalRecords={totalRecords}
          warning={result.warning}
        />
      )}
    </>
  );
}
