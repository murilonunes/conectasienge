import { notFound } from "next/navigation";
import { SupplierQuoteResponseForm } from "@/components/suppliers/supplier-quote-response-form";
import { loadQuotationDetail } from "@/features/quotations/data";
import { hasSupplierQuoteResponse, verifyActiveSupplierQuoteToken } from "@/lib/supplier-quote-portal";

export const dynamic = "force-dynamic";

export default async function SupplierQuotePortalPage({ params }: { params: { token: string } }) {
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

  if (hasSupplierQuoteResponse(params.token)) {
    return (
      <section className="supplier-public-shell">
        <div className="card supplier-portal-success">
          <span>Portal de cotação</span>
          <h2>Proposta já enviada</h2>
          <p>Este link já foi utilizado para enviar uma proposta e não aceita um novo envio. Se precisar revisar valores ou prazos, peça ao comprador um novo link.</p>
        </div>
      </section>
    );
  }

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
