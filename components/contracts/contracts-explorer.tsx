"use client";

import { useMemo, useState } from "react";
import { IntegrationStamp } from "@/components/ui/integration-stamp";
import { LocalDataList } from "@/components/ui/local-data-list";
import type { SupplyContract } from "@/features/contracts/types";
import { balanceValue, contractStatus, contractValue, isClosedContract, measuredValue } from "@/features/contracts/utils";
import { formatCurrency, formatOptionalDate } from "@/lib/formatters";

function contractCode(contract: SupplyContract) {
  return contract.number || contract.contractNumber || contract.id || contract.contractId || "sem número";
}

function contractTitle(contract: SupplyContract) {
  return String(contract.object || contract.description || `Contrato #${contractCode(contract)}`);
}

function supplierName(contract: SupplyContract) {
  return String(contract.supplierName || contract.creditorName || (contract.supplierId ? `Fornecedor #${contract.supplierId}` : "Fornecedor não informado"));
}

function contractDate(contract: SupplyContract) {
  return contract.issueDate || contract.contractDate || contract.signatureDate || contract.startDate;
}

export function ContractsExplorer({ contracts }: { contracts: SupplyContract[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const statuses = useMemo(() => Array.from(new Set(contracts.map(contractStatus))).sort(), [contracts]);

  const filtered = useMemo(() => contracts.filter((contract) => {
    const text = [
      contractCode(contract),
      contractTitle(contract),
      supplierName(contract),
      contract.companyName,
      contract.buildingName,
      contract.projectName,
      contractStatus(contract)
    ].filter(Boolean).join(" ").toLowerCase();
    return text.includes(search.toLowerCase()) && (!status || contractStatus(contract) === status);
  }), [contracts, search, status]);

  return (
    <section>
      <div className="card contracts-filters">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar contrato, fornecedor, empresa ou obra" />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Todas as situações</option>
          {statuses.map((item) => <option key={item}>{item}</option>)}
        </select>
        <div><strong>{filtered.length}</strong><span>contratos</span></div>
      </div>

      <LocalDataList
        items={filtered}
        itemLabel="contratos"
        resetKey={`${search}|${status}`}
        emptyMessage="Nenhum contrato encontrado."
        renderItems={(pageItems) => (
          <div className="card table-card">
            <table>
              <thead>
                <tr>
                  <th>Contrato</th>
                  <th>Fornecedor</th>
                  <th>Empresa / obra</th>
                  <th>Data</th>
                  <th>Valor</th>
                  <th>Medido</th>
                  <th>Saldo</th>
                  <th>Situação</th>
                  <th>Integração</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((contract) => {
                  const code = contractCode(contract);
                  const closed = isClosedContract(contract);
                  return (
                    <tr key={`${contract.id || contract.contractId || code}`}>
                      <td><strong>{contractTitle(contract)}</strong><br /><span className="table-muted">Contrato #{code}</span></td>
                      <td>{supplierName(contract)}</td>
                      <td>{contract.companyName || "Empresa não informada"}<br /><span className="table-muted">{contract.buildingName || contract.projectName || ""}</span></td>
                      <td>{formatOptionalDate(contractDate(contract), "Sem data")}</td>
                      <td><strong>{formatCurrency(contractValue(contract))}</strong></td>
                      <td>{formatCurrency(measuredValue(contract))}</td>
                      <td>{formatCurrency(balanceValue(contract))}</td>
                      <td><span className={`badge ${closed ? "pending" : ""}`}>{contractStatus(contract)}</span></td>
                      <td><IntegrationStamp record={contract} /></td>
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
