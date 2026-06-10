const rows = [
  ["Residencial Aurora", "R$ 1,84 mi", 78, ""],
  ["Edifício Horizonte", "R$ 1,21 mi", 56, "amber"],
  ["Parque das Águas", "R$ 692 mil", 34, "red"],
  ["Centro Empresarial", "R$ 458 mil", 67, ""]
] as const;

export function PortfolioSummary() {
  return (
    <section className="card panel">
      <div className="panel-head"><div><h2 className="panel-title">Carteira por empreendimento</h2><span className="panel-note">Receita realizada sobre prevista</span></div></div>
      <div className="summary-list">
        {rows.map(([name, value, progress, tone]) => (
          <div className="summary-row" key={name}><span>{name}</span><strong>{value}</strong><div className={`progress ${tone}`}><i style={{ width: `${progress}%` }} /></div></div>
        ))}
      </div>
    </section>
  );
}
