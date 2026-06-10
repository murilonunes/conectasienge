export function StatCard({ label, value, delta, warn, icon }: { label: string; value: string; delta: string; warn?: boolean; icon: string }) {
  return (
    <article className="card stat">
      <div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div>
      <div className="stat-value">{value}</div>
      <span className={`delta ${warn ? "warn" : ""}`}>{delta}</span>
    </article>
  );
}
