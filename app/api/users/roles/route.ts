import { NextResponse } from "next/server";
import { createAppRole, deleteAppRole, guardPermission, listAppRoles, listAppUsers, updateAppRole } from "@/lib/app-users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const guard = guardPermission(request, "users.manage");
  if (!guard.user || guard.status) {
    return NextResponse.json({ message: guard.message }, { status: guard.status || 403 });
  }
  return NextResponse.json({ roles: listAppRoles() });
}

export async function POST(request: Request) {
  const guard = guardPermission(request, "users.manage");
  if (!guard.user || guard.status) {
    return NextResponse.json({ message: guard.message }, { status: guard.status || 403 });
  }
  try {
    const input = await request.json().catch(() => ({})) as { name?: string; permissions?: string[]; approvalLimit?: number | null };
    const roles = createAppRole({
      name: String(input.name || ""),
      permissions: Array.isArray(input.permissions) ? input.permissions : [],
      approvalLimit: input.approvalLimit === undefined || input.approvalLimit === null ? null : Number(input.approvalLimit || 0)
    });
    return NextResponse.json({ ok: true, roles, users: listAppUsers() }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Não foi possível criar o grupo." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const guard = guardPermission(request, "users.manage");
  if (!guard.user || guard.status) {
    return NextResponse.json({ message: guard.message }, { status: guard.status || 403 });
  }
  try {
    const input = await request.json().catch(() => ({})) as { id?: number; name?: string; permissions?: string[]; approvalLimit?: number | null };
    const id = Number(input.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ message: "Informe o grupo a atualizar." }, { status: 400 });
    }
    const roles = updateAppRole(id, {
      name: typeof input.name === "string" ? input.name : undefined,
      permissions: Array.isArray(input.permissions) ? input.permissions : undefined,
      approvalLimit: input.approvalLimit === undefined ? undefined : input.approvalLimit === null ? null : Number(input.approvalLimit || 0)
    });
    return NextResponse.json({ ok: true, roles, users: listAppUsers() });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Não foi possível atualizar o grupo." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const guard = guardPermission(request, "users.manage");
  if (!guard.user || guard.status) {
    return NextResponse.json({ message: guard.message }, { status: guard.status || 403 });
  }
  try {
    const input = await request.json().catch(() => ({})) as { id?: number };
    const id = Number(input.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ message: "Informe o grupo a excluir." }, { status: 400 });
    }
    const roles = deleteAppRole(id);
    return NextResponse.json({ ok: true, roles, users: listAppUsers() });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Não foi possível excluir o grupo." }, { status: 400 });
  }
}
