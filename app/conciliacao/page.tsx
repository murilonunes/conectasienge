import { PageHeading } from "@/components/ui/page-heading";
import { ReconciliationPortal } from "@/components/reconciliation/reconciliation-portal";
import { analyzeReconciliation, loadReconciliationMovements } from "@/features/reconciliation/data";
import { getAppSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function ConciliacaoPage() {
  const settings = getAppSettings();
  const result = await loadReconciliationMovements();
  const summary = analyzeReconciliation(result.movements);
  const initialPayload = {
    ...result,
    summary,
    loadedAt: new Date().toISOString()
  };

  return (
    <>
      <PageHeading
        eyebrow="Caixa e bancos"
        title="Portal de conciliação"
        subtitle="Acompanhe movimentos de Caixa e Bancos com leitura mensal do que foi conciliado e do que ficou pendente."
      />
      <ReconciliationPortal configuredAccountNumbers={settings.reconciliationAccountNumbers} initialPayload={initialPayload} />
    </>
  );
}
