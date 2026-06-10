import { NextResponse } from "next/server";
import { contasPagarApi } from "@/lib/api/financeiro";
import { SiengeApiError } from "@/lib/api/sienge";

export async function GET(_: Request, { params }: { params: { billId: string } }) {
  const billId = Number(params.billId);
  if (!Number.isInteger(billId) || billId <= 0) {
    return NextResponse.json({ message: "Informe um código de título válido." }, { status: 400 });
  }
  try {
    const [bill, installments, budgetCategories, buildingsCost, departmentsCost, attachments] = await Promise.all([
      contasPagarApi.get(billId),
      contasPagarApi.installments(billId),
      contasPagarApi.budgetCategories(billId).catch(() => ({ results: [] })),
      contasPagarApi.buildingsCost(billId).catch(() => ({ results: [] })),
      contasPagarApi.departmentsCost(billId).catch(() => ({ results: [] })),
      contasPagarApi.attachments(billId).catch(() => ({ results: [] }))
    ]);
    return NextResponse.json({ bill, installments: installments.results || [], budgetCategories: budgetCategories.results || [], buildingsCost: buildingsCost.results || [], departmentsCost: departmentsCost.results || [], attachments: attachments.results || [] });
  } catch (error) {
    if (error instanceof SiengeApiError) {
      return NextResponse.json(error.details, { status: error.details.status || 502 });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : "Erro inesperado." }, { status: 500 });
  }
}
