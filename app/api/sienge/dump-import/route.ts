import { NextResponse } from "next/server";
import { getDumpImportStatus, getDumpSqliteInfo, startDumpImport } from "@/lib/sienge-dump-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 3600;

export async function GET() {
  return NextResponse.json({
    job: getDumpImportStatus(),
    sqlite: getDumpSqliteInfo()
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("dump");
    if (!(file instanceof File)) {
      return NextResponse.json({ message: "Selecione um arquivo .dmpc para importar." }, { status: 400 });
    }
    const result = await startDumpImport(file);
    return NextResponse.json(result, { status: result.started ? 202 : 409 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível iniciar a importação do dump.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
