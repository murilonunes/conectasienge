"use client";

import { I18nText } from "@/components/i18n/i18n-text";
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
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar movimento, título, histórico, conta ou parte" data-i18n-placeholder={"Buscar movimento, título, histórico, conta ou parte"} />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value=""><I18nText text={"Todos os status"} /></option>
          <option><I18nText text={"Conciliado"} /></option>
          <option><I18nText text={"Vinculado, não conciliado"} /></option>
          <option><I18nText text={"Avulso"} /></option>
          <option><I18nText text={"Sem título/parcela"} /></option>
        </select>
        <select value={account} onChange={(event) => setAccount(event.target.value)}>
          <option value=""><I18nText text={"Todas as contas"} /></option>
          {accounts.map((item) => <option value={item} key={item}>{item}</option>)}
        </select>
        <div><strong>{filtered.length}</strong><span><I18nText text={"movimentos em"} /> {periodLabel}</span></div>
      </div>

      <LocalDataList
        items={filtered}
        itemLabel="movimentos"
        resetKey={`${search}|${status}|${account}|${periodLabel}`}
        emptyMessage="Nenhum movimento encontrado para os filtros atuais."
        renderItems={(pageItems) => (
          <div className="card table-card">
            <table>
              <thead><tr><th><I18nText text={"Movimento"} /></th><th><I18nText text={"Data"} /></th><th><I18nText text={"Valor"} /></th><th><I18nText text={"Conta"} /></th><th><I18nText text={"Status"} /></th><th><I18nText text={"Vínculo"} /></th><th><I18nText text={"Histórico"} /></th><th><I18nText text={"Integração"} /></th></tr></thead>
              <tbody>
                {pageItems.map((movement, index) => {
                  const currentStatus = reconciliationStatus(movement);
                  const warning = !isReconciled(movement);
                  return (
                    <tr key={movementKey(movement, index)}>
                      <td><strong>{movementDocument(movement)}</strong><br /><span className="table-muted"><I18nText text={"Movimento #"} />{movement.bankMovementId || <I18nText text={"sem código"} />}</span></td>
                      <td>{movement.bankMovementDate ? formatDate(movement.bankMovementDate) : <I18nText text={"Não informada"} />}</td>
                      <td><strong>{formatCurrency(movementAmount(movement))}</strong><br /><span className="table-muted">{movement.bankMovementOperationType || <I18nText text={"Tipo não informado"} />}</span></td>
                      <td>{movement.accountNumber || <I18nText text={"Não informada"} />}<br /><span className="table-muted">{movement.companyName || <I18nText text={""} />}</span></td>
                      <td><span className={`badge ${warning ? "pending" : ""}`}>{currentStatus}</span></td>
                      <td>{movement.billId ? `Título #${movement.billId}` : <I18nText text={"Sem título"} />}<br /><span className="table-muted">{movement.installmentId ? `Parcela #${movement.installmentId}` : movementParty(movement)}</span></td>
                      <td>{movement.bankMovementHistoricName || movement.bankMovementOperationName || <I18nText text={"Não informado"} />}<br /><span className="table-muted">{movement.bankMovementOriginId || <I18nText text={""} />}</span></td>
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
