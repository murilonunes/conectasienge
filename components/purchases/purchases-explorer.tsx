"use client";

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
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar solicitação, pedido, nota, fornecedor, comprador ou obra" />
        <select value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="">Todos os tipos</option>
          <option value="request">Solicitações</option>
          <option value="quotation">Cotações</option>
          <option value="order">Pedidos</option>
          <option value="invoice">Notas fiscais</option>
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Todas as situações</option>
          {payload.statuses.map((item) => <option key={item}>{item}</option>)}
        </select>
        <div>
          <strong>{payload.filteredCount}</strong>
          <span>{payload.filteredCount === totalRecords ? "registros" : `de ${totalRecords} registros salvos`}</span>
          <strong>{formatCompactCurrency(payload.totalAmount)}</strong>
        </div>
      </div>

      {message && <div className="card data-notice"><strong>Registros</strong><span>{message}</span></div>}

      <div className="local-data-list">
        <div className="local-list-controls top">
          <div>
            <strong>{payload.filteredCount}</strong>
            <span>registros de compra</span>
            <small>{loading ? "Carregando..." : `Página ${payload.page} de ${payload.totalPages}`}</small>
          </div>
          <label>
            Registros por página
            <select value={pageSize} onChange={(event) => changePageSize(event.target.value)}>
              {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <div className="local-list-pages">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || page <= 1}>
              Anterior
            </button>
            <span>Página {payload.page} de {payload.totalPages}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(payload.totalPages, current + 1))} disabled={loading || page >= payload.totalPages}>
              Próxima
            </button>
          </div>
        </div>

        {loading ? <div className="empty-state">Carregando registros de compra...</div> : payload.items.length ? (
          <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>Origem</th>
                <th>Descrição</th>
                <th>Data</th>
                <th>Valor / quantidade</th>
                <th>Responsável</th>
                <th>Situação</th>
                <th>Integração</th>
              </tr>
            </thead>
            <tbody>
              {payload.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.kindLabel}</strong>
                    <br />
                    <span className="table-muted">#{item.code}</span>
                  </td>
                  <td>
                    <strong>{item.title}</strong>
                    <br />
                    <span className="table-muted">{item.subtitle}</span>
                  </td>
                  <td>{formatOptionalDate(item.date, "Sem data")}</td>
                  <td>
                    <strong>{item.amount ? formatCurrency(item.amount) : "Sem valor"}</strong>
                    <br />
                    <span className="table-muted">{item.quantity ? `${item.quantity} unidade(s)` : item.kindLabel}</span>
                  </td>
                  <td>
                    {item.buyer || item.supplier || item.building || "Não informado"}
                    <br />
                    <span className="table-muted">{[item.supplier, item.building].filter(Boolean).join(" - ")}</span>
                  </td>
                  <td><span className={badgeClass(item)}>{item.late ? "Entrega atrasada" : item.status}</span></td>
                  <td><IntegrationStamp record={item.raw} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        ) : <div className="empty-state">Nenhum registro de compra encontrado.</div>}
      </div>
    </section>
  );
}
