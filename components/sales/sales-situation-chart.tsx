import type { ChartItem } from "@/features/financeiro/sienge-data";
import { formatCompactCurrency } from "@/lib/formatters";

const colors = ["#1f6b4f", "#d6a04e", "#c46655", "#75988a", "#8d7baf"];

export function SalesSituationChart({ data }: { data: ChartItem[] }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  let current = 0;
  const gradient = data.map((item, index) => {
    const start = total ? (current / total) * 100 : 0;
    current += item.count;
    return `${colors[index % colors.length]} ${start}% ${total ? (current / total) * 100 : 0}%`;
  }).join(", ");
  return (
    <section className="card panel">
      <div className="panel-head"><div><h2 className="panel-title">Situação dos contratos</h2><span className="panel-note">Quantidade e valor em caixa (sem permutas) por situação comercial</span></div></div>
      <div className="sales-situation-layout">
        <div className="sales-situation-donut" style={{ background: `conic-gradient(${gradient || "#edf1ee 0 100%"})` }}><div><strong>{total}</strong><span>contratos</span></div></div>
        <div className="sales-situation-legend">{data.map((item, index) => <div key={item.label}><i style={{ background: colors[index % colors.length] }} /><span>{item.label}</span><strong>{item.count}</strong><small>{formatCompactCurrency(item.value)}</small></div>)}</div>
      </div>
    </section>
  );
}
