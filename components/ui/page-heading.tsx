import Link from "next/link";
import { I18nText } from "@/components/i18n/i18n-text";

export function PageHeading({ eyebrow, title, subtitle, action, actionHref }: { eyebrow: string; title: string; subtitle: string; action?: string; actionHref?: string }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow"><I18nText text={eyebrow} /></p>
        <h1><I18nText text={title} /></h1>
        {subtitle && <p className="subtitle"><I18nText text={subtitle} /></p>}
      </div>
      {action && (actionHref
        ? <Link className="button" href={actionHref}><I18nText text={action} /></Link>
        : <button className="button"><I18nText text={action} /></button>)}
    </div>
  );
}
