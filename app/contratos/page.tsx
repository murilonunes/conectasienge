import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { ContractsExplorer } from "@/components/contracts/contracts-explorer";
import { RankingChart } from "@/components/charts/ranking-chart";
import { analyzeContracts, loadSupplyContracts } from "@/features/contracts/data";
import { formatCurrency } from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function ContratosPage() {
  const result = await loadSupplyContracts();
  const summary = analyzeContracts(result.contracts);

  return (
    <>
      <PageHeading
        eyebrow="Contratos"
        title="Contratos de fornecimento"
        subtitle={`${result.contracts.length} contratos disponíveis nos dados integrados.`}
        action="Atualizar dados"
        actionHref="/configuracoes"
      />

      <div className="stats">
        <StatCard label="Valor contratado" value={formatCurrency(summary.totalValue)} delta={`${result.contracts.length} contratos carregados`} icon="R$" />
        <StatCard label="Saldo estimado" value={formatCurrency(summary.balanceValue)} delta="Valor contratado menos medições identificadas" icon="S" />
        <StatCard label="Ativos" value={String(summary.activeCount)} delta={`${summary.closedCount} encerrados ou finalizados`} icon="A" />
        <StatCard label="Fornecedores" value={String(summary.suppliersCount)} delta="Fornecedores identificados nos contratos" icon="F" />
      </div>

      {result.error && result.contracts.length === 0 && (
        <section className="card data-notice">
          <strong>Contratos ainda não salvos</strong>
          <span>
            Esta tela lê somente o banco local. Atualize Contratos em Configurações para consultar o Sienge uma vez,
            gravar os dados no SQLite e liberar a visão de contratos aqui.
          </span>
        </section>
      )}

      {!result.error && result.contracts.length > 0 && (
        <div className="grid-main">
          <RankingChart title="Contratos por situação" note="Quantidade e valor por situação contratual" data={summary.byStatus} countLabel="contrato" />
          <section className="card panel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Leitura contratual</h2>
                <span className="panel-note">Resumo dos contratos salvos para acompanhamento operacional</span>
              </div>
            </div>
            <div className="contract-summary-list">
              <div><span>Valor medido</span><strong>{formatCurrency(summary.measuredValue)}</strong></div>
              <div><span>Saldo estimado</span><strong>{formatCurrency(summary.balanceValue)}</strong></div>
              <div><span>Contratos ativos</span><strong>{summary.activeCount}</strong></div>
              <div><span>Contratos encerrados</span><strong>{summary.closedCount}</strong></div>
            </div>
          </section>
        </div>
      )}

      <ContractsExplorer contracts={result.contracts} />
    </>
  );
}
