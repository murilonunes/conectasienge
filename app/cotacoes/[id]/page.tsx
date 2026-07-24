import { I18nText } from "@/components/i18n/i18n-text";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QuotationDetail } from "@/components/purchases/quotation-detail";
import { loadKnownBuyerIds, loadQuotationDetail } from "@/features/quotations/data";
import { loadSupplierQuoteAwards, loadSupplierQuoteEvents, loadSupplierQuoteInvitations, loadSupplierQuoteResponses, loadSupplierRegistrationReviews } from "@/lib/supplier-quote-portal";

export const dynamic = "force-dynamic";

export default async function QuotationDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  const quotation = await loadQuotationDetail(id);
  if (!quotation) notFound();
  const supplierResponses = loadSupplierQuoteResponses(id);
  const supplierAwards = loadSupplierQuoteAwards(id);
  const supplierInvitations = loadSupplierQuoteInvitations(id);
  const supplierEvents = loadSupplierQuoteEvents(id);
  const supplierReviews = loadSupplierRegistrationReviews(
    supplierResponses.filter((response) => response.registrationPending).map((response) => response.document)
  );
  const knownBuyerIds = await loadKnownBuyerIds();

  return (
    <>
      <div className="page-actions">
        <Link className="button secondary" href="/cotacoes"><I18nText text={"Voltar para cotações"} /></Link>
      </div>

      <QuotationDetail
        quotation={quotation}
        supplierResponses={supplierResponses}
        supplierAwards={supplierAwards}
        supplierInvitations={supplierInvitations}
        supplierEvents={supplierEvents}
        supplierReviews={supplierReviews}
        knownBuyerIds={knownBuyerIds}
      />
    </>
  );
}
