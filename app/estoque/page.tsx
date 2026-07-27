import { I18nText } from "@/components/i18n/i18n-text";
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
  const completedBusinessCount = summary.soldOrThirdPartyUnitCount;

  return (
    <>
      <PageHeading
        eyebrow="Portal de estoque"
        title="Visão estratégica de estoque"
        subtitle={`${summary.portfolioCount} itens em carteira comercial para análise de venda, reserva, preço e propriedade.`}
      />
      <div className="stats">
        <StatCard label="Carteira comercial" value={formatCompactCurrency(summary.portfolioPricedValue || summary.portfolioValue)} delta={`${summary.portfolioPricedCount} de ${summary.portfolioCount} itens com valor`} warn={summary.portfolioNoValueCount > 0} icon="R$" />
        <StatCard label="Disponível para venda" value={String(summary.saleableUnitCount)} delta={`${commercialCoverage}% das unidades comerciais`} icon="D" />
        <StatCard label="Reservas e propostas" value={String(summary.reservedUnitCount)} delta={formatCompactCurrency(summary.reservedUnitValue)} warn={summary.reservedUnitCount > 0} icon="R" />
        <StatCard label="Negócios concluídos" value={String(completedBusinessCount)} delta="Vendidos, locados, transferidos ou de terceiros" icon="V" />
      </div>
      {result.error ? <ApiErrorNotice error={result.error} /> : <>
        {result.warning && <div className="card data-notice"><strong><I18nText text={"Dados parciais"} /></strong><span><I18nText text={result.warning} /></span></div>}
        {result.sourceStats.some((source) => source.status === "not_configured") && (
          <div className="card data-notice">
            <strong><I18nText text={"Estoque avançado opcional"} /></strong>
            <span><I18nText text={"Para consultar mapa imobiliário consolidado e insumos por centro de custo, informe os centros em Configurações e atualize Estoque e patrimônio."} /></span>
          </div>
        )}

        <section className="card inventory-executive">
          <div>
            <span><I18nText text={"Carteira disponível"} /></span>
            <strong>{formatCompactCurrency(summary.saleableUnitValue || mapStockValue)}</strong>
            <small>{summary.saleableUnitCount} <I18nText text={"unidades disponíveis e"} /> {summary.portfolioPrivateArea.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} <I18nText text={"m² privativos comerciais."} /></small>
          </div>
          <div>
            <span><I18nText text={"Mapa imobiliário"} /></span>
            <strong>{formatCompactCurrency(summary.mapVgv)}</strong>
            <small>{result.realEstateMap.length ? `${result.realEstateMap.length} registros de mapa consolidado` : <I18nText text={"Configure centros de custo para enriquecer esta visão."} />}</small>
          </div>
          <div>
            <span><I18nText text={"Insumos em estoque"} /></span>
            <strong>{formatCompactCurrency(summary.stockInputValue)}</strong>
            <small>{summary.stockInputCount} <I18nText text={"itens de insumo salvos."} /></small>
          </div>
          <div>
            <span><I18nText text={"Propriedade"} /></span>
            <strong>{portfolioSummary.ownCount} <I18nText text={"próprios"} /></strong>
            <small>{portfolioSummary.thirdPartyCount} <I18nText text={"itens de terceiros na carteira comercial."} /></small>
          </div>
        </section>

        <div className="card inventory-source-panel">
          {result.sourceStats.map((source) => (
            <div key={source.endpoint}>
              <strong><I18nText text={source.label} /></strong>
              <span><I18nText text={sourceDelta(source)} /></span>
              <small>{source.loadedCount} <I18nText text={"exibido(s) de"} /> {source.apiCount} <I18nText text={"item(ns) informado(s)"} /></small>
            </div>
          ))}
        </div>

        <div className="grid-main equal-grid">
          <PercentPieChart title="Carteira por situação" note="Unidades comerciais por status" data={portfolioSummary.byStock} centerLabel="unidades" />
          <RankingChart title="Valor por empreendimento" note="Carteira comercial com valor informado" data={portfolioSummary.byEnterprise} countLabel="unidade" />
        </div>

        <div className="grid-main equal-grid">
          <RankingChart title="Distribuição por tipo de bem" note="Carteira comercial e patrimônio disponível" data={portfolioSummary.byKind} countLabel="bem" />
          <RankingChart title="Próprio x terceiros" note="Origem dos itens em análise comercial" data={portfolioSummary.byOwnership} countLabel="item" />
        </div>

        <section className="card panel inventory-stock-panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title"><I18nText text={"Qualidade da base de valores"} /></h2>
              <span className="panel-note"><I18nText text={"Ajuda a separar estoque sem preço de estoque realmente avaliado."} /></span>
            </div>
          </div>
          <div className="inventory-quality-grid">
            <div><span><I18nText text={"Com valor"} /></span><strong>{summary.portfolioPricedCount}</strong><small>{formatCompactCurrency(summary.portfolioPricedValue)}</small></div>
            <div><span><I18nText text={"Sem valor"} /></span><strong>{summary.portfolioNoValueCount}</strong><small><I18nText text={"Revisar cadastro, avaliação ou tabela"} /></small></div>
            <div><span><I18nText text={"Tabelas ativas"} /></span><strong>{summary.activePriceTableCount}</strong><small>{result.priceTables.length} <I18nText text={"tabela(s) salvas"} /></small></div>
            <div><span><I18nText text={"Margem no mapa"} /></span><strong>{(summary.averageMapMargin * 100).toFixed(1).replace(".", ",")}<I18nText text={"%"} /></strong><small>{formatCompactCurrency(summary.mapGrossProfit)} <I18nText text={"lucro bruto"} /></small></div>
          </div>
        </section>

        <div className="grid-main equal-grid">
          <RankingChart title="Insumos com maior valor" note="Quantidade x preço médio por insumo salvo" data={summary.stockItemsTop} countLabel="item" />
          <section className="card panel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title"><I18nText text={"Reservas de insumos"} /></h2>
                <span className="panel-note"><I18nText text={"Reservas salvas no Sienge que podem indicar compromisso operacional."} /></span>
              </div>
            </div>
            <div className="inventory-quality-grid compact">
              <div><span><I18nText text={"Pendentes"} /></span><strong>{summary.pendingReservationCount}</strong><small><I18nText text={"Reservas aguardando movimentação"} /></small></div>
              <div><span><I18nText text={"Total salvo"} /></span><strong>{result.stockReservations.length}</strong><small><I18nText text={"Reservas integradas"} /></small></div>
              <div><span><I18nText text={"Fontes avançadas"} /></span><strong>{result.sourceStats.filter((source) => source.status === "ok").length}</strong><small><I18nText text={"Consultas com dados locais"} /></small></div>
              <div><span><I18nText text={"Mapa imobiliário"} /></span><strong>{result.realEstateMap.length}</strong><small>{formatCompactCurrency(summary.mapStockValue)} <I18nText text={"em estoque no mapa"} /></small></div>
            </div>
          </section>
        </div>

        <div className="card data-notice">
          <strong><I18nText text={"Como ler propriedade e valores"} /></strong>
          <span><I18nText text={"Próprio/terceiro usa proprietário anterior, origem contábil, indicador de uso e estoque comercial quando esses campos existem. Valor informado usa incorporação, valor contábil, avaliação, tabela especial, fração de VGV ou terreno; quando nada vem da API, aparece como sem valor."} /></span>
        </div>

        <InventoryExplorer assets={result.assets} initialScope="portfolio" />
      </>}
    </>
  );
}
