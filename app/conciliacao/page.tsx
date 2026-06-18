import { PageHeading } from "@/components/ui/page-heading";
import { ReconciliationPortal } from "@/components/reconciliation/reconciliation-portal";
import { getAppSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default function ConciliacaoPage() {
  const settings = getAppSettings();
  return (
    <>
      <PageHeading
        eyebrow="Caixa e bancos"
        title="Portal de conciliação"
        subtitle="Acompanhe movimentos de Caixa e Bancos com leitura mensal do que foi conciliado e do que ficou pendente."
      />
      <ReconciliationPortal configuredAccountNumbers={settings.reconciliationAccountNumbers} />
    </>
  );
}
