import { notFound } from "next/navigation";
import { SupplierQuoteResponseForm } from "@/components/suppliers/supplier-quote-response-form";
import { SupplierQuoteSubmittedView } from "@/components/suppliers/supplier-quote-submitted-view";
import { loadQuotationDetail } from "@/features/quotations/data";
import { loadSupplierQuoteResponseByToken, verifyActiveSupplierQuoteToken } from "@/lib/supplier-quote-portal";

export const dynamic = "force-dynamic";

export default async function SupplierQuotePortalPage({ params }: { params: { token: string } }) {
  const submittedResponse = loadSupplierQuoteResponseByToken(params.token);
  if (submittedResponse) {
    const quotation = await loadQuotationDetail(submittedResponse.quotationId);
    if (!quotation) notFound();

    return (
      <section className="supplier-public-shell">
        <SupplierQuoteSubmittedView
          token={params.token}
          quotationCode={quotation.code}
          items={quotation.items}
          response={submittedResponse}
          canRequestNewLink
        />
      </section>
    );
  }

  let payload;
  try {
    payload = verifyActiveSupplierQuoteToken(params.token);
  } catch (error) {
    return (
      <section className="supplier-public-shell">
        <div className="card supplier-portal-success supplier-portal-error">
          <span>Portal de cotação</span>
          <h2>Link indisponível</h2>
          <p>{error instanceof Error ? error.message : "Não foi possível validar este link."}</p>
        </div>
      </section>
    );
  }

  if (!payload) notFound();

  const quotation = await loadQuotationDetail(payload.quotationId);
  if (!quotation) notFound();

  return (
    <section className="supplier-public-shell">
      <SupplierQuoteResponseForm
        token={params.token}
        quotationCode={quotation.code}
        items={quotation.items}
        initialDocument={payload.document}
      />
    </section>
  );
}
