"use client";

import { useMemo, useState } from "react";
import type { FinancialEntry } from "@/features/financeiro/types";
import { FinancialTable } from "./financial-table";
import { formatCompactCurrency } from "@/lib/formatters";

export function FinancialExplorer({ entries }: { entries: FinancialEntry[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const filtered = useMemo(() => entries.filter((entry) => {
    const haystack = `${entry.document} ${entry.description} ${entry.party} ${entry.originId || ""}`.toLowerCase();
    return haystack.includes(search.toLowerCase()) && (!status || entry.status === status);
  }), [entries, search, status]);

  const total = filtered.reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <section>
      <div className="card filters">
        <input className="field search-field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar documento, observação, credor ou origem" />
        <select className="field" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Todas as situações</option>
          <option value="Completo">Completo</option>
          <option value="Incompleto">Incompleto</option>
          <option value="Em inclusão">Em inclusão</option>
        </select>
        <div className="filter-result"><strong>{filtered.length}</strong><span>títulos</span><strong>{formatCompactCurrency(total)}</strong></div>
      </div>
      <FinancialTable entries={filtered} dateHeading="Emissão" />
    </section>
  );
}
