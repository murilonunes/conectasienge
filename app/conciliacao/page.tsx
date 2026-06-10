import { PageHeading } from "@/components/ui/page-heading";
import { ReconciliationPortal } from "@/components/reconciliation/reconciliation-portal";

export const dynamic = "force-dynamic";

export default function ConciliacaoPage() {
  return (
    <>
      <PageHeading
        eyebrow="Caixa e bancos"
        title="Portal de conciliação"
        subtitle="Acompanhe a leitura do SQLite, atualização no Sienge e montagem dos movimentos conciliados."
      />
      <ReconciliationPortal />
    </>
  );
}
