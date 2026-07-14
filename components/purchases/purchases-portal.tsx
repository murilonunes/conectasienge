"use client";

import Link from "next/link";
import { useState } from "react";
import { MonthlyVolumeChart } from "@/components/charts/monthly-volume-chart";
import { RankingChart } from "@/components/charts/ranking-chart";
import { StatCard } from "@/components/ui/stat-card";
import type { PurchaseSummary } from "@/features/purchases/data";
import type { SupplyOverview } from "@/features/purchases/supply-overview";
import { formatCompactCurrency, formatCurrency, formatOptionalDate } from "@/lib/formatters";
import { PurchasesExplorer } from "./purchases-explorer";

type PurchasesPortalSummary = Omit<PurchaseSummary, "flow">;

export function PurchasesPortal({
  summary,
  overview,
  totalRecords,
  warning
}: {
  summary: PurchasesPortalSummary;
  overview: SupplyOverview;
  totalRecords: number;
  warning?: string;
}) {
  const [tab, setTab] = useState<"overview" | "records">("overview");
  const { stats, funnel, actions } = overview;

  return (
    <>
      <div className="purchase-tabs">
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>Cenário de suprimentos</button>
        <button className={tab === "records" ? "active" : ""} onClick={() => setTab("records")}>Registros</button>
      </div>

      {tab === "overview" ? (
        <>
          <form
            action="/compras"
            className="supply-period-filter"
            key={`${overview.period.includeCurrentMonth}-${overview.period.extraMonths}`}
            method="get"
          >
            <input name="filtro" type="hidden" value="periodo" />
            <label className="supply-period-current">
              <input defaultChecked={overview.period.includeCurrentMonth} name="mesAtual" type="checkbox" value="1" />
              <span>Mês atual</span>
            </label>
            <label className="supply-period-history">
              <span>Histórico adicional</span>
              <select defaultValue={String(overview.period.extraMonths === "all" ? "tudo" : overview.period.extraMonths)} name="historico">
                <option value="1">+1 mês</option>
                <option value="2">+2 meses</option>
                <option value="3">+3 meses</option>
                <option value="6">+6 meses</option>
                <option value="12">+12 meses</option>
                <option value="tudo">Tudo</option>
              </select>
            </label>
            <button className="button secondary" type="submit">Aplicar período</button>
            <small>{overview.period.label}</small>
          </form>

          {warning && <div className="card data-notice"><strong>Atenção</strong><span>{warning}</span></div>}
          {!overview.requestStatusSynced && (
            <div className="card data-notice">
              <strong>Situação das solicitações</strong>
              <span>
                {overview.undatedRequests
                  ? `${overview.undatedRequests} solicitações sem data sincronizada ficaram fora deste período. Atualize Compras em Configurações ou escolha Tudo para incluí-las.`
                  : "A situação individual de algumas solicitações ainda não foi sincronizada. Rode Atualizar Compras em Configurações para o funil ignorar solicitações já atendidas."}
              </span>
            </div>
          )}

          <div className="stats">
            <StatCard
              label="Solicitações abertas"
              value={String(stats.openRequests.count)}
              delta={stats.openRequests.pendingAuthorization ? `${stats.openRequests.pendingAuthorization} insumos sem autorização` : `${stats.openRequests.items} insumos autorizados`}
              warn={stats.openRequests.pendingAuthorization > 0}
              icon="SC"
            />
            <StatCard
              label="Cotações em andamento"
              value={String(stats.activeQuotations.count)}
              delta={stats.activeQuotations.readyForDecision ? `${stats.activeQuotations.readyForDecision} prontas para decisão` : `${stats.activeQuotations.waitingResponse} aguardando respostas`}
              warn={stats.activeQuotations.waitingSuppliers > 0}
              icon="CT"
            />
            <StatCard
              label="Pedidos em execução"
              value={formatCompactCurrency(stats.ordersInProgress.amount)}
              delta={`${stats.ordersInProgress.count} pedidos - ${stats.ordersInProgress.awaitingAuthorization} sem autorização`}
              warn={stats.ordersInProgress.awaitingAuthorization > 0}
              icon="PD"
            />
            <StatCard
              label="Entregas atrasadas"
              value={String(stats.lateOrders.count)}
              delta={stats.lateOrders.count ? formatCompactCurrency(stats.lateOrders.amount) : "Nenhum pedido atrasado"}
              warn={stats.lateOrders.count > 0}
              icon="!"
            />
            <StatCard
              label="Comprado no período"
              value={formatCompactCurrency(stats.periodPurchases.amount)}
              delta={`${stats.periodPurchases.count} pedidos em ${overview.period.label.toLowerCase()}`}
              icon="R$"
            />
          </div>

          <section className="card panel supply-funnel-panel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Funil de suprimentos</h2>
                <span className="panel-note">Da solicitação à nota fiscal: onde cada etapa está agora</span>
              </div>
            </div>
            <div className="supply-funnel">
              {funnel.map((stage, index) => {
                const body = (
                  <>
                    <span>{stage.label}</span>
                    <strong>{stage.count}</strong>
                    {stage.amount !== undefined && <em>{formatCompactCurrency(stage.amount)}</em>}
                    <small>{stage.note}</small>
                  </>
                );
                return (
                  <div className="supply-funnel-step" key={stage.key}>
                    {stage.href ? (
                      <Link className={`supply-funnel-card${stage.warn ? " warn" : ""}`} href={stage.href}>{body}</Link>
                    ) : (
                      <div className={`supply-funnel-card${stage.warn ? " warn" : ""}`}>{body}</div>
                    )}
                    {index < funnel.length - 1 && <i className="supply-funnel-arrow" aria-hidden="true">&gt;</i>}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="supply-actions">
            <article className="card panel">
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">Solicitações para cotar</h2>
                  <span className="panel-note">Aprovadas e ainda sem cotação com fornecedores</span>
                </div>
                <i className={`badge ${actions.requestsToQuote.length ? "warn" : ""}`}>{actions.requestsToQuote.length}</i>
              </div>
              {actions.requestsToQuote.length ? (
                <div className="supply-action-list">
                  {actions.requestsToQuote.map((request) => (
                    <div className="supply-action-row" key={request.purchaseRequestId}>
                      <div>
                        <strong>{request.code}</strong>
                        <small>
                          {request.itemCount} insumos - {request.sample}
                          {request.requestDate ? ` - desde ${formatOptionalDate(request.requestDate)}` : ""}
                          {request.requesterUser ? ` - ${request.requesterUser}` : ""}
                        </small>
                        {request.relatedQuotationId && (
                          <small className="supply-action-hint">Cotação provável #{request.relatedQuotationId} ({request.relatedQuotationStatus})</small>
                        )}
                      </div>
                      <Link className="button secondary" href={`/cotacoes?solicitacao=${request.purchaseRequestId}`}>
                        {request.relatedQuotationId ? "Abrir cotação" : "Iniciar cotação"}
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">Nenhuma solicitação aguardando cotação.</div>
              )}
            </article>

            <article className="card panel">
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">Cotações aguardando fornecedores</h2>
                  <span className="panel-note">Sem fornecedor vinculado ou sem resposta de preço</span>
                </div>
                <i className={`badge ${actions.quotationsWaitingSuppliers.length ? "warn" : ""}`}>{actions.quotationsWaitingSuppliers.length}</i>
              </div>
              {actions.quotationsWaitingSuppliers.length ? (
                <div className="supply-action-list">
                  {actions.quotationsWaitingSuppliers.map((quotation) => (
                    <div className="supply-action-row" key={quotation.id}>
                      <div>
                        <strong>Cotação #{quotation.code}</strong>
                        <small>
                          {quotation.itemCount} insumos - {quotation.supplierCount ? `${quotation.responseCount} de ${quotation.supplierCount} fornecedores responderam` : "sem fornecedores"}
                          {quotation.date ? ` - ${formatOptionalDate(quotation.date)}` : ""}
                        </small>
                      </div>
                      <Link className="button secondary" href={`/cotacoes/${quotation.id}`}>Abrir</Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">Todas as cotações em andamento têm fornecedores respondendo.</div>
              )}
            </article>

            <article className="card panel">
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">Prontas para decisão</h2>
                  <span className="panel-note">Cotações com preço recebido esperando aprovação</span>
                </div>
                <i className="badge">{actions.quotationsReadyForDecision.length}</i>
              </div>
              {actions.quotationsReadyForDecision.length ? (
                <div className="supply-action-list">
                  {actions.quotationsReadyForDecision.map((quotation) => (
                    <div className="supply-action-row" key={quotation.id}>
                      <div>
                        <strong>Cotação #{quotation.code}</strong>
                        <small>{quotation.itemCount} insumos - melhor cesta {formatCurrency(quotation.totalValue)}</small>
                      </div>
                      <Link className="button secondary" href={`/cotacoes/${quotation.id}`}>Decidir</Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">Nenhuma cotação aguardando decisão agora.</div>
              )}
            </article>

            <article className="card panel">
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">Pedidos que precisam de atenção</h2>
                  <span className="panel-note">Sem autorização ou com entrega atrasada</span>
                </div>
                <i className={`badge ${actions.lateOrders.length ? "late" : actions.ordersAwaitingAuthorization.length ? "warn" : ""}`}>
                  {actions.lateOrders.length + actions.ordersAwaitingAuthorization.length}
                </i>
              </div>
              {actions.lateOrders.length || actions.ordersAwaitingAuthorization.length ? (
                <div className="supply-action-list">
                  {actions.lateOrders.map((order) => (
                    <div className="supply-action-row" key={`late-${order.id}`}>
                      <div>
                        <strong>Pedido {order.code}</strong>
                        <small>{order.supplierName} - {formatCurrency(order.amount)}{order.date ? ` - ${formatOptionalDate(order.date)}` : ""}</small>
                      </div>
                      <i className="badge late">{order.statusLabel}</i>
                    </div>
                  ))}
                  {actions.ordersAwaitingAuthorization.map((order) => (
                    <div className="supply-action-row" key={`auth-${order.id}`}>
                      <div>
                        <strong>Pedido {order.code}</strong>
                        <small>{order.supplierName} - {formatCurrency(order.amount)}{order.buyer ? ` - ${order.buyer}` : ""}</small>
                      </div>
                      <i className="badge warn">{order.statusLabel}</i>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">Nenhum pedido travado por autorização ou entrega.</div>
              )}
            </article>
          </section>

          <div className="grid-main">
            <MonthlyVolumeChart
              data={summary.monthlyPurchased}
              title="Comprado por mês"
              note={`Valor e quantidade dos pedidos em ${overview.period.label.toLowerCase()}`}
            />
            <RankingChart
              title="Fornecedores do período"
              note={`Pedidos por fornecedor em ${overview.period.label.toLowerCase()}`}
              data={overview.topSuppliersPeriod}
              countLabel="pedido"
            />
          </div>

          <div className="grid-main equal-grid">
            <RankingChart title="Volume por comprador" note="Compradores com maior volume informado" data={summary.byBuyer} />
            <section className="card methodology">
              <strong>Leitura rápida</strong>
              <p>
                O funil mostra onde cada compra está: solicitação aprovada vira cotação, cotação decidida vira pedido e pedido entregue vira nota.
                Os painéis de ação listam exatamente o que está parado em cada etapa, com atalho para resolver. A lista completa fica na aba Registros.
              </p>
            </section>
          </div>
        </>
      ) : (
        <PurchasesExplorer totalRecords={totalRecords} />
      )}
    </>
  );
}
