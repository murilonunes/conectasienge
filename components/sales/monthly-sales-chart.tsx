import type { ChartItem } from "@/features/financeiro/sienge-data";
import { formatCompactCurrency } from "@/lib/formatters";

export function MonthlySalesChart({ data }: { data: ChartItem[] }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const maxCount = Math.max(...data.map((item) => item.count), 1);

  return (
    <section className="card panel sales-monthly-panel">
      <div className="panel-head">
        <div><h2 className="panel-title">Vendas por mês</h2><span className="panel-note">Valor líquido de venda, sem permutas, e quantidade de contratos emitidos</span></div>
        <div className="chart-legend"><span><i className="dot" />Valor</span><span><i className="dot out" />Contratos</span></div>
      </div>
      {data.length ? <div className="sales-monthly-chart">
        {data.map((item) => (
          <div className="sales-monthly-column" key={item.label} title={`${item.label}: ${formatCompactCurrency(item.value)} em ${item.count} contratos`}>
            <span>{formatCompactCurrency(item.value)}</span>
            <div className="sales-monthly-bars">
              <i className="sales-value-bar" style={{ height: `${item.value > 0 ? Math.max(4, (item.value / maxValue) * 100) : 0}%` }} />
              <i className="sales-count-bar" style={{ height: `${item.count > 0 ? Math.max(4, (item.count / maxCount) * 100) : 0}%` }}><b>{item.count}</b></i>
            </div>
            <strong>{item.label}</strong>
          </div>
        ))}
      </div> : <div className="chart-empty">Nenhum contrato com data de emissão foi encontrado.</div>}
    </section>
  );
}
