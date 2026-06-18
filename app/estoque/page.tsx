import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { ApiErrorNotice } from "@/components/ui/api-error-notice";
import { InventoryExplorer } from "@/components/inventory/inventory-explorer";
import { analyzeInventory, loadInventoryAssets } from "@/features/inventory/data";
import type { InventorySourceStat } from "@/features/inventory/types";
import { formatCompactCurrency } from "@/lib/formatters";

export const dynamic = "force-dynamic";

function sourceDelta(source?: InventorySourceStat) {
  if (!source) return "Ainda não carregado";
  if (source.status === "error") return "Não foi possível carregar";
  if (source.status === "empty") return "Sem itens nessa origem";
  if (source.status === "partial") return `${source.loadedCount} exibido(s) de ${source.apiCount} informado(s)`;
  return `${source.loadedCount} item(ns) carregado(s)`;
}

export default async function InventoryPage() {
  const result = await loadInventoryAssets();
  const summary = analyzeInventory(result.assets);

  return (
    <>
      <PageHeading
        eyebrow="Portal de estoque"
        title="Bens em estoque"
        subtitle={`${result.totalCount} itens exibidos a partir dos dados integrados.`}
      />
      <div className="stats">
        <StatCard label="Valor em estoque" value={formatCompactCurrency(summary.totalValue)} delta="Valores de incorporação, avaliação ou venda" icon="R$" />
        <StatCard label="Unidades imobiliárias" value={String(summary.unitCount)} delta={sourceDelta(result.sourceStats[0])} icon="U" />
        <StatCard label="Bens móveis" value={String(summary.movableCount)} delta={sourceDelta(result.sourceStats[1])} warn={result.sourceStats[1]?.status !== "ok"} icon="M" />
        <StatCard label="Bens imóveis" value={String(summary.fixedCount)} delta={sourceDelta(result.sourceStats[2])} warn={result.sourceStats[2]?.status !== "ok"} icon="I" />
      </div>
      {result.error ? <ApiErrorNotice error={result.error} /> : <>
        {result.warning && <div className="card data-notice"><strong>Dados parciais</strong><span>{result.warning}</span></div>}
        <div className="card inventory-source-panel">
          {result.sourceStats.map((source) => (
            <div key={source.endpoint}>
              <strong>{source.label}</strong>
              <span>{sourceDelta(source)}</span>
              <small>{source.loadedCount} exibido(s) de {source.apiCount} item(ns) informado(s)</small>
            </div>
          ))}
        </div>
        <section className="card panel inventory-stock-panel">
          <div className="panel-head"><div><h2 className="panel-title">Distribuição por tipo de bem</h2><span className="panel-note">Quantidade e valor por tipo de estoque</span></div></div>
          <div className="ranking-list">
            {summary.byKind.map((item) => {
              const max = Math.max(...summary.byKind.map((kind) => kind.count), 1);
              return <div className="ranking-row" key={item.label}><div><span>{item.label}</span><strong>{item.count} bem(ns)</strong></div><div className="ranking-track"><i style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }} /></div><small>{formatCompactCurrency(item.value)}</small></div>;
            })}
          </div>
        </section>
        <div className="card data-notice">
          <strong>Propriedade</strong>
          <span>A marcação como próprio ou terceiro usa as informações de origem e proprietário quando elas existem.</span>
        </div>
        <InventoryExplorer assets={result.assets} />
      </>}
    </>
  );
}
