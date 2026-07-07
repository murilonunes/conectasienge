import { NextResponse } from "next/server";
import { guardPermission } from "@/lib/app-users";
import { formatCurrency } from "@/lib/formatters";
import { loadSupplierQuoteAwards, loadSupplierQuoteResponses, saveSupplierQuoteAwards, type SupplierQuoteAwardInput, type SupplierQuoteAwardScope } from "@/lib/supplier-quote-portal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Valor total da decisão para aplicar a alçada: cotação inteira usa o total da
// proposta vencedora; por item soma os itens escolhidos em cada resposta.
function decisionTotal(quotationId: number, scope: SupplierQuoteAwardScope, awards: SupplierQuoteAwardInput[]) {
  const responses = loadSupplierQuoteResponses(quotationId);
  return awards.reduce((sum, award) => {
    const response = responses.find((current) => current.id === award.responseId);
    if (!response) return sum;
    if (scope === "quotation") return sum + response.totalValue;
    const item = response.items.find((current) => current.itemNumber === award.itemNumber);
    if (!item?.attends) return sum;
    return sum + (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0);
  }, 0);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const quotationId = Number(searchParams.get("quotationId"));

  if (!Number.isFinite(quotationId) || quotationId <= 0) {
    return NextResponse.json({ message: "Informe uma cotação válida." }, { status: 400 });
  }

  return NextResponse.json({ awards: loadSupplierQuoteAwards(quotationId) });
}

export async function POST(request: Request) {
  try {
    const guard = guardPermission(request, "quotations.approve");
    if (!guard.user || guard.status) {
      return NextResponse.json({ message: guard.message }, { status: guard.status || 403 });
    }
    const user = guard.user;

    const input = await request.json() as {
      quotationId?: number;
      scope?: SupplierQuoteAwardScope;
      awards?: SupplierQuoteAwardInput[];
    };
    const quotationId = Number(input.quotationId);

    if (!Number.isFinite(quotationId) || quotationId <= 0) {
      return NextResponse.json({ message: "Informe uma cotação válida." }, { status: 400 });
    }
    if (input.scope !== "quotation" && input.scope !== "item") {
      return NextResponse.json({ message: "Informe se a aprovação é por cotação ou por item." }, { status: 400 });
    }
    if (!input.awards?.length) {
      return NextResponse.json({ message: "Selecione ao menos um fornecedor vencedor." }, { status: 400 });
    }

    // Alçada: quem tem limite não aprova decisão acima dele.
    const total = decisionTotal(quotationId, input.scope, input.awards);
    if (user.approvalLimit !== null && total > user.approvalLimit) {
      return NextResponse.json({
        message: `Sua alçada de aprovação é de ${formatCurrency(user.approvalLimit)} e esta decisão soma ${formatCurrency(total)}. Peça para um aprovador registrar a decisão.`,
        approvalLimit: user.approvalLimit,
        decisionTotal: total
      }, { status: 403 });
    }

    const stamped = input.awards.map((award) => ({ ...award, createdBy: user.name }));
    const awards = saveSupplierQuoteAwards(quotationId, input.scope, stamped);
    return NextResponse.json({ ok: true, awards });
  } catch (error) {
    return NextResponse.json({
      message: error instanceof Error ? error.message : "Não foi possível salvar a aprovação."
    }, { status: 500 });
  }
}
