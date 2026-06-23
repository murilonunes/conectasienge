"use client";

import { useMemo, useState } from "react";
import { IntegrationStamp } from "@/components/ui/integration-stamp";
import { LocalDataList } from "@/components/ui/local-data-list";
import type { SalesContract } from "@/features/sales/types";
import { formatCompactCurrency, formatCurrency, formatDate } from "@/lib/formatters";

const mainCustomer = (contract: SalesContract) =>
  contract.salesContractCustomers?.find((customer) => customer.main) || contract.salesContractCustomers?.[0];

const mainUnit = (contract: SalesContract) =>
  contract.salesContractUnits?.find((unit) => unit.main) || contract.salesContractUnits?.[0];

function saleTimestamp(contract: SalesContract) {
  const rawDate = contract.issueDate || contract.contractDate;
  if (!rawDate) return 0;
  const time = new Date(rawDate).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function SalesExplorer({
  contracts,
  totalContracts = contracts.length
}: {
  contracts: SalesContract[];
  totalContracts?: number;
}) {
  const [search, setSearch] = useState("");
  const [situation, setSituation] = useState("");
  const [expanded, setExpanded] = useState<number>();
  const situations = useMemo(() => Array.from(new Set(contracts.map((contract) => contract.situation).filter(Boolean))) as string[], [contracts]);

  const filtered = useMemo(() => contracts
    .filter((contract) => {
      const text = `${contract.number} ${contract.externalId || ""} ${contract.enterpriseName || ""} ${mainCustomer(contract)?.name || ""} ${mainUnit(contract)?.name || ""}`.toLowerCase();
      return text.includes(search.toLowerCase()) && (!situation || contract.situation === situation);
    })
    .sort((left, right) => saleTimestamp(right) - saleTimestamp(left) || right.id - left.id), [contracts, search, situation]);

  const total = filtered.reduce((sum, contract) => sum + (contract.totalSellingValue || contract.value || 0), 0);

  return (
    <section>
      <div className="card sales-filters">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar contrato, cliente, unidade ou empreendimento" />
        <select value={situation} onChange={(event) => setSituation(event.target.value)}>
          <option value="">Todas as situações</option>
          {situations.map((item) => <option key={item}>{item}</option>)}
        </select>
        <div>
          <strong>{filtered.length}</strong>
          <span>
            {contracts.length < totalContracts
              ? `de ${totalContracts} contratos carregados para consulta rápida`
              : "contratos - venda mais recente primeiro"}
          </span>
          <strong>{formatCompactCurrency(total)}</strong>
        </div>
      </div>
      <LocalDataList
        items={filtered}
        itemLabel="contratos"
        resetKey={`${search}|${situation}`}
        emptyMessage="Nenhum contrato encontrado."
        renderItems={(pageItems) => (
          <div className="sales-list">
            {pageItems.map((contract) => {
              const customer = mainCustomer(contract);
              const unit = mainUnit(contract);
              const conditions = contract.paymentConditions || [];
              const open = conditions.reduce((sum, item) => sum + (item.outstandingBalance || 0), 0);
              const paid = conditions.reduce((sum, item) => sum + (item.amountPaid || 0), 0);
              return (
                <article className="card sales-contract" key={contract.id}>
                  <button className="sales-contract-main" onClick={() => setExpanded(expanded === contract.id ? undefined : contract.id)}>
                    <span className="sales-code">{contract.number || `#${contract.id}`}</span>
                    <span><strong>{customer?.name || "Cliente não informado"}</strong><small>{unit?.name || "Unidade não informada"} - {contract.enterpriseName || "Empreendimento não informado"}</small></span>
                    <span><strong>{formatCurrency(contract.totalSellingValue || contract.value || 0)}</strong><small>Valor de venda</small></span>
                    <span><strong>{contract.issueDate ? formatDate(contract.issueDate) : contract.contractDate ? formatDate(contract.contractDate) : "-"}</strong><small>Data da venda</small></span>
                    <span><strong><IntegrationStamp record={contract} /></strong><small>Integração</small></span>
                    <span><i className={`sales-status ${/cancelad|distrat/i.test(contract.situation || "") ? "cancelled" : ""}`}>{contract.situation || "Não informada"}</i></span>
                    <span className="sales-expand">{expanded === contract.id ? "-" : "+"}</span>
                  </button>
                  {expanded === contract.id && <div className="sales-details">
                    <div className="sales-detail-grid">
                      <div><span>Empresa</span><strong>{contract.companyName || "-"}</strong></div>
                      <div><span>Data do contrato</span><strong>{contract.contractDate ? formatDate(contract.contractDate) : "-"}</strong></div>
                      <div><span>Título a receber</span><strong>{contract.receivableBillId ? `#${contract.receivableBillId}` : "-"}</strong></div>
                      <div><span>Saldo em aberto</span><strong>{formatCurrency(open)}</strong></div>
                      <div><span>Valor pago</span><strong>{formatCurrency(paid)}</strong></div>
                      <div><span>Previsão de entrega</span><strong>{contract.expectedDeliveryDate ? formatDate(contract.expectedDeliveryDate) : "-"}</strong></div>
                      <div><span>Integração</span><strong><IntegrationStamp record={contract} /></strong></div>
                    </div>
                    {conditions.length > 0 && <div className="sales-conditions"><h3>Condições de pagamento</h3>{conditions.map((condition, index) => <div key={`${condition.conditionTypeName}-${index}`}><span>{condition.conditionTypeName || "Condição"}</span><strong>{condition.openInstallmentsNumber || 0} de {condition.installmentsNumber || 0} parcelas abertas</strong><span>{formatCurrency(condition.outstandingBalance || 0)} em aberto</span></div>)}</div>}
                  </div>}
                </article>
              );
            })}
          </div>
        )}
      />
    </section>
  );
}
