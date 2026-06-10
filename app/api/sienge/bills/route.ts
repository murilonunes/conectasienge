import { NextResponse } from "next/server";
import { contasPagarApi } from "@/lib/api/financeiro";
import { SiengeApiError } from "@/lib/api/sienge";

const requiredFields = [
  "debtorId", "creditorId", "documentIdentificationId", "documentNumber",
  "issueDate", "baseDate", "billDate", "dueDate", "indexId",
  "installmentsNumber", "totalInvoiceAmount"
] as const;

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const missing = requiredFields.filter((field) => input[field] === undefined || input[field] === "");
    if (missing.length) {
      return NextResponse.json({ message: `Campos obrigatórios ausentes: ${missing.join(", ")}` }, { status: 400 });
    }

    const debtorId = Number(input.debtorId);
    const creditorId = Number(input.creditorId);
    const indexId = Number(input.indexId);
    const installmentsNumber = Number(input.installmentsNumber);
    const totalInvoiceAmount = Number(input.totalInvoiceAmount);
    const discount = Number(input.discount || 0);
    if (![debtorId, creditorId, indexId, installmentsNumber, totalInvoiceAmount, discount].every(Number.isFinite)) {
      return NextResponse.json({ message: "Os códigos, parcelas e valores devem ser números válidos." }, { status: 400 });
    }
    if (debtorId <= 0 || creditorId <= 0 || indexId <= 0 || installmentsNumber < 1 || totalInvoiceAmount <= 0 || discount < 0 || discount > totalInvoiceAmount) {
      return NextResponse.json({ message: "Confira os códigos, a quantidade de parcelas, o valor bruto e o desconto." }, { status: 400 });
    }

    const payload = {
      debtorId,
      creditorId,
      documentIdentificationId: String(input.documentIdentificationId).trim(),
      documentNumber: String(input.documentNumber).trim(),
      issueDate: input.issueDate,
      baseDate: input.baseDate,
      billDate: input.billDate,
      dueDate: input.dueDate,
      indexId,
      installmentsNumber,
      totalInvoiceAmount,
      discount,
      notes: String(input.notes || "").slice(0, 500),
      budgetCategories: []
    };

    await contasPagarApi.create(payload);
    return NextResponse.json({ message: "Título criado com sucesso no Sienge." }, { status: 201 });
  } catch (error) {
    if (error instanceof SiengeApiError) {
      return NextResponse.json(error.details, { status: error.details.status || 502 });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : "Erro inesperado." }, { status: 500 });
  }
}
