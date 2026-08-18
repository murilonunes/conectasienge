import { PurchaseProjectKanban } from "@/components/purchases/purchase-project-kanban";
import { PageHeading } from "@/components/ui/page-heading";
import { loadPurchaseProjectKanbanData } from "@/features/purchases/project-kanban-data";
import { loadPurchaseProjectKanban } from "@/lib/purchase-project-kanban";

export const dynamic = "force-dynamic";

export default async function PurchaseProjectKanbanPage() {
  const board = loadPurchaseProjectKanban();
  const catalog = await loadPurchaseProjectKanbanData(board.projects.flatMap((project) => project.requestIds));
  const visibleRequestIds = new Set(catalog.requests.map((request) => request.id));
  const visibleBoard = {
    ...board,
    projects: board.projects.map((project) => ({
      ...project,
      requestIds: project.requestIds.filter((requestId) => visibleRequestIds.has(requestId)),
      requestLinks: project.requestLinks.filter((link) => visibleRequestIds.has(link.requestId))
    }))
  };

  return (
    <>
      <PageHeading
        eyebrow="Compras por projeto"
        title="Kanban de projetos"
        subtitle="Agrupe solicitações de compra em projetos próprios e acompanhe cada etapa em uma visão gerencial."
      />
      <PurchaseProjectKanban initialBoard={visibleBoard} catalog={catalog} />
    </>
  );
}
