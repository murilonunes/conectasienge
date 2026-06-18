import { NextResponse } from "next/server";
import { analyzeReconciliation, loadReconciliationMovements } from "@/features/reconciliation/data";
import { completeReconciliationProgress, startReconciliationProgress, updateReconciliationProgress } from "@/lib/reconciliation-progress";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") || crypto.randomUUID();
  startReconciliationProgress(id);

  const result = await loadReconciliationMovements((progress) => updateReconciliationProgress(id, progress));
  updateReconciliationProgress(id, {
    stage: "summary",
    message: "Calculando indicadores da conciliação.",
    detail: `${result.movements.length} movimento(s)`
  });

  const summary = analyzeReconciliation(result.movements);
  completeReconciliationProgress(id, result.error ? "Leitura finalizada com aviso." : "Leitura de conciliação concluída.");

  return NextResponse.json({
    id,
    ...result,
    summary,
    loadedAt: new Date().toISOString()
  });
}
