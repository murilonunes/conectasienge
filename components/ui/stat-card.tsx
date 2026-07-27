import { I18nText } from "@/components/i18n/i18n-text";

export function StatCard({ label, value, delta, warn, icon }: { label: string; value: string; delta: string; warn?: boolean; icon: string }) {
  return (
    <article className="card stat">
      <div className="stat-top"><span><I18nText text={label} /></span><span className="stat-icon">{icon}</span></div>
      <div className="stat-value"><I18nText text={value} /></div>
      <span className={`delta ${warn ? "warn" : ""}`}><I18nText text={delta} /></span>
    </article>
  );
}
