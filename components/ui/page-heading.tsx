import Link from "next/link";

export function PageHeading({ eyebrow, title, subtitle, action, actionHref }: { eyebrow: string; title: string; subtitle: string; action?: string; actionHref?: string }) {
  return (
    <div className="page-heading">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="subtitle">{subtitle}</p></div>
      {action && (actionHref ? <Link className="button" href={actionHref}>{action}</Link> : <button className="button">{action}</button>)}
    </div>
  );
}
