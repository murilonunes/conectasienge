import { PurchaseProjectKanban } from "@/components/purchases/purchase-project-kanban";
import { PageHeading } from "@/components/ui/page-heading";
import { loadPurchaseProjectKanbanData } from "@/features/purchases/project-kanban-data";
import { loadPurchaseProjectKanban } from "@/lib/purchase-project-kanban";

export const dynamic = "force-dynamic";

export default async function PurchaseProjectKanbanPage() {
  const [catalog, board] = await Promise.all([
    loadPurchaseProjectKanbanData(),
    Promise.resolve(loadPurchaseProjectKanban())
  ]);

  return (
    <>
      <PageHeading
        eyebrow="Compras por projeto"
        title="Kanban de projetos"
        subtitle="Agrupe solicitações de compra em projetos próprios e acompanhe cada etapa em uma visão gerencial."
      />
      <PurchaseProjectKanban initialBoard={board} catalog={catalog} />
    </>
  );
}
