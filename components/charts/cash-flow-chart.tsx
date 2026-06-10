const data = [
  ["Jan", 56, 38], ["Fev", 68, 46], ["Mar", 48, 61], ["Abr", 74, 52],
  ["Mai", 82, 59], ["Jun", 64, 44], ["Jul", 88, 63], ["Ago", 72, 49]
] as const;

export function CashFlowChart() {
  return (
    <section className="card panel">
      <div className="panel-head">
        <div><h2 className="panel-title">Fluxo de caixa</h2><span className="panel-note">Entradas e saídas nos últimos 8 meses</span></div>
        <div className="chart-legend"><span><i className="dot" />Entradas</span><span><i className="dot out" />Saídas</span></div>
      </div>
      <div className="chart">
        {data.map(([month, income, outcome]) => (
          <div className="chart-group" key={month}>
            <i className="bar" style={{ height: `${income}%` }} />
            <i className="bar out" style={{ height: `${outcome}%` }} />
            <span className="chart-label">{month}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
