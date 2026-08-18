import { NextResponse } from "next/server";
import { guardPermission } from "@/lib/app-users";
import { loadPurchases } from "@/features/purchases/data";
import { purchaseProjectKanbanActions as actions } from "@/lib/purchase-project-kanban-actions";
import { loadSupplierQuoteRequestOrigins, saveSupplierQuoteRequestOrigins } from "@/lib/supplier-quote-portal";
import {
  createPurchaseProjectKanbanColumn,
  createPurchaseProjectKanbanProject,
  deletePurchaseProjectKanbanColumn,
  deletePurchaseProjectKanbanProject,
  linkPurchaseRequestToKanbanProject,
  loadPurchaseProjectKanban,
  movePurchaseProjectKanbanProject,
  renamePurchaseProjectKanbanColumn,
  reorderPurchaseProjectKanbanColumn,
  unlinkPurchaseRequestFromKanbanProject,
  updatePurchaseProjectKanbanProject
} from "@/lib/purchase-project-kanban";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function guarded(request: Request) {
  return guardPermission(request, "screen.kanban-compras");
}

export async function GET(request: Request) {
  const guard = guarded(request);
  if (!guard.user || guard.status) {
    return NextResponse.json({ message: guard.message }, { status: guard.status || 403 });
  }
  return NextResponse.json(loadPurchaseProjectKanban());
}

export async function POST(request: Request) {
  const guard = guarded(request);
  if (!guard.user || guard.status) {
    return NextResponse.json({ message: guard.message }, { status: guard.status || 403 });
  }

  try {
    const input = await request.json().catch(() => ({})) as {
      action?: string;
      columnId?: number;
      name?: string;
      direction?: "left" | "right";
      projectId?: number;
      position?: number;
      requestId?: number;
      description?: string;
      closingDate?: string;
      quotationId?: number;
    };
    const columnId = Number(input.columnId);
    let state;

    switch (input.action) {
      case actions.createColumn:
        state = createPurchaseProjectKanbanColumn(String(input.name || ""));
        break;
      case actions.renameColumn:
        state = renamePurchaseProjectKanbanColumn(columnId, String(input.name || ""));
        break;
      case actions.reorderColumn:
        if (input.direction !== "left" && input.direction !== "right") throw new Error("Direção inválida.");
        state = reorderPurchaseProjectKanbanColumn(columnId, input.direction);
        break;
      case actions.deleteColumn:
        state = deletePurchaseProjectKanbanColumn(columnId);
        break;
      case actions.moveProject:
        state = movePurchaseProjectKanbanProject(Number(input.projectId), columnId, input.position);
        break;
      case actions.createProject:
        state = createPurchaseProjectKanbanProject(String(input.name || ""), String(input.description || ""), String(input.closingDate || ""));
        break;
      case actions.updateProject:
        state = updatePurchaseProjectKanbanProject(Number(input.projectId), String(input.name || ""), String(input.description || ""), String(input.closingDate || ""));
        break;
      case actions.deleteProject:
        state = deletePurchaseProjectKanbanProject(Number(input.projectId));
        break;
      case actions.linkRequest: {
        const requestId = Number(input.requestId);
        const purchases = await loadPurchases();
        if (!purchases.requestItems.some((item) => item.purchaseRequestId === requestId)) {
          throw new Error("A solicitação não existe no espelho local de compras.");
        }
        state = linkPurchaseRequestToKanbanProject(Number(input.projectId), requestId);
        break;
      }
      case actions.unlinkRequest:
        state = unlinkPurchaseRequestFromKanbanProject(Number(input.projectId), Number(input.requestId));
        break;
      case actions.linkQuotationRequest: {
        const requestId = Number(input.requestId);
        const quotationId = Number(input.quotationId);
        const purchases = await loadPurchases();
        if (!purchases.requestItems.some((item) => item.purchaseRequestId === requestId)) throw new Error("A solicitação não existe no espelho local de compras.");
        if (!purchases.quotations.some((quotation) => quotation.purchaseQuotationId === quotationId)) throw new Error("A cotação não existe no espelho local de compras.");
        const currentOrigins = loadSupplierQuoteRequestOrigins().get(quotationId) || [];
        saveSupplierQuoteRequestOrigins(quotationId, [...currentOrigins, requestId]);
        state = loadPurchaseProjectKanban();
        break;
      }
      default:
        return NextResponse.json({ message: "Ação do Kanban não reconhecida." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, ...state });
  } catch (error) {
    return NextResponse.json({
      message: error instanceof Error ? error.message : "Não foi possível atualizar o Kanban."
    }, { status: 400 });
  }
}
