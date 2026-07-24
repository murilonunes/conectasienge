import { I18nText } from "@/components/i18n/i18n-text";
import { PageHeading } from "@/components/ui/page-heading";
import { AdvancedReceivablesSearch } from "@/components/forms/advanced-receivables-search";
import { ReceivableSettlement } from "@/components/forms/receivable-settlement";

export default function BaixaReceberPage() {
  return (
    <>
      <PageHeading
        eyebrow="Contas a receber"
        title="Consulta de recebimentos"
        subtitle="Confira parcelas e recebimentos já registrados usando os dados salvos localmente."
      />
      <AdvancedReceivablesSearch />
      <div className="section-divider"><span><I18nText text={"ou consulte pelo código do título a receber"} /></span></div>
      <ReceivableSettlement />
    </>
  );
}
