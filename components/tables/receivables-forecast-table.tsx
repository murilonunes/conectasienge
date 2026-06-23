"use client";

import { useEffect, useMemo, useState } from "react";
import { IntegrationStamp } from "@/components/ui/integration-stamp";
import { formatCurrency, formatOptionalDate } from "@/lib/formatters";

type ReceivableReceipt = {
  grossAmount?: number;
  netAmount?: number;
};

type ReceivableInstallment = {
  companyId?: number;
  companyName?: string;
  projectId?: number;
  projectName?: string;
  businessAreaName?: string;
  clientId?: number;
  clientName?: string;
  billId?: number;
  receivableBillId?: number;
  installmentId?: number;
  documentIdentificationId?: string;
  documentNumber?: string;
  documentForecast?: string;
  originalAmount?: number;
  balanceAmount?: number;
  correctedBalanceAmount?: number;
  dueDate?: string;
  mainUnit?: string;
  installmentNumber?: string;
  receipts?: ReceivableReceipt[];
  __siengeIntegrationDay?: string;
  __siengeIntegratedAt?: string;
};

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function receivableOpenAmount(entry: ReceivableInstallment) {
  const corrected = numberValue(entry.correctedBalanceAmount);
  if (corrected !== undefined) return corrected;
  const balance = numberValue(entry.balanceAmount);
  if (balance !== undefined) return balance;
  return numberValue(entry.originalAmount) ?? 0;
}

function receivablePaidAmount(entry: ReceivableInstallment) {
  return (entry.receipts || []).reduce((sum, receipt) => {
    const value = numberValue(receipt.netAmount) ?? numberValue(receipt.grossAmount) ?? 0;
    return sum + value;
  }, 0);
}

function receivableDocument(entry: ReceivableInstallment) {
  const title = entry.billId || entry.receivableBillId;
  const document = [entry.documentIdentificationId, entry.documentNumber].filter(Boolean).join(" - ");
  return document || (title ? `Título #${title}` : "Título sem número");
}

function receivableStatus(entry: ReceivableInstallment) {
  const amount = receivableOpenAmount(entry);
  if (amount <= 0) return "Recebido";
  const dueDate = parseDate(entry.dueDate);
  if (!dueDate) return "Sem vencimento";
  const today = parseDate(new Date().toISOString().slice(0, 10)) || new Date();
  if (dueDate < today) return "Em atraso";
  if (entry.documentForecast === "S") return "Previsto";
  return "A receber";
}

function titleNumber(entry: ReceivableInstallment) {
  return entry.billId || entry.receivableBillId || "sem número";
}

function badgeClass(status: string) {
  if (status === "Em atraso") return "badge late";
  if (status === "Previsto" || status === "Sem vencimento") return "badge pending";
  return "badge";
}

type ReceivablesForecastResponse = {
  items: ReceivableInstallment[];
  totalEntries: number;
  filteredCount: number;
  totalOpen: number;
  statuses: string[];
  page: number;
  pageSize: number;
  totalPages: number;
};

const PAGE_SIZE_OPTIONS = [50, 100, 200, 500];

export function ReceivablesForecastTable({ totalEntries }: { totalEntries: number }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>();
  const [payload, setPayload] = useState<ReceivablesForecastResponse>({
    items: [],
    totalEntries,
    filteredCount: 0,
    totalOpen: 0,
    statuses: [],
    page: 1,
    pageSize: 100,
    totalPages: 1
  });
  const queryKey = useMemo(() => `${search}|${status}|${pageSize}`, [search, status, pageSize]);

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
    if (status) query.set("status", status);

    setLoading(true);
    setMessage(undefined);
    fetch(`/api/receivables/forecast?${query}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "Não foi possível carregar as parcelas.");
        return body as ReceivablesForecastResponse;
      })
      .then((body) => {
        if (active) setPayload(body);
      })
      .catch((error) => {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "Erro inesperado ao carregar as parcelas.");
        setPayload((current) => ({ ...current, items: [], filteredCount: 0, totalOpen: 0, totalPages: 1 }));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [search, status, page, pageSize]);

  function changePageSize(value: string) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) setPageSize(parsed);
  }

  return (
    <section className="card table-card">
      <div className="panel-head table-head">
        <div>
          <h2 className="panel-title">Parcelas previstas a receber</h2>
          <span className="panel-note">
            {payload.filteredCount === totalEntries
              ? `${totalEntries} parcelas abertas por vencimento`
              : `${payload.filteredCount} de ${totalEntries} parcelas abertas por vencimento`}
          </span>
        </div>
        <strong>{formatCurrency(payload.totalOpen)}</strong>
      </div>

      <div className="card purchases-filters">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar título, cliente, projeto, unidade ou empresa" />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Todas as situações</option>
          {payload.statuses.map((item) => <option key={item}>{item}</option>)}
        </select>
        <div>
          <strong>{payload.filteredCount}</strong>
          <span>parcelas</span>
          <strong>{formatCurrency(payload.totalOpen)}</strong>
        </div>
      </div>

      {message && <div className="card data-notice"><strong>Parcelas</strong><span>{message}</span></div>}

      <div className="local-data-list">
        <div className="local-list-controls top">
          <div>
            <strong>{payload.filteredCount}</strong>
            <span>parcelas</span>
            <small>{loading ? "Carregando..." : `Página ${payload.page} de ${payload.totalPages}`}</small>
          </div>
          <label>
            Registros por página
            <select value={pageSize} onChange={(event) => changePageSize(event.target.value)}>
              {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <div className="local-list-pages">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || page <= 1}>Anterior</button>
            <span>Página {payload.page} de {payload.totalPages}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(payload.totalPages, current + 1))} disabled={loading || page >= payload.totalPages}>Próxima</button>
          </div>
        </div>

        {loading ? <div className="empty-state">Carregando parcelas a receber...</div> : payload.items.length ? (
          <table>
          <thead>
            <tr>
              <th>Título</th>
              <th>Cliente</th>
              <th>Vencimento</th>
              <th>Projeto / unidade</th>
              <th>Valor em aberto</th>
              <th>Recebido</th>
              <th>Situação</th>
              <th>Integração</th>
            </tr>
          </thead>
          <tbody>
            {payload.items.map((entry) => {
              const currentStatus = receivableStatus(entry);
              return (
                <tr key={`${entry.billId || entry.receivableBillId || "bill"}-${entry.installmentId || "installment"}-${entry.dueDate || "date"}`}>
                  <td>
                    <strong>{receivableDocument(entry)}</strong>
                    <br />
                    <span className="table-muted">Título #{titleNumber(entry)} - Parcela {entry.installmentNumber || entry.installmentId || "não informada"}</span>
                  </td>
                  <td>
                    {entry.clientName || "Cliente não informado"}
                    <br />
                    <span className="table-muted">{entry.clientId ? `Cliente #${entry.clientId}` : entry.companyName || ""}</span>
                  </td>
                  <td>{formatOptionalDate(entry.dueDate)}</td>
                  <td>
                    {entry.projectName || entry.businessAreaName || "Não informado"}
                    <br />
                    <span className="table-muted">{entry.mainUnit || entry.companyName || ""}</span>
                  </td>
                  <td><strong>{formatCurrency(receivableOpenAmount(entry))}</strong></td>
                  <td>
                    {formatCurrency(receivablePaidAmount(entry))}
                    <br />
                    <span className="table-muted">{entry.receipts?.length || 0} baixa{entry.receipts?.length === 1 ? "" : "s"}</span>
                  </td>
                  <td><span className={badgeClass(currentStatus)}>{currentStatus}</span></td>
                  <td><IntegrationStamp record={entry} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        ) : <div className="empty-state">Nenhuma parcela aberta encontrada para a previsão.</div>}
      </div>
    </section>
  );
}
