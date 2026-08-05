import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { I18nText } from "@/components/i18n/i18n-text";
import { PrintButton } from "@/components/ui/print-button";
import { loadQuotationDetail } from "@/features/quotations/data";
import { getSessionUserFromCookieValue } from "@/lib/app-users";

export const dynamic = "force-dynamic";

export default async function CompactSupplierRequestPage({ params }: { params: { id: string } }) {
  const user = getSessionUserFromCookieValue(cookies().get("brasin_session")?.value);
  if (!user?.permissions.includes("screen.cotacoes")) {
    return (
      <main className="supplier-request-report supplier-request-compact">
        <section className="card panel access-denied-panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title"><I18nText text="Acesso não liberado" /></h2>
              <span className="panel-note"><I18nText text="Seu usuário não tem permissão para relatórios de cotação" /></span>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  const quotation = await loadQuotationDetail(id);
  if (!quotation) notFound();
  const requestLabel = quotation.purchaseRequestIds.length
    ? quotation.purchaseRequestIds.map((requestId) => `SC-${requestId}`).join(", ")
    : null;

  return (
    <>
      <style>{"@page { size: A4 portrait; margin: 12mm; }"}</style>
      <main className="supplier-request-report supplier-request-compact">
        <div className="supplier-request-actions">
          <Link className="button secondary" href={`/cotacoes/${id}`}><I18nText text="Voltar para a cotação" /></Link>
          <Link className="button secondary" href={`/cotacoes/${id}/solicitacao-fornecedor`}><I18nText text="Versão completa" /></Link>
          <PrintButton />
        </div>

        <header className="supplier-request-head">
          <div>
            <span><I18nText text="Brasin Empreendimentos - Compras" /></span>
            <h1><I18nText text="Lista de insumos" /></h1>
          </div>
          <dl className="supplier-request-meta">
            <div><dt><I18nText text="Nº da solicitação" /></dt><dd>{requestLabel || <I18nText text="Não identificada" />}</dd></div>
            <div><dt><I18nText text="Comprador" /></dt><dd>{quotation.buyerId || <I18nText text="Não informado" />}</dd></div>
          </dl>
        </header>

        <section className="supplier-request-items">
          <table>
            <thead>
              <tr>
                <th><I18nText text="Nº" /></th>
                <th><I18nText text="Insumo / especificação" /></th>
                <th><I18nText text="Quantidade" /></th>
              </tr>
            </thead>
            <tbody>
              {quotation.items.map((item, index) => (
                <tr key={item.itemNumber}>
                  <td><strong>{index + 1}</strong></td>
                  <td>
                    <strong><span>#{item.productId || item.itemNumber}</span> {item.name}</strong>
                    {item.detail && <small>{item.detail}</small>}
                    {item.notes && <small><I18nText text="Observação:" /> {item.notes}</small>}
                  </td>
                  <td><strong>{item.quantity}</strong> <small>{item.unit}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
