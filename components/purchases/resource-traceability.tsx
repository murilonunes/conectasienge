import { ClipboardList, FileText, PackageSearch, Search, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { I18nText } from "@/components/i18n/i18n-text";
import type {
  ResourceInvoiceTrace,
  ResourceOrderTrace,
  ResourceRequestTrace,
  ResourceTraceabilityResult
} from "@/features/resource-traceability/data";
import { formatCurrency, formatOptionalDate } from "@/lib/formatters";

function formatQuantity(value: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(value);
}

function consistencyLabel(value?: string) {
  if (value === "S") return "Consistente";
  if (value === "I") return "Em inclusão";
  if (value === "N") return "Inconsistente";
  return "Não informada";
}

function consistencyClass(value?: string) {
  if (value === "S") return "badge";
  if (value === "I") return "badge pending";
  return "badge late";
}

function authorizationLabel(value?: string) {
  if (value === "S") return "Autorizado";
  if (value === "N") return "Não autorizado";
  return "Autorização não informada";
}

function linkedIds(prefix: string, ids: string[]) {
  if (!ids.length) return <I18nText text="Sem vínculo identificado" />;
  return ids.map((id) => `${prefix}-${id}`).join(", ");
}

function requestDescription(item: ResourceRequestTrace) {
  return [item.description, item.detail].filter(Boolean).join(" - ");
}

function orderDescription(item: ResourceOrderTrace) {
  return [item.description, item.detail].filter(Boolean).join(" - ");
}

function invoiceDescription(item: ResourceInvoiceTrace) {
  return [item.description, item.detail].filter(Boolean).join(" - ");
}

function resourceHref(query: string, key: string) {
  const params = new URLSearchParams({ q: query, insumo: key });
  return `/rastreabilidade-insumos?${params.toString()}`;
}

export function ResourceTraceability({ result }: { result: ResourceTraceabilityResult }) {
  const selected = result.selected;
  const requestCount = new Set(result.requests.map((item) => item.requestId)).size;
  const orderCount = new Set(result.orders.map((item) => item.orderId)).size;
  const invoiceCount = new Set(result.invoices.map((item) => item.invoiceId)).size;
  const orderedAmount = result.orders.reduce((sum, item) => sum + item.total, 0);
  const invoicedAmount = result.invoices.reduce((sum, item) => sum + item.total, 0);

  return (
    <>
      <form className="card resource-trace-search" method="get">
        <Search aria-hidden="true" size={18} />
        <input
          aria-label="Pesquisar insumo"
          data-i18n-aria-label="Pesquisar insumo"
          data-i18n-placeholder="Código, descrição, sinônimo ou código auxiliar"
          defaultValue={result.query}
          name="q"
          placeholder="Código, descrição, sinônimo ou código auxiliar"
        />
        <button className="button" type="submit"><Search aria-hidden="true" size={15} /><I18nText text="Pesquisar" /></button>
      </form>

      {!result.query ? (
        <div className="empty-state resource-trace-empty">
          <PackageSearch aria-hidden="true" size={28} />
          <strong><I18nText text="Rastreabilidade por insumo" /></strong>
          <span><I18nText text="Pesquise um código ou descrição para consultar o histórico de compras." /></span>
        </div>
      ) : !result.matches.length ? (
        <div className="empty-state resource-trace-empty">
          <PackageSearch aria-hidden="true" size={28} />
          <strong><I18nText text="Nenhum insumo encontrado" /></strong>
          <span><I18nText text="Revise o código ou a descrição pesquisada." /></span>
        </div>
      ) : (
        <div className="resource-trace-layout">
          <aside className="resource-trace-results" aria-label="Insumos encontrados">
            <div className="resource-trace-results-head">
              <strong><I18nText text="Insumos encontrados" /></strong>
              <span>{result.matches.length}{result.totalMatches > result.matches.length ? ` de ${result.totalMatches}` : ""}</span>
            </div>
            <div className="resource-trace-result-list">
              {result.matches.map((resource) => (
                <Link
                  className={resource.key === selected?.key ? "active" : ""}
                  href={resourceHref(result.query, resource.key)}
                  key={resource.key}
                >
                  <span>#{resource.resourceId}</span>
                  <strong>{resource.description}</strong>
                  <small>
                    {[`Tabela #${resource.tableId}`, resource.auxiliaryCode ? `Aux. ${resource.auxiliaryCode}` : "", resource.active ? "Ativo" : "Inativo"].filter(Boolean).join(" | ")}
                  </small>
                  <small><strong>{resource.movementCount}</strong> <I18nText text="registros de compra" /></small>
                </Link>
              ))}
            </div>
          </aside>

          {selected && (
            <div className="resource-trace-content">
              <header className="resource-trace-selected">
                <div>
                  <span className="resource-trace-code">#{selected.resourceId}</span>
                  <h2>{selected.description}</h2>
                  <p>
                    <span><I18nText text="Tabela" /> #{selected.tableId}</span>
                    {selected.auxiliaryCode && <span><I18nText text="Código auxiliar" /> {selected.auxiliaryCode}</span>}
                    {selected.synonym && <span><I18nText text="Sinônimo" /> {selected.synonym}</span>}
                  </p>
                </div>
                <div className="resource-trace-source">
                  <span className={selected.active ? "badge" : "badge pending"}><I18nText text={selected.active ? "Ativo" : "Inativo"} /></span>
                  <small><I18nText text="Histórico do dump" /> {result.sourceFileName || "Sienge"}</small>
                  <small><I18nText text="Importado em" /> {formatOptionalDate(result.sourceUpdatedAt)}</small>
                </div>
              </header>

              <div className="resource-trace-stats">
                <div><ClipboardList aria-hidden="true" size={17} /><span><I18nText text="Solicitações" /></span><strong>{requestCount}</strong><small>{formatQuantity(result.requests.reduce((sum, item) => sum + item.quantity, 0))} <I18nText text="solicitado" /></small></div>
                <div><ShoppingCart aria-hidden="true" size={17} /><span><I18nText text="Pedidos" /></span><strong>{orderCount}</strong><small>{formatCurrency(orderedAmount)}</small></div>
                <div><FileText aria-hidden="true" size={17} /><span><I18nText text="Notas fiscais" /></span><strong>{invoiceCount}</strong><small>{formatCurrency(invoicedAmount)}</small></div>
              </div>

              <section className="resource-trace-stage">
                <div className="panel-head">
                  <div><h3 className="panel-title"><I18nText text="Solicitações de compra" /></h3><span className="panel-note"><I18nText text="Origem da necessidade e pedidos vinculados" /></span></div>
                  <span className="badge">{requestCount}</span>
                </div>
                {result.requests.length ? (
                  <div className="card table-card"><table>
                    <thead><tr><th><I18nText text="Solicitação / item" /></th><th><I18nText text="Data" /></th><th><I18nText text="Quantidade" /></th><th><I18nText text="Obra" /></th><th><I18nText text="Situação" /></th><th><I18nText text="Pedidos vinculados" /></th></tr></thead>
                    <tbody>{result.requests.map((item) => <tr key={`${item.requestId}:${item.itemNumber}`}>
                      <td><strong>SC-{item.requestId} <span className="table-muted">/ {item.itemNumber}</span></strong><small>{requestDescription(item)}</small>{item.notes && <small>{item.notes}</small>}</td>
                      <td>{formatOptionalDate(item.date)}</td>
                      <td><strong>{formatQuantity(item.quantity)}</strong></td>
                      <td>{item.buildingId ? `#${item.buildingId}` : <I18nText text="Não informada" />}</td>
                      <td><span className={consistencyClass(item.consistency)}><I18nText text={consistencyLabel(item.consistency)} /></span><small><I18nText text={authorizationLabel(item.authorized)} /></small></td>
                      <td>{linkedIds("PC", item.orderIds)}</td>
                    </tr>)}</tbody>
                  </table></div>
                ) : <div className="empty-state"><I18nText text="Nenhuma solicitação encontrada para este insumo." /></div>}
              </section>

              <section className="resource-trace-stage">
                <div className="panel-head">
                  <div><h3 className="panel-title"><I18nText text="Pedidos de compra" /></h3><span className="panel-note"><I18nText text="Fornecimento contratado, origem e faturamento localizado" /></span></div>
                  <span className="badge">{orderCount}</span>
                </div>
                {result.orders.length ? (
                  <div className="card table-card"><table>
                    <thead><tr><th><I18nText text="Pedido / item" /></th><th><I18nText text="Data" /></th><th><I18nText text="Fornecedor" /></th><th><I18nText text="Quantidade" /></th><th><I18nText text="Preço unitário" /></th><th><I18nText text="Total do item" /></th><th><I18nText text="Origem / notas" /></th></tr></thead>
                    <tbody>{result.orders.map((item) => <tr key={`${item.orderId}:${item.itemNumber}`}>
                      <td><strong>PC-{item.orderId} <span className="table-muted">/ {item.itemNumber}</span></strong><small>{orderDescription(item)}</small></td>
                      <td>{formatOptionalDate(item.date)}</td>
                      <td><strong>{item.supplierName || (item.supplierId ? `#${item.supplierId}` : <I18nText text="Não informado" />)}</strong>{item.buildingId && <small><I18nText text="Obra" /> #{item.buildingId}</small>}</td>
                      <td><strong>{formatQuantity(item.quantity)}</strong></td>
                      <td>{formatCurrency(item.unitPrice)}</td>
                      <td><strong>{formatCurrency(item.total)}</strong></td>
                      <td><small>{linkedIds("SC", item.requestIds)}</small><small>{linkedIds("NF", item.invoiceIds)}</small></td>
                    </tr>)}</tbody>
                  </table></div>
                ) : <div className="empty-state"><I18nText text="Nenhum pedido encontrado para este insumo." /></div>}
              </section>

              <section className="resource-trace-stage">
                <div className="panel-head">
                  <div><h3 className="panel-title"><I18nText text="Notas fiscais" /></h3><span className="panel-note"><I18nText text="Entradas fiscais e pedidos relacionados" /></span></div>
                  <span className="badge">{invoiceCount}</span>
                </div>
                {result.invoices.length ? (
                  <div className="card table-card"><table>
                    <thead><tr><th><I18nText text="Nota / item" /></th><th><I18nText text="Emissão" /></th><th><I18nText text="Fornecedor" /></th><th><I18nText text="Quantidade entregue" /></th><th><I18nText text="Preço unitário" /></th><th><I18nText text="Total do item" /></th><th><I18nText text="Pedidos vinculados" /></th></tr></thead>
                    <tbody>{result.invoices.map((item) => <tr key={`${item.invoiceId}:${item.itemNumber}`}>
                      <td><strong>{[item.documentId, item.number, item.series].filter(Boolean).join(" ") || `NF-${item.invoiceId}`} <span className="table-muted">/ {item.itemNumber}</span></strong><small>{invoiceDescription(item)}</small></td>
                      <td>{formatOptionalDate(item.issueDate || item.movementDate)}</td>
                      <td><strong>{item.supplierName || (item.supplierId ? `#${item.supplierId}` : <I18nText text="Não informado" />)}</strong>{item.buildingId && <small><I18nText text="Obra" /> #{item.buildingId}</small>}</td>
                      <td><strong>{formatQuantity(item.quantity)}</strong></td>
                      <td>{formatCurrency(item.unitPrice)}</td>
                      <td><strong>{formatCurrency(item.total)}</strong></td>
                      <td>{linkedIds("PC", item.orderIds)}</td>
                    </tr>)}</tbody>
                  </table></div>
                ) : <div className="empty-state"><I18nText text="Nenhuma nota fiscal encontrada para este insumo." /></div>}
              </section>
            </div>
          )}
        </div>
      )}
    </>
  );
}
