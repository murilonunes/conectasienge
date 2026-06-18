export function StatusDonut({
  complete,
  incomplete,
  title = "Consistência dos títulos",
  note = "Situação cadastral",
  completeLabel = "Completos",
  incompleteLabel = "A revisar",
  centerLabel = "completos",
  description
}: {
  complete: number;
  incomplete: number;
  title?: string;
  note?: string;
  completeLabel?: string;
  incompleteLabel?: string;
  centerLabel?: string;
  description?: string;
}) {
  const total = complete + incomplete;
  const percentage = total ? (complete / total) * 100 : 0;
  return (
    <section className="card panel">
      <div className="panel-head"><div><h2 className="panel-title">{title}</h2><span className="panel-note">{note}</span></div></div>
      <div className="donut-layout">
        <div className="donut" style={{ background: `conic-gradient(var(--green) ${percentage}%, #e8b464 ${percentage}% 100%)` }}>
          <div><strong>{percentage.toFixed(0)}%</strong><span>{centerLabel}</span></div>
        </div>
        <div className="donut-legend">
          <div><i className="dot" /><span>{completeLabel}</span><strong>{complete}</strong></div>
          <div><i className="dot out" /><span>{incompleteLabel}</span><strong>{incomplete}</strong></div>
          {description && <p>{description}</p>}
        </div>
      </div>
    </section>
  );
}
