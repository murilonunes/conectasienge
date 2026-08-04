import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { I18nText } from "@/components/i18n/i18n-text";
import { PrintButton } from "@/components/ui/print-button";
import { loadQuotationDetail } from "@/features/quotations/data";
import { getSessionUserFromCookieValue } from "@/lib/app-users";
import { formatOptionalDate } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function SupplierQuotationRequestPage({ params }: { params: { id: string } }) {
  const user = getSessionUserFromCookieValue(cookies().get("brasin_session")?.value);
  if (!user?.permissions.includes("screen.cotacoes")) {
    return (
      <main className="supplier-request-report">
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

  return (
    <>
      <style>{"@page { size: A4 landscape; margin: 10mm; }"}</style>
      <main className="supplier-request-report">
        <div className="supplier-request-actions">
          <Link className="button secondary" href={`/cotacoes/${id}`}><I18nText text="Voltar para a cotação" /></Link>
          <PrintButton />
        </div>

        <header className="supplier-request-head">
          <div>
            <span><I18nText text="Brasin Empreendimentos - Compras" /></span>
            <h1><I18nText text="Solicitação de proposta comercial" /></h1>
            <p><I18nText text="Cotação #" />{quotation.code} <I18nText text="- gerada em" /> {new Date().toLocaleDateString("pt-BR")}</p>
          </div>
          <div className="supplier-request-summary">
            <span><strong>{quotation.items.length}</strong><small><I18nText text="Itens solicitados" /></small></span>
            <span><strong>{formatOptionalDate(quotation.deadline)}</strong><small><I18nText text="Prazo de respostas" /></small></span>
          </div>
        </header>

        <section className="supplier-request-identification">
          <div><strong><I18nText text="Comprador" /></strong><span>{quotation.buyerId || <I18nText text="Não informado" />}</span></div>
          <div><strong><I18nText text="Data da cotação" /></strong><span>{formatOptionalDate(quotation.date)}</span></div>
          <div><strong><I18nText text="Fornecedor / razão social" /></strong><span className="supplier-request-fill" /></div>
          <div><strong><I18nText text="CNPJ" /></strong><span className="supplier-request-fill" /></div>
          <div><strong><I18nText text="Contato" /></strong><span className="supplier-request-fill" /></div>
          <div><strong><I18nText text="E-mail / telefone" /></strong><span className="supplier-request-fill" /></div>
        </section>

        <section className="supplier-request-intro">
          <strong><I18nText text="Instruções ao fornecedor" /></strong>
          <p><I18nText text="Solicitamos uma proposta para os itens abaixo. Informe valores, prazo de entrega, frete, pagamento e validade da proposta." /></p>
          {quotation.notes && <p><strong><I18nText text="Observação da cotação:" /></strong> {quotation.notes}</p>}
        </section>

        <section className="supplier-request-items">
          <table>
            <thead>
              <tr>
                <th><I18nText text="Item" /></th>
                <th><I18nText text="Insumo / especificação" /></th>
                <th><I18nText text="Quantidade" /></th>
                <th><I18nText text="Unidade" /></th>
                <th><I18nText text="Observação" /></th>
                <th><I18nText text="Preço unitário" /></th>
                <th><I18nText text="Total" /></th>
                <th><I18nText text="Prazo diferente (dias)" /></th>
              </tr>
            </thead>
            <tbody>
              {quotation.items.map((item, index) => (
                <tr key={item.itemNumber}>
                  <td><strong>{index + 1}</strong></td>
                  <td>
                    <strong><span>#{item.productId || item.itemNumber}</span> {item.name}</strong>
                    {item.detail && <small>{item.detail}</small>}
                  </td>
                  <td><strong>{item.quantity}</strong></td>
                  <td>{item.unit}</td>
                  <td>{item.notes || <I18nText text="-" />}</td>
                  <td><span className="supplier-request-fill" /></td>
                  <td><span className="supplier-request-fill" /></td>
                  <td><span className="supplier-request-fill" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="supplier-request-terms">
          <h2><I18nText text="Condições comerciais da proposta" /></h2>
          <div>
            <span><strong><I18nText text="Forma de pagamento" /></strong><i /></span>
            <span><strong><I18nText text="Frete" /></strong><i /></span>
            <span><strong><I18nText text="Prazo geral de entrega (dias)" /></strong><i /></span>
            <span><strong><I18nText text="Validade da proposta" /></strong><i /></span>
            <span><strong><I18nText text="Desconto" /></strong><i /></span>
            <span><strong><I18nText text="Valor total da proposta" /></strong><i /></span>
          </div>
          <p><strong><I18nText text="Observações gerais" /></strong><span className="supplier-request-fill" /></p>
        </section>

        <footer className="supplier-request-footer">
          <p><I18nText text="Esta solicitação não representa um pedido de compra. O fornecimento depende da emissão de pedido formal pela Brasin Empreendimentos." /></p>
          <div><span /><small><I18nText text="Responsável pela proposta" /></small></div>
        </footer>
      </main>
    </>
  );
}
