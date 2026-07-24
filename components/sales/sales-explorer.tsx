"use client";

import { I18nText } from "@/components/i18n/i18n-text";
import { useMemo, useState } from "react";
import { IntegrationStamp } from "@/components/ui/integration-stamp";
import { LocalDataList } from "@/components/ui/local-data-list";
import {
  isExchangeCondition,
  salesContractExchangeValue,
  salesContractGrossValue,
  salesContractNetValue,
  salesFinancialConditions
} from "@/features/sales/calculations";
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

  const total = filtered.reduce((sum, contract) => sum + salesContractNetValue(contract), 0);

  return (
    <section>
      <div className="card sales-filters">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar contrato, cliente, unidade ou empreendimento" data-i18n-placeholder={"Buscar contrato, cliente, unidade ou empreendimento"} />
        <select value={situation} onChange={(event) => setSituation(event.target.value)}>
          <option value=""><I18nText text={"Todas as situações"} /></option>
          {situations.map((item) => <option key={item}>{item}</option>)}
        </select>
        <div>
          <strong>{filtered.length}</strong>
          <span>
            {contracts.length < totalContracts
              ? `de ${totalContracts} contratos carregados para consulta rápida`
              : <I18nText text={"contratos - venda mais recente primeiro"} />}
          </span>
          <strong>{formatCompactCurrency(total)}</strong>
          <span><I18nText text={"em caixa, sem permutas"} /></span>
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
              const financialConditions = salesFinancialConditions(contract);
              const gross = salesContractGrossValue(contract);
              const exchange = salesContractExchangeValue(contract);
              const net = salesContractNetValue(contract);
              const open = financialConditions.reduce((sum, item) => sum + (item.outstandingBalance || 0), 0);
              const paid = financialConditions.reduce((sum, item) => sum + (item.amountPaid || 0), 0);
              const fullExchange = gross > 0 && net <= 0 && exchange > 0;
              return (
                <article className="card sales-contract" key={contract.id}>
                  <button className="sales-contract-main" onClick={() => setExpanded(expanded === contract.id ? undefined : contract.id)}>
                    <span className="sales-code">{contract.number || `#${contract.id}`}</span>
                    <span><strong>{customer?.name || <I18nText text={"Cliente não informado"} />}</strong><small>{unit?.name || <I18nText text={"Unidade não informada"} />} <I18nText text={"-"} /> {contract.enterpriseName || <I18nText text={"Empreendimento não informado"} />}</small></span>
                    <span><strong>{formatCurrency(fullExchange ? gross : net)}</strong><small>{fullExchange ? <I18nText text={"100% permuta - sem entrada de caixa"} /> : exchange > 0 ? `${formatCompactCurrency(exchange)} em permuta, restante em caixa` : <I18nText text={"Valor em caixa"} />}</small></span>
                    <span><strong>{contract.issueDate ? formatDate(contract.issueDate) : contract.contractDate ? formatDate(contract.contractDate) : <I18nText text={"-"} />}</strong><small><I18nText text={"Data da venda"} /></small></span>
                    <span><strong><IntegrationStamp record={contract} /></strong><small><I18nText text={"Integração"} /></small></span>
                    <span><i className={`sales-status ${/cancelad|distrat/i.test(contract.situation || "") ? "cancelled" : ""}`}>{contract.situation || <I18nText text={"Não informada"} />}</i></span>
                    <span className="sales-expand"><I18nText text={expanded === contract.id ? "-" : "+"} /></span>
                  </button>
                  {expanded === contract.id && <div className="sales-details">
                    <div className="sales-detail-grid">
                      <div><span><I18nText text={"Empresa"} /></span><strong>{contract.companyName || <I18nText text={"-"} />}</strong></div>
                      <div><span><I18nText text={"Data do contrato"} /></span><strong>{contract.contractDate ? formatDate(contract.contractDate) : <I18nText text={"-"} />}</strong></div>
                      <div><span><I18nText text={"Título a receber"} /></span><strong>{contract.receivableBillId ? `#${contract.receivableBillId}` : <I18nText text={"-"} />}</strong></div>
                      <div><span><I18nText text={"Valor bruto contratado"} /></span><strong>{formatCurrency(gross)}</strong></div>
                      <div><span><I18nText text={"Permuta abatida"} /></span><strong>{formatCurrency(exchange)}</strong></div>
                      <div><span><I18nText text={"Valor líquido comercial"} /></span><strong>{formatCurrency(net)}</strong></div>
                      <div><span><I18nText text={"Saldo financeiro aberto"} /></span><strong>{formatCurrency(open)}</strong></div>
                      <div><span><I18nText text={"Valor recebido financeiro"} /></span><strong>{formatCurrency(paid)}</strong></div>
                      <div><span><I18nText text={"Previsão de entrega"} /></span><strong>{contract.expectedDeliveryDate ? formatDate(contract.expectedDeliveryDate) : <I18nText text={"-"} />}</strong></div>
                      <div><span><I18nText text={"Integração"} /></span><strong><IntegrationStamp record={contract} /></strong></div>
                    </div>
                    {conditions.length > 0 && <div className="sales-conditions">
                      <h3><I18nText text={"Condições de pagamento"} /></h3>
                      {conditions.map((condition, index) => {
                        const exchangeCondition = isExchangeCondition(condition);
                        const conditionAmount = exchangeCondition
                          ? condition.totalValueInterest || condition.totalValue || condition.outstandingBalance || 0
                          : condition.outstandingBalance || 0;
                        return (
                          <div key={`${condition.conditionTypeName}-${index}`} className={exchangeCondition ? "exchange" : ""}>
                            <span>{condition.conditionTypeName || <I18nText text={"Condição"} />}</span>
                            <strong>{exchangeCondition ? <I18nText text={"Permuta abatida da carteira líquida"} /> : `${condition.openInstallmentsNumber || 0} de ${condition.installmentsNumber || 0} parcelas abertas`}</strong>
                            <span>{formatCurrency(conditionAmount)} <I18nText text={exchangeCondition ? "em permuta" : "em aberto"} /></span>
                          </div>
                        );
                      })}
                    </div>}
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
