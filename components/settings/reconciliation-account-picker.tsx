"use client";

import { useMemo, useState } from "react";
import type { ReconciliationAccountOption } from "@/features/reconciliation/types";

type ReconciliationAccountPickerProps = {
  accounts: ReconciliationAccountOption[];
  missingAccounts: string[];
  selectedAccounts: string[];
};

export function ReconciliationAccountPicker({ accounts, missingAccounts, selectedAccounts }: ReconciliationAccountPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(() => new Set(selectedAccounts));

  const options = useMemo(() => [
    ...missingAccounts.map((account) => ({
      accountNumber: account,
      label: `${account} (sem movimentos salvos)`,
      count: 0
    })),
    ...accounts
  ], [accounts, missingAccounts]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((account) =>
      [account.accountNumber, account.label].join(" ").toLowerCase().includes(query)
    );
  }, [options, search]);

  const selectedList = Array.from(selected);
  const selectedLabel = selectedList.length
    ? `${selectedList.length} conta${selectedList.length === 1 ? "" : "s"} selecionada${selectedList.length === 1 ? "" : "s"}`
    : "Todas as contas";

  function toggle(accountNumber: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(accountNumber)) next.delete(accountNumber);
      else next.add(accountNumber);
      return next;
    });
  }

  return (
    <div className="settings-account-picker-field">
      {selectedList.map((account) => (
        <input key={account} type="hidden" name="reconciliationAccountNumbers" value={account} />
      ))}

      <span>Contas da conciliação</span>
      <button className="settings-picker-trigger" type="button" onClick={() => setOpen(true)}>
        <strong>{selectedLabel}</strong>
        <small>{selectedList.length ? selectedList.join(", ") : "Sem seleção: mostra todas as contas"}</small>
      </button>
      <em>Escolha uma ou mais contas para aparecer no portal de conciliação.</em>

      {open && (
        <div className="settings-modal-backdrop" role="presentation">
          <div className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="reconciliation-accounts-title">
            <div className="settings-modal-head">
              <div>
                <h2 id="reconciliation-accounts-title">Selecionar contas</h2>
                <span>{selectedLabel}</span>
              </div>
              <button type="button" onClick={() => setOpen(false)}>Fechar</button>
            </div>

            <input
              className="settings-modal-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar conta..."
            />

            <div className="settings-modal-actions">
              <button type="button" onClick={() => setSelected(new Set(options.map((account) => account.accountNumber)))}>
                Marcar todas
              </button>
              <button type="button" onClick={() => setSelected(new Set())}>
                Usar todas sem filtro
              </button>
            </div>

            <div className="settings-checkbox-list">
              {filtered.map((account) => (
                <label key={account.accountNumber}>
                  <input
                    type="checkbox"
                    checked={selected.has(account.accountNumber)}
                    onChange={() => toggle(account.accountNumber)}
                  />
                  <span>
                    <strong>{account.accountNumber}</strong>
                    <small>{account.label} - {account.count} movimento{account.count === 1 ? "" : "s"}</small>
                  </span>
                </label>
              ))}
              {!filtered.length && <div className="empty-state">Nenhuma conta encontrada.</div>}
            </div>

            <div className="settings-modal-footer">
              <span>Sem nenhuma conta marcada, a conciliação mostra todas.</span>
              <button className="button" type="button" onClick={() => setOpen(false)}>Aplicar seleção</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
