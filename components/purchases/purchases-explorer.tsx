"use client";

import { I18nText } from "@/components/i18n/i18n-text";
import { useEffect, useMemo, useState } from "react";
import { IntegrationStamp } from "@/components/ui/integration-stamp";
import type { PurchaseFlowItem } from "@/features/purchases/types";
import { formatCompactCurrency, formatCurrency, formatOptionalDate } from "@/lib/formatters";

function badgeClass(item: PurchaseFlowItem) {
  if (item.late) return "badge late";
  if (item.pending) return "badge pending";
  return "badge";
}

type PurchasesRecordsResponse = {
  items: PurchaseFlowItem[];
  totalRecords: number;
  filteredCount: number;
  totalAmount: number;
  statuses: string[];
  page: number;
  pageSize: number;
  totalPages: number;
  error?: string;
};

const PAGE_SIZE_OPTIONS = [50, 100, 200, 500];

export function PurchasesExplorer({ totalRecords }: { totalRecords: number }) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [payload, setPayload] = useState<PurchasesRecordsResponse>({
    items: [],
    totalRecords,
    filteredCount: 0,
    totalAmount: 0,
    statuses: [],
    page: 1,
    pageSize: 100,
    totalPages: 1
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>();

  const queryKey = useMemo(() => `${search}|${kind}|${status}|${pageSize}`, [search, kind, status, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [queryKey]);

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize)
    });
    if (search.trim()) query.set("search", search.trim());
    if (kind) query.set("kind", kind);
    if (status) query.set("status", status);

    setLoading(true);
    setMessage(undefined);
    fetch(`/api/purchases/records?${query}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "Não foi possível carregar os registros.");
        return body as PurchasesRecordsResponse;
      })
      .then((body) => {
        if (!active) return;
        setPayload(body);
      })
      .catch((error) => {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "Erro inesperado ao carregar os registros.");
        setPayload((current) => ({ ...current, items: [], filteredCount: 0, totalAmount: 0, totalPages: 1 }));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [search, kind, status, page, pageSize]);

  function changePageSize(value: string) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) setPageSize(parsed);
  }

  return (
    <section>
      <div className="card purchases-filters">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar solicitação, pedido, nota, fornecedor, comprador ou obra" data-i18n-placeholder={"Buscar solicitação, pedido, nota, fornecedor, comprador ou obra"} />
        <select value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value=""><I18nText text={"Todos os tipos"} /></option>
          <option value="request"><I18nText text={"Solicitações"} /></option>
          <option value="quotation"><I18nText text={"Cotações"} /></option>
          <option value="order"><I18nText text={"Pedidos"} /></option>
          <option value="invoice"><I18nText text={"Notas fiscais"} /></option>
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value=""><I18nText text={"Todas as situações"} /></option>
          {payload.statuses.map((item) => <option key={item}>{item}</option>)}
        </select>
        <div>
          <strong>{payload.filteredCount}</strong>
          <span>{payload.filteredCount === totalRecords ? <I18nText text={"registros"} /> : `de ${totalRecords} registros salvos`}</span>
          <strong><I18nText text={formatCompactCurrency(payload.totalAmount)} /></strong>
        </div>
      </div>

      {message && <div className="card data-notice"><strong><I18nText text={"Registros"} /></strong><span><I18nText text={message} /></span></div>}

      <div className="local-data-list">
        <div className="local-list-controls top">
          <div>
            <strong>{payload.filteredCount}</strong>
            <span><I18nText text={"registros de compra"} /></span>
            <small>{loading ? <I18nText text={"Carregando..."} /> : `Página ${payload.page} de ${payload.totalPages}`}</small>
          </div>
          <label>
            <I18nText text={"Registros por página"} />
            <select value={pageSize} onChange={(event) => changePageSize(event.target.value)}>
              {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <div className="local-list-pages">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || page <= 1}>
              <I18nText text={"Anterior"} />
            </button>
            <span><I18nText text={"Página"} /> {payload.page} <I18nText text={"de"} /> {payload.totalPages}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(payload.totalPages, current + 1))} disabled={loading || page >= payload.totalPages}>
              <I18nText text={"Próxima"} />
            </button>
          </div>
        </div>

        {loading ? <div className="empty-state"><I18nText text={"Carregando registros de compra..."} /></div> : payload.items.length ? (
          <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th><I18nText text={"Origem"} /></th>
                <th><I18nText text={"Descrição"} /></th>
                <th><I18nText text={"Data"} /></th>
                <th><I18nText text={"Valor / quantidade"} /></th>
                <th><I18nText text={"Responsável"} /></th>
                <th><I18nText text={"Situação"} /></th>
                <th><I18nText text={"Integração"} /></th>
              </tr>
            </thead>
            <tbody>
              {payload.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong><I18nText text={item.kindLabel} /></strong>
                    <br />
                    <span className="table-muted"><I18nText text={"#"} />{item.code}</span>
                  </td>
                  <td>
                    <strong>{item.title}</strong>
                    <br />
                    <span className="table-muted">{item.subtitle}</span>
                  </td>
                  <td>{formatOptionalDate(item.date, "Sem data")}</td>
                  <td>
                    <strong>{item.amount ? formatCurrency(item.amount) : <I18nText text={"Sem valor"} />}</strong>
                    <br />
                    <span className="table-muted">{item.quantity ? `${item.quantity} unidade(s)` : item.kindLabel}</span>
                  </td>
                  <td>
                    {item.buyer || item.supplier || item.building || <I18nText text={"Não informado"} />}
                    <br />
                    <span className="table-muted">{[item.supplier, item.building].filter(Boolean).join(" - ")}</span>
                  </td>
                  <td><span className={badgeClass(item)}>{item.late ? <I18nText text={"Entrega atrasada"} /> : item.status}</span></td>
                  <td><IntegrationStamp record={item.raw} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        ) : <div className="empty-state"><I18nText text={"Nenhum registro de compra encontrado."} /></div>}
      </div>
    </section>
  );
}
