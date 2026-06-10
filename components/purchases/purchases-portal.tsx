"use client";

import { useMemo, useState } from "react";
import { MonthlyVolumeChart } from "@/components/charts/monthly-volume-chart";
import { RankingChart } from "@/components/charts/ranking-chart";
import { StatCard } from "@/components/ui/stat-card";
import type { PurchaseSummary } from "@/features/purchases/data";
import { formatCompactCurrency } from "@/lib/formatters";
import { PurchasesExplorer } from "./purchases-explorer";

function stagePercent(done: number, total: number) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

export function PurchasesPortal({ summary, warning }: { summary: PurchaseSummary; warning?: string }) {
  const [tab, setTab] = useState<"overview" | "records">("overview");
  const totalRecords = summary.flow.length;
  const doneCount = totalRecords - summary.pendingCount;
  const donePercent = stagePercent(doneCount, totalRecords);
  const future = useMemo(() => summary.periods.find((period) => period.key === "future"), [summary.periods]);

  return (
    <>
      <div className="purchase-tabs">
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>Visão comercial</button>
        <button className={tab === "records" ? "active" : ""} onClick={() => setTab("records")}>Registros</button>
      </div>

      {tab === "overview" ? (
        <>
          {warning && <div className="card data-notice"><strong>Atenção</strong><span>{warning}</span></div>}

          <div className="stats">
            <StatCard label="Pendente" value={String(summary.pendingCount)} delta={formatCompactCurrency(summary.pendingAmount)} warn={summary.pendingCount > 0} icon="!" />
            <StatCard label="Feito" value={`${donePercent}%`} delta={`${doneCount} registros concluídos`} icon="✓" />
            <StatCard label="Comprado" value={formatCompactCurrency(summary.purchasedAmount)} delta={`${summary.purchasedCount} pedidos não cancelados`} icon="R$" />
            <StatCard label="Futuro" value={String(future?.count || 0)} delta={formatCompactCurrency(future?.amount || 0)} warn={(future?.pendingCount || 0) > 0} icon=">" />
          </div>

          <section className="purchase-periods">
            {summary.periods.map((period) => (
              <article className="card purchase-period" key={period.key}>
                <div>
                  <span>{period.note}</span>
                  <h2>{period.label}</h2>
                </div>
                <strong>{formatCompactCurrency(period.amount)}</strong>
                <div className="purchase-period-meta">
                  <span>{period.count} registro(s)</span>
                  <span>{period.pendingCount} pendente(s)</span>
                  <span>{period.doneCount} feito(s)</span>
                </div>
              </article>
            ))}
          </section>

          <section className="card panel purchase-stage-panel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Andamento das compras</h2>
                <span className="panel-note">O que ainda está pendente e o que já foi feito em cada etapa</span>
              </div>
            </div>
            <div className="purchase-stage-grid">
              {summary.stages.map((stage) => {
                const percent = stagePercent(stage.done, stage.total);
                return (
                  <div key={stage.label}>
                    <div><strong>{stage.label}</strong><span>{stage.total} total</span></div>
                    <div className="ranking-track"><i style={{ width: `${Math.max(4, percent)}%` }} /></div>
                    <small>{stage.done} feito(s) · {stage.pending} pendente(s)</small>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid-main">
            <MonthlyVolumeChart
              data={summary.monthlyPurchased}
              title="Comprado por mês"
              note="Valor dos pedidos de compra por mês"
            />
            <RankingChart title="Onde está pendente" note="Quantidade por situação" data={summary.byStatus} />
          </div>

          <div className="grid-main equal-grid">
            <RankingChart title="Volume por comprador" note="Compradores com maior volume informado" data={summary.byBuyer} />
            <section className="card methodology">
              <strong>Leitura rápida</strong>
              <p>
                Use esta aba para entender o que está em aberto, o que já andou e como o volume de compras se comportou nos períodos principais.
                A lista completa ficou separada na aba Registros.
              </p>
            </section>
          </div>
        </>
      ) : (
        <PurchasesExplorer items={summary.flow} />
      )}
    </>
  );
}
