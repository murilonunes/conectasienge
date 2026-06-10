import { NextResponse } from "next/server";
import { contasPagarApi } from "@/lib/api/financeiro";
import { SiengeApiError } from "@/lib/api/sienge";

export async function PATCH(request: Request, { params }: { params: { billId: string; installmentId: string } }) {
  const billId = Number(params.billId);
  const installmentId = Number(params.installmentId);
  if (!Number.isInteger(billId) || !Number.isInteger(installmentId) || billId <= 0 || installmentId <= 0) {
    return NextResponse.json({ message: "Título ou parcela inválidos." }, { status: 400 });
  }

  try {
    const input = await request.json();
    const paymentTypeId = Number(input.paymentTypeId);
    const keyPixType = String(input.keyPixType || "");
    const keyPix = String(input.keyPix || "").trim();
    const isUsingCreditorData = input.isUsingCreditorData === "S" ? "S" : "N";

    if (!Number.isInteger(paymentTypeId) || paymentTypeId <= 0 || !["C", "E", "T", "A"].includes(keyPixType)) {
      return NextResponse.json({ message: "Informe o tipo de pagamento e o tipo da chave Pix." }, { status: 400 });
    }
    if (isUsingCreditorData === "N" && !keyPix) {
      return NextResponse.json({ message: "Informe a chave Pix ou utilize os dados do credor." }, { status: 400 });
    }

    await contasPagarApi.updatePaymentInformation(billId, installmentId, "pix", {
      paymentTypeId,
      notes: String(input.notes || "Pagamento via Pix").slice(0, 500),
      isUsingCreditorData,
      keyPixType,
      keyPix
    });
    return NextResponse.json({ message: "Instrução de pagamento Pix cadastrada no Sienge." });
  } catch (error) {
    if (error instanceof SiengeApiError) {
      return NextResponse.json(error.details, { status: error.details.status || 502 });
    }
    return NextResponse.json({ message: error instanceof Error ? error.message : "Erro inesperado." }, { status: 500 });
  }
}
