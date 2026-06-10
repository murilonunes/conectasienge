import { NextResponse } from "next/server";
import { getReconciliationProgress } from "@/lib/reconciliation-progress";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") || "default";
  return NextResponse.json(getReconciliationProgress(id));
}
