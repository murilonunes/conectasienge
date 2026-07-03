import { QuotationsPortal } from "@/components/purchases/quotations-portal";
import { PageHeading } from "@/components/ui/page-heading";
import { loadQuotationPortalData } from "@/features/quotations/data";

export const dynamic = "force-dynamic";

export default async function QuotationsPage({
  searchParams
}: {
  searchParams?: { solicitacao?: string };
}) {
  const requestId = Number(searchParams?.solicitacao);
  const data = await loadQuotationPortalData(Number.isFinite(requestId) && requestId > 0 ? requestId : undefined);

  return (
    <>
      <PageHeading
        eyebrow="Compras"
        title="Cotações"
        subtitle=""
      />

      <QuotationsPortal data={data} />
    </>
  );
}
