export function DashboardLoadingState() {
  const cards = ["A receber", "A pagar", "Vendas", "Compras"];
  const steps = ["Ler dados salvos", "Montar indicadores", "Atualizar gráficos"];

  return (
    <>
      <section className="card dashboard-loading-hero" aria-live="polite">
        <div>
          <span>Dashboard</span>
          <h2>Atualizando visão geral</h2>
          <p>Estamos lendo os dados salvos e montando os gráficos principais. A tela abre com período curto para ficar mais rápida.</p>
        </div>
        <div className="dashboard-loading-spinner" aria-hidden="true" />
      </section>

      <div className="dashboard-loading-steps">
        {steps.map((step, index) => (
          <div className="card" key={step}>
            <i>{index === 0 ? "..." : "-"}</i>
            <strong>{step}</strong>
            <span>{index === 0 ? "Em andamento" : "Na fila"}</span>
          </div>
        ))}
      </div>

      <div className="stats dashboard-loading-stats">
        {cards.map((card) => (
          <article className="card stat" key={card}>
            <div className="stat-top"><span>{card}</span></div>
            <div className="dashboard-loading-line wide" />
            <div className="dashboard-loading-line" />
          </article>
        ))}
      </div>

      <div className="grid-main">
        <section className="card panel dashboard-loading-chart">
          <div className="dashboard-loading-line title" />
          <div className="dashboard-loading-bars">
            {Array.from({ length: 8 }).map((_, index) => <i key={index} style={{ height: `${34 + index * 7}%` }} />)}
          </div>
        </section>
        <section className="card panel dashboard-loading-chart">
          <div className="dashboard-loading-line title" />
          <div className="dashboard-loading-donut" />
        </section>
      </div>
    </>
  );
}
