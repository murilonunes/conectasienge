import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { ApiErrorNotice } from "@/components/ui/api-error-notice";
import { InventoryExplorer } from "@/components/inventory/inventory-explorer";
import { PercentPieChart } from "@/components/charts/percent-pie-chart";
import { RankingChart } from "@/components/charts/ranking-chart";
import { analyzeInventory, loadInventoryAssets } from "@/features/inventory/data";
import type { InventorySourceStat } from "@/features/inventory/types";
import { formatCompactCurrency } from "@/lib/formatters";

export const dynamic = "force-dynamic";

function sourceDelta(source?: InventorySourceStat) {
  if (!source) return "Ainda não carregado";
  if (source.status === "error") return "Não foi possível carregar";
  if (source.status === "empty") return "Sem itens nessa origem";
  if (source.status === "partial") return `${source.loadedCount} exibido(s) de ${source.apiCount} informado(s)`;
  if (source.status === "not_configured") return "Configure centros de custo";
  return `${source.loadedCount} item(ns) carregado(s)`;
}

export default async function InventoryPage() {
  const result = await loadInventoryAssets();
  const portfolioAssets = result.assets.filter((asset) => !(asset.kind === "unit" && ["V", "G", "T", "L"].includes(asset.commercialStock || "")));
  const summary = analyzeInventory(result.assets, {
    realEstateMap: result.realEstateMap,
    priceTables: result.priceTables,
    stockReservations: result.stockReservations,
    stockItems: result.stockItems
  });
  const portfolioSummary = analyzeInventory(portfolioAssets, {
    realEstateMap: result.realEstateMap,
    priceTables: result.priceTables,
    stockReservations: result.stockReservations,
    stockItems: result.stockItems
  });
  const pricingCoverage = summary.portfolioCount ? Math.round((summary.portfolioPricedCount / summary.portfolioCount) * 100) : 0;
  const portfolioUnitCount = portfolioAssets.filter((asset) => asset.kind === "unit").length;
  const commercialCoverage = portfolioUnitCount ? Math.round((summary.saleableUnitCount / portfolioUnitCount) * 100) : 0;
  const mapStockValue = summary.mapStockValue || summary.saleableUnitValue || summary.totalValue;
  const soldHiddenCount = summary.soldOrThirdPartyUnitCount;

  return (
    <>
      <PageHeading
        eyebrow="Portal de estoque"
        title="Visão estratégica de estoque"
        subtitle={`${summary.portfolioCount} itens em carteira. Vendidos, locados, transferidos e terceiros ficam fora da visão inicial e aparecem na listagem quando você filtrar.`}
      />
      <div className="stats">
        <StatCard label="Carteira precificada" value={formatCompactCurrency(summary.portfolioPricedValue || summary.portfolioValue)} delta={`${summary.portfolioPricedCount} de ${summary.portfolioCount} itens em carteira com valor`} warn={summary.portfolioNoValueCount > 0} icon="R$" />
        <StatCard label="Disponível para venda" value={String(summary.saleableUnitCount)} delta={`${commercialCoverage}% das unidades em carteira`} icon="D" />
        <StatCard label="Reservas e propostas" value={String(summary.reservedUnitCount)} delta={formatCompactCurrency(summary.reservedUnitValue)} warn={summary.reservedUnitCount > 0} icon="R" />
        <StatCard label="Fora da visão inicial" value={String(soldHiddenCount)} delta="Vendidos, locados, transferidos ou terceiros" icon="V" />
      </div>
      {result.error ? <ApiErrorNotice error={result.error} /> : <>
        {result.warning && <div className="card data-notice"><strong>Dados parciais</strong><span>{result.warning}</span></div>}
        {result.sourceStats.some((source) => source.status === "not_configured") && (
          <div className="card data-notice">
            <strong>Estoque avançado opcional</strong>
            <span>Para consultar mapa imobiliário consolidado e insumos por centro de custo, informe os centros em Configurações e atualize Estoque e patrimônio.</span>
          </div>
        )}

        <section className="card inventory-executive">
          <div>
            <span>Carteira disponível</span>
            <strong>{formatCompactCurrency(summary.saleableUnitValue || mapStockValue)}</strong>
            <small>{summary.saleableUnitCount} unidades disponíveis e {summary.portfolioPrivateArea.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} m² privativos em carteira.</small>
          </div>
          <div>
            <span>Mapa imobiliário</span>
            <strong>{formatCompactCurrency(summary.mapVgv)}</strong>
            <small>{result.realEstateMap.length ? `${result.realEstateMap.length} registros de mapa consolidado` : "Configure centros de custo para enriquecer esta visão."}</small>
          </div>
          <div>
            <span>Insumos em estoque</span>
            <strong>{formatCompactCurrency(summary.stockInputValue)}</strong>
            <small>{summary.stockInputCount} itens de insumo salvos.</small>
          </div>
          <div>
            <span>Propriedade</span>
            <strong>{portfolioSummary.ownCount} próprios</strong>
            <small>{portfolioSummary.thirdPartyCount} terceiros em carteira. Vendidos ficam só na listagem.</small>
          </div>
        </section>

        <div className="card inventory-source-panel">
          {result.sourceStats.map((source) => (
            <div key={source.endpoint}>
              <strong>{source.label}</strong>
              <span>{sourceDelta(source)}</span>
              <small>{source.loadedCount} exibido(s) de {source.apiCount} item(ns) informado(s)</small>
            </div>
          ))}
        </div>

        <div className="grid-main equal-grid">
          <PercentPieChart title="Carteira por situação" note="Somente unidades ainda em carteira" data={portfolioSummary.byStock} centerLabel="unidades" />
          <RankingChart title="Valor por empreendimento" note="Somente unidades ainda em carteira" data={portfolioSummary.byEnterprise} countLabel="unidade" />
        </div>

        <div className="grid-main equal-grid">
          <RankingChart title="Distribuição por tipo de bem" note="Somente itens em carteira" data={portfolioSummary.byKind} countLabel="bem" />
          <RankingChart title="Próprio x terceiros" note="Somente itens em carteira" data={portfolioSummary.byOwnership} countLabel="item" />
        </div>

        <section className="card panel inventory-stock-panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Qualidade da base de valores</h2>
              <span className="panel-note">Ajuda a separar estoque sem preço de estoque realmente avaliado.</span>
            </div>
          </div>
          <div className="inventory-quality-grid">
            <div><span>Com valor</span><strong>{summary.portfolioPricedCount}</strong><small>{formatCompactCurrency(summary.portfolioPricedValue)}</small></div>
            <div><span>Sem valor</span><strong>{summary.portfolioNoValueCount}</strong><small>Revisar cadastro, avaliação ou tabela</small></div>
            <div><span>Tabelas ativas</span><strong>{summary.activePriceTableCount}</strong><small>{result.priceTables.length} tabela(s) salvas</small></div>
            <div><span>Margem no mapa</span><strong>{(summary.averageMapMargin * 100).toFixed(1).replace(".", ",")}%</strong><small>{formatCompactCurrency(summary.mapGrossProfit)} lucro bruto</small></div>
          </div>
        </section>

        <div className="grid-main equal-grid">
          <RankingChart title="Insumos com maior valor" note="Quantidade x preço médio por insumo salvo" data={summary.stockItemsTop} countLabel="item" />
          <section className="card panel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Reservas de insumos</h2>
                <span className="panel-note">Reservas salvas no Sienge que podem indicar compromisso operacional.</span>
              </div>
            </div>
            <div className="inventory-quality-grid compact">
              <div><span>Pendentes</span><strong>{summary.pendingReservationCount}</strong><small>Reservas aguardando movimentação</small></div>
              <div><span>Total salvo</span><strong>{result.stockReservations.length}</strong><small>Reservas integradas</small></div>
              <div><span>Fontes avançadas</span><strong>{result.sourceStats.filter((source) => source.status === "ok").length}</strong><small>Consultas com dados locais</small></div>
              <div><span>Mapa imobiliário</span><strong>{result.realEstateMap.length}</strong><small>{formatCompactCurrency(summary.mapStockValue)} em estoque no mapa</small></div>
            </div>
          </section>
        </div>

        <div className="card data-notice">
          <strong>Como ler propriedade e valores</strong>
          <span>Próprio/terceiro usa proprietário anterior, origem contábil, indicador de uso e estoque comercial quando esses campos existem. Valor informado usa incorporação, valor contábil, avaliação, tabela especial, fração de VGV ou terreno; quando nada vem da API, aparece como sem valor.</span>
        </div>

        <InventoryExplorer assets={result.assets} initialScope="portfolio" />
      </>}
    </>
  );
}
