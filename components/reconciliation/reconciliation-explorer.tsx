"use client";

import { useMemo, useState } from "react";
import { IntegrationStamp } from "@/components/ui/integration-stamp";
import { LocalDataList } from "@/components/ui/local-data-list";
import type { BankMovement } from "@/features/reconciliation/types";
import { hasTitleLink, isReconciled, movementAmount, movementDocument, movementParty, reconciliationStatus } from "@/features/reconciliation/utils";
import { formatCurrency, formatDate } from "@/lib/formatters";

function movementKey(movement: BankMovement, index: number) {
  return `${movement.bankMovementId || index}-${movement.billId || "sem-titulo"}-${movement.installmentId || "sem-parcela"}`;
}

export function ReconciliationExplorer({ movements, periodLabel }: { movements: BankMovement[]; periodLabel: string }) {
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
    const matchesStatus = !status || (status === "Sem título/parcela" ? !hasTitleLink(movement) : currentStatus === status);
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
          <option>Sem título/parcela</option>
        </select>
        <select value={account} onChange={(event) => setAccount(event.target.value)}>
          <option value="">Todas as contas</option>
          {accounts.map((item) => <option value={item} key={item}>{item}</option>)}
        </select>
        <div><strong>{filtered.length}</strong><span>movimentos em {periodLabel}</span></div>
      </div>

      <LocalDataList
        items={filtered}
        itemLabel="movimentos"
        resetKey={`${search}|${status}|${account}|${periodLabel}`}
        emptyMessage="Nenhum movimento encontrado para os filtros atuais."
        renderItems={(pageItems) => (
          <div className="card table-card">
            <table>
              <thead><tr><th>Movimento</th><th>Data</th><th>Valor</th><th>Conta</th><th>Status</th><th>Vínculo</th><th>Histórico</th><th>Integração</th></tr></thead>
              <tbody>
                {pageItems.map((movement, index) => {
                  const currentStatus = reconciliationStatus(movement);
                  const warning = !isReconciled(movement);
                  return (
                    <tr key={movementKey(movement, index)}>
                      <td><strong>{movementDocument(movement)}</strong><br /><span className="table-muted">Movimento #{movement.bankMovementId || "sem código"}</span></td>
                      <td>{movement.bankMovementDate ? formatDate(movement.bankMovementDate) : "Não informada"}</td>
                      <td><strong>{formatCurrency(movementAmount(movement))}</strong><br /><span className="table-muted">{movement.bankMovementOperationType || "Tipo não informado"}</span></td>
                      <td>{movement.accountNumber || "Não informada"}<br /><span className="table-muted">{movement.companyName || ""}</span></td>
                      <td><span className={`badge ${warning ? "pending" : ""}`}>{currentStatus}</span></td>
                      <td>{movement.billId ? `Título #${movement.billId}` : "Sem título"}<br /><span className="table-muted">{movement.installmentId ? `Parcela #${movement.installmentId}` : movementParty(movement)}</span></td>
                      <td>{movement.bankMovementHistoricName || movement.bankMovementOperationName || "Não informado"}<br /><span className="table-muted">{movement.bankMovementOriginId || ""}</span></td>
                      <td><IntegrationStamp record={movement} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      />
    </section>
  );
}
