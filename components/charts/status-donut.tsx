export function StatusDonut({ complete, incomplete }: { complete: number; incomplete: number }) {
  const total = complete + incomplete;
  const percentage = total ? (complete / total) * 100 : 0;
  return (
    <section className="card panel">
      <div className="panel-head"><div><h2 className="panel-title">Consistência dos títulos</h2><span className="panel-note">Situação cadastral, não situação de pagamento</span></div></div>
      <div className="donut-layout">
        <div className="donut" style={{ background: `conic-gradient(var(--green) ${percentage}%, #e8b464 ${percentage}% 100%)` }}>
          <div><strong>{percentage.toFixed(0)}%</strong><span>completos</span></div>
        </div>
        <div className="donut-legend">
          <div><i className="dot" /><span>Completos</span><strong>{complete}</strong></div>
          <div><i className="dot out" /><span>A revisar</span><strong>{incomplete}</strong></div>
          <p>Para analisar títulos pagos, vencidos ou em aberto, será necessário consultar as parcelas de cada título.</p>
        </div>
      </div>
    </section>
  );
}
