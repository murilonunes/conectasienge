import { PurchasesPortal } from "@/components/purchases/purchases-portal";
import { ApiErrorNotice } from "@/components/ui/api-error-notice";
import { PageHeading } from "@/components/ui/page-heading";
import { analyzePurchases, loadPurchases } from "@/features/purchases/data";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const result = await loadPurchases();
  const summary = analyzePurchases(result);

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
        <PurchasesPortal summary={summary} warning={result.warning} />
      )}
    </>
  );
}
