import { NextResponse } from "next/server";
import { getSiengeUpdateJobs, startSiengeUpdateJob } from "@/lib/sienge-update-runner";
import { isUpdateArea } from "@/lib/sienge-update-areas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getSiengeUpdateJobs());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { area?: unknown; force?: unknown };
  const area = isUpdateArea(body.area) ? body.area : "all";
  const force = body.force === true || body.force === "true";
  const result = startSiengeUpdateJob(area, force);
  return NextResponse.json(result, { status: result.started ? 202 : 409 });
}
