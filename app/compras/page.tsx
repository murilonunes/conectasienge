import { PurchasesPortal } from "@/components/purchases/purchases-portal";
import { ApiErrorNotice } from "@/components/ui/api-error-notice";
import { PageHeading } from "@/components/ui/page-heading";
import { analyzePurchases, loadPurchases } from "@/features/purchases/data";
import type { PurchaseFlowItem } from "@/features/purchases/types";

export const dynamic = "force-dynamic";

const INITIAL_RECORD_LIMIT = 500;

function slimPurchaseRecord(item: PurchaseFlowItem): PurchaseFlowItem {
  return {
    ...item,
    raw: {
      __siengeIntegrationDay: item.raw.__siengeIntegrationDay,
      __siengeIntegratedAt: item.raw.__siengeIntegratedAt
    } as PurchaseFlowItem["raw"]
  };
}

export default async function PurchasesPage() {
  const result = await loadPurchases();
  const summary = analyzePurchases(result);
  const { flow, ...summaryWithoutFlow } = summary;
  const initialRecords = flow.slice(0, INITIAL_RECORD_LIMIT).map(slimPurchaseRecord);

  return (
    <>
      <PageHeading
        eyebrow="Portal de compras"
        title="Compras"
        subtitle="Acompanhe pendências, compras realizadas, solicitações e pedidos a partir dos dados integrados."
      />

      {result.error ? (
        <ApiErrorNotice error={result.error} />
      ) : (
        <PurchasesPortal
          summary={summaryWithoutFlow}
          records={initialRecords}
          totalRecords={flow.length}
          warning={result.warning}
        />
      )}
    </>
  );
}
