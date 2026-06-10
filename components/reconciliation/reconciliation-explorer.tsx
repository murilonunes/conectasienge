"use client";

import { useMemo, useState } from "react";
import type { BankMovement } from "@/features/reconciliation/types";
import { isReconciled, movementAmount, movementDocument, movementParty, reconciliationStatus } from "@/features/reconciliation/utils";
import { formatCurrency, formatDate } from "@/lib/formatters";

export function ReconciliationExplorer({ movements }: { movements: BankMovement[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [account, setAccount] = useState("");
  const accounts = useMemo(() => Array.from(new Set(movements.map((movement) => movement.accountNumber).filter(Boolean))) as string[], [movements]);

  const filtered = useMemo(() => movements.filter((movement) => {
    const text = [
      movement.bankMovementId,
      movement.billId,
      movement.installmentId,
      movementDocument(movement),
      movementParty(movement),
      movement.bankMovementHistoricName,
      movement.bankMovementOperationName,
      movement.accountNumber,
      movement.companyName
    ].filter(Boolean).join(" ").toLowerCase();
    const matchesText = text.includes(search.toLowerCase());
    const currentStatus = reconciliationStatus(movement);
    const matchesStatus = !status || currentStatus === status;
    const matchesAccount = !account || movement.accountNumber === account;
    return matchesText && matchesStatus && matchesAccount;
  }), [movements, search, status, account]);

  return (
    <section>
      <div className="card reconciliation-filters">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar movimento, título, histórico, conta ou parte" />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Todos os status</option>
          <option>Conciliado</option>
          <option>Vinculado, não conciliado</option>
          <option>Avulso</option>
        </select>
        <select value={account} onChange={(event) => setAccount(event.target.value)}>
          <option value="">Todas as contas</option>
          {accounts.map((item) => <option value={item} key={item}>{item}</option>)}
        </select>
        <div><strong>{filtered.length}</strong><span>movimentos</span></div>
      </div>

      <div className="card table-card">
        <table>
          <thead><tr><th>Movimento</th><th>Data</th><th>Valor</th><th>Conta</th><th>Status</th><th>Vínculo</th><th>Histórico</th></tr></thead>
          <tbody>
            {filtered.map((movement, index) => {
              const currentStatus = reconciliationStatus(movement);
              const warning = !isReconciled(movement);
              return (
                <tr key={`${movement.bankMovementId || index}-${movement.billId || "sem-titulo"}`}>
                  <td><strong>{movementDocument(movement)}</strong><br /><span className="table-muted">Movimento #{movement.bankMovementId || "sem código"}</span></td>
                  <td>{movement.bankMovementDate ? formatDate(movement.bankMovementDate) : "Não informada"}</td>
                  <td><strong>{formatCurrency(movementAmount(movement))}</strong><br /><span className="table-muted">{movement.bankMovementOperationType || "Tipo não informado"}</span></td>
                  <td>{movement.accountNumber || "Não informada"}<br /><span className="table-muted">{movement.companyName || ""}</span></td>
                  <td><span className={`badge ${warning ? "pending" : ""}`}>{currentStatus}</span></td>
                  <td>{movement.billId ? `Título #${movement.billId}` : "Sem título"}<br /><span className="table-muted">{movement.installmentId ? `Parcela #${movement.installmentId}` : movementParty(movement)}</span></td>
                  <td>{movement.bankMovementHistoricName || movement.bankMovementOperationName || "Não informado"}<br /><span className="table-muted">{movement.bankMovementOriginId || ""}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length && <div className="empty-state">Nenhum movimento encontrado para os filtros atuais.</div>}
      </div>
    </section>
  );
}
