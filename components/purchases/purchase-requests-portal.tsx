"use client";

import { I18nText } from "@/components/i18n/i18n-text";
import { useI18n } from "@/components/i18n/i18n-provider";
import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type RequestStatus =
  | "Rascunho"
  | "Em aprovação"
  | "Aprovada"
  | "Em cotação"
  | "Cotada"
  | "Pedido gerado"
  | "Cancelada";

type PurchaseRequestItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  details: string;
  notes?: string;
};

type PurchaseRequest = {
  id: string;
  code: string;
  title: string;
  requester: string;
  costCenter: string;
  priority: "Normal" | "Alta" | "Urgente";
  neededAt: string;
  status: RequestStatus;
  notes: string;
  createdAt: string;
  source?: "sienge" | "manual";
  items: PurchaseRequestItem[];
};

export type PurchaseRequestInput = PurchaseRequest;

const manualStorageKey = "brasin.purchaseRequests.manual.v2";
const statusStorageKey = "brasin.purchaseRequests.status.v2";

const statuses: RequestStatus[] = [
  "Rascunho",
  "Em aprovação",
  "Aprovada",
  "Em cotação",
  "Cotada",
  "Pedido gerado",
  "Cancelada"
];

const emptyItem: Omit<PurchaseRequestItem, "id"> = {
  name: "",
  category: "",
  unit: "un",
  quantity: 1,
  details: ""
};

function NoteIndicator({ label, note }: { label: string; note?: string }) {
  const { t } = useI18n();
  const text = note?.trim();
  if (!text) return null;
  const translatedLabel = t(label);

  return (
    <span
      className="purchase-note-indicator"
      aria-label={`${translatedLabel}: ${text}`}
      title={`${translatedLabel}: ${text}`}
    >
      <MessageSquareText aria-hidden="true" size={14} strokeWidth={2} />
    </span>
  );
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows.map((row) => row.map(csvCell).join(";")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function statusClass(status: RequestStatus) {
  if (status === "Cancelada") return "late";
  if (status === "Rascunho" || status === "Em aprovação") return "pending";
  return "";
}

function requestNumber(request: PurchaseRequest) {
  const match = request.code.match(/(\d+)/);
  return match ? Number(match[1]) : undefined;
}

export function PurchaseRequestsPortal({ initialRequests }: { initialRequests: PurchaseRequestInput[] }) {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [manualRequests, setManualRequests] = useState<PurchaseRequest[]>([]);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, RequestStatus>>({});
  const [hydrated, setHydrated] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [form, setForm] = useState({
    title: "",
    costCenter: "",
    neededAt: todayIso()
  });
  const [detailItem, setDetailItem] = useState(emptyItem);

  useEffect(() => {
    const storedManual = window.localStorage.getItem(manualStorageKey);
    const storedStatuses = window.localStorage.getItem(statusStorageKey);
    setManualRequests(storedManual ? JSON.parse(storedManual) as PurchaseRequest[] : []);
    setStatusOverrides(storedStatuses ? JSON.parse(storedStatuses) as Record<string, RequestStatus> : {});
    setHydrated(true);
  }, []);

  useEffect(() => {
    const loaded = [
      ...initialRequests.map((request) => ({
        ...request,
        status: statusOverrides[request.id] || request.status
      })),
      ...manualRequests
    ];
    setRequests(loaded);
    setSelectedId((current) => current || loaded[0]?.id || "");
  }, [initialRequests, manualRequests, statusOverrides]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(manualStorageKey, JSON.stringify(manualRequests));
  }, [hydrated, manualRequests]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(statusStorageKey, JSON.stringify(statusOverrides));
  }, [hydrated, statusOverrides]);

  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) || requests[0],
    [requests, selectedId]
  );

  const summary = useMemo(() => {
    const open = requests.filter((request) => !["Pedido gerado", "Cancelada"].includes(request.status)).length;
    const quoting = requests.filter((request) => request.status === "Em cotação").length;
    const items = requests.reduce((total, request) => total + request.items.length, 0);
    return { open, quoting, items };
  }, [requests]);

  function addDetailItem() {
    if (!selected || !detailItem.name.trim()) return;
    setRequests((current) =>
      current.map((request) =>
        request.id === selected.id
          ? {
              ...request,
              items: [...request.items, { ...detailItem, id: makeId(), quantity: Number(detailItem.quantity) || 1 }]
            }
          : request
      )
    );
    if (selected.source === "manual") {
      setManualRequests((current) =>
        current.map((request) =>
          request.id === selected.id
            ? {
                ...request,
                items: [...request.items, { ...detailItem, id: makeId(), quantity: Number(detailItem.quantity) || 1 }]
              }
            : request
        )
      );
    }
    setDetailItem(emptyItem);
  }

  function createRequest() {
    if (!form.title.trim()) return;
    const nextNumber = requests.length + 1;
    const request: PurchaseRequest = {
      id: makeId(),
      code: `SC-${String(nextNumber).padStart(3, "0")}`,
      title: form.title.trim(),
      requester: "Compras",
      costCenter: form.costCenter.trim() || "Não informado",
      priority: "Normal",
      neededAt: form.neededAt,
      status: "Rascunho",
      notes: "",
      createdAt: todayIso(),
      source: "manual",
      items: []
    };
    setManualRequests((current) => [request, ...current]);
    setSelectedId(request.id);
    setForm({
      title: "",
      costCenter: "",
      neededAt: todayIso()
    });
  }

  function updateSelectedStatus(status: RequestStatus) {
    if (!selected) return;
    if (selected.source === "manual") {
      setManualRequests((current) =>
        current.map((request) => (request.id === selected.id ? { ...request, status } : request))
      );
    } else {
      setStatusOverrides((current) => ({ ...current, [selected.id]: status }));
    }
  }

  function exportSelectedQuote() {
    if (!selected) return;
    const rows = [
      [
        "Solicitação",
        "Status",
        "Centro de custo",
        "Necessidade",
        "Insumo",
        "Unidade",
        "Quantidade",
        "Especificação",
        "Observação da solicitação",
        "Observação do insumo",
        "Fornecedor",
        "Valor unitário",
        "Prazo",
        "Observação da cotação"
      ],
      ...selected.items.map((item) => [
        selected.code,
        selected.status,
        selected.costCenter,
        selected.neededAt,
        item.name,
        item.unit,
        item.quantity,
        item.details,
        selected.notes,
        item.notes || "",
        "",
        "",
        "",
        ""
      ])
    ];
    downloadCsv(`${selected.code}-insumos-cotacao.csv`, rows);
  }

  function exportAllQuote() {
    const rows = [
      [
        "Solicitação",
        "Status",
        "Centro de custo",
        "Necessidade",
        "Insumo",
        "Unidade",
        "Quantidade",
        "Especificação",
        "Observação da solicitação",
        "Observação do insumo",
        "Fornecedor",
        "Valor unitário",
        "Prazo",
        "Observação da cotação"
      ],
      ...requests.flatMap((request) =>
        request.items.map((item) => [
          request.code,
          request.status,
          request.costCenter,
          request.neededAt,
          item.name,
          item.unit,
          item.quantity,
          item.details,
          request.notes,
          item.notes || "",
          "",
          "",
          "",
          ""
        ])
      )
    ];
    downloadCsv("solicitacoes-compra-insumos-cotacao.csv", rows);
  }

  return (
    <>
      <section className="card purchase-request-command">
        <div>
          <span><I18nText text={"Fila de compras"} /></span>
          <strong>{summary.open} <I18nText text={"solicitações abertas"} /></strong>
          <small>{summary.quoting} <I18nText text={"em cotação -"} /> {summary.items} <I18nText text={"insumos na carteira"} /></small>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); createRequest(); }}>
          <input className="field" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Nova solicitação" data-i18n-placeholder={"Nova solicitação"} />
          <input className="field" value={form.costCenter} onChange={(event) => setForm({ ...form, costCenter: event.target.value })} placeholder="Centro de custo" data-i18n-placeholder={"Centro de custo"} />
          <input className="field" type="date" value={form.neededAt} onChange={(event) => setForm({ ...form, neededAt: event.target.value })} />
          <button className="button" type="submit"><I18nText text={"Criar"} /></button>
        </form>
      </section>

      <section className="purchase-request-layout">
        <div className="purchase-request-workspace">
          <section className="card panel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title"><I18nText text={"Solicitações"} /></h2>
                <span className="panel-note"><I18nText text={"Clique para abrir"} /></span>
              </div>
              <button className="button secondary" type="button" onClick={exportAllQuote} disabled={!requests.length}><I18nText text={"Exportar tudo"} /></button>
            </div>

            <div className="purchase-request-list">
              {requests.map((request) => (
                <button
                  className={request.id === selected?.id ? "active" : ""}
                  key={request.id}
                  type="button"
                  onClick={() => setSelectedId(request.id)}
                >
                  <span>
                    <span className="purchase-request-title-line">
                      <strong>{request.source === "sienge" ? <I18nText text={request.title} /> : request.title}</strong>
                      <NoteIndicator label="Observação da solicitação" note={request.notes} />
                    </span>
                    <small>{request.code} <I18nText text={"-"} /> {request.items.length} <I18nText text={"insumos"} /></small>
                  </span>
                  <i className={`badge ${statusClass(request.status)}`}><I18nText text={request.status} /></i>
                </button>
              ))}
            </div>
          </section>

          {selected ? (
            <section className="card panel purchase-request-detail">
              <div className="purchase-request-detail-head">
                <div>
                  <span className="eyebrow">{selected.code}</span>
                  <div className="purchase-request-title-line">
                    <h2>{selected.source === "sienge" ? <I18nText text={selected.title} /> : selected.title}</h2>
                    <NoteIndicator label="Observação da solicitação" note={selected.notes} />
                  </div>
                  <p>{selected.source === "sienge" ? <I18nText text={selected.costCenter} /> : selected.costCenter} <I18nText text={"- necessidade em"} /> {selected.neededAt || <I18nText text={"data não informada"} />}</p>
                </div>
                <div>
                  <select className="field" value={selected.status} onChange={(event) => updateSelectedStatus(event.target.value as RequestStatus)}>
                    {statuses.map((status) => <option key={status} value={status}><I18nText text={status} /></option>)}
                  </select>
                  {requestNumber(selected) ? (
                    <Link className="button secondary" href={`/cotacoes?solicitacao=${requestNumber(selected)}`}>
                      <I18nText text={"Iniciar cotação"} />
                    </Link>
                  ) : null}
                  <button className="button" type="button" onClick={exportSelectedQuote} disabled={!selected.items.length}><I18nText text={"Exportar cotação"} /></button>
                </div>
              </div>

              <div className="purchase-item-editor compact">
                <strong><I18nText text={"Insumos para cotação"} /></strong>
                <div className="purchase-item-grid">
                  <input className="field" value={detailItem.name} onChange={(event) => setDetailItem({ ...detailItem, name: event.target.value })} placeholder="Insumo" data-i18n-placeholder={"Insumo"} />
                  <input className="field" type="number" min="0" step="0.01" value={detailItem.quantity} onChange={(event) => setDetailItem({ ...detailItem, quantity: Number(event.target.value) })} placeholder="Qtd." data-i18n-placeholder={"Qtd."} />
                  <input className="field" value={detailItem.unit} onChange={(event) => setDetailItem({ ...detailItem, unit: event.target.value })} placeholder="Unidade" data-i18n-placeholder={"Unidade"} />
                  <input className="field" value={detailItem.details} onChange={(event) => setDetailItem({ ...detailItem, details: event.target.value })} placeholder="Especificação" data-i18n-placeholder={"Especificação"} />
                  <button className="button secondary" type="button" onClick={addDetailItem}><I18nText text={"Adicionar"} /></button>
                </div>
              </div>

              <div className="table-card purchase-request-items">
                <table>
                  <thead>
                    <tr>
                      <th><I18nText text={"Insumo"} /></th>
                      <th><I18nText text={"Quantidade"} /></th>
                      <th><I18nText text={"Unidade"} /></th>
                      <th><I18nText text={"Especificação"} /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <span className="purchase-item-name">
                            <strong>{item.name}</strong>
                            <NoteIndicator label="Observação do insumo" note={item.notes} />
                          </span>
                        </td>
                        <td>{item.quantity}</td>
                        <td>{item.unit}</td>
                        <td>{item.details || <I18nText text={"Sem detalhe"} />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!selected.items.length && <div className="empty-state"><I18nText text={"Adicione insumos para liberar a exportação da cotação."} /></div>}
              </div>
            </section>
          ) : (
            <section className="card empty-state"><I18nText text={"Cadastre a primeira solicitação de compra."} /></section>
          )}
        </div>
      </section>
    </>
  );
}
