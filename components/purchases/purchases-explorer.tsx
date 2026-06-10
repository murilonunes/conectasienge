"use client";

import { useMemo, useState } from "react";
import type { PurchaseFlowItem } from "@/features/purchases/types";
import { formatCompactCurrency, formatCurrency, formatDate } from "@/lib/formatters";

function safeDate(value?: string) {
  if (!value) return "Sem data";
  try {
    return formatDate(value);
  } catch {
    return value;
  }
}

function badgeClass(item: PurchaseFlowItem) {
  if (item.late) return "badge late";
  if (item.pending) return "badge pending";
  return "badge";
}

export function PurchasesExplorer({ items }: { items: PurchaseFlowItem[] }) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const statuses = useMemo(() => Array.from(new Set(items.map((item) => item.status))).sort(), [items]);

  const filtered = useMemo(() => items.filter((item) => {
    const text = [
      item.kindLabel,
      item.code,
      item.title,
      item.subtitle,
      item.status,
      item.buyer,
      item.supplier,
      item.building
    ].filter(Boolean).join(" ").toLowerCase();
    return text.includes(search.toLowerCase())
      && (!kind || item.kind === kind)
      && (!status || item.status === status);
  }), [items, search, kind, status]);

  const total = filtered.reduce((sum, item) => sum + item.amount, 0);

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
          {statuses.map((item) => <option key={item}>{item}</option>)}
        </select>
        <div><strong>{filtered.length}</strong><span>registros</span><strong>{formatCompactCurrency(total)}</strong></div>
      </div>

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
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 300).map((item) => (
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
                <td>{safeDate(item.date)}</td>
                <td>
                  <strong>{item.amount ? formatCurrency(item.amount) : "Sem valor"}</strong>
                  <br />
                  <span className="table-muted">{item.quantity ? `${item.quantity} unidade(s)` : item.kindLabel}</span>
                </td>
                <td>
                  {item.buyer || item.supplier || item.building || "Não informado"}
                  <br />
                  <span className="table-muted">{[item.supplier, item.building].filter(Boolean).join(" · ")}</span>
                </td>
                <td><span className={badgeClass(item)}>{item.late ? "Entrega atrasada" : item.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 300 && <div className="data-notice purchases-limit"><strong>Lista resumida</strong><span>Exibindo os 300 primeiros registros filtrados para manter a tela rápida. Use a busca para afinar o resultado.</span></div>}
        {!filtered.length && <div className="empty-state">Nenhum registro de compra encontrado.</div>}
      </div>
    </section>
  );
}
