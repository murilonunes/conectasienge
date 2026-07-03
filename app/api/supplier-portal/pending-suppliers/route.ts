import { NextResponse } from "next/server";
import { saveSupplierRegistrationReview, type SupplierRegistrationReviewStatus } from "@/lib/supplier-quote-portal";

export async function POST(request: Request) {
  try {
    const input = await request.json() as {
      document?: string;
      status?: SupplierRegistrationReviewStatus;
      result?: Record<string, unknown>;
    };
    const document = String(input.document || "").replace(/\D/g, "");
    const status = input.status;

    if (!document) {
      return NextResponse.json({ message: "Informe o CPF/CNPJ do fornecedor." }, { status: 400 });
    }
    if (status !== "pending" && status !== "prepared" && status !== "created" && status !== "failed") {
      return NextResponse.json({ message: "Informe um status válido." }, { status: 400 });
    }

    const review = saveSupplierRegistrationReview({ document, status, result: input.result });
    return NextResponse.json({ ok: true, review });
  } catch (error) {
    return NextResponse.json({
      message: error instanceof Error ? error.message : "Não foi possível registrar a revisão."
    }, { status: 500 });
  }
}
