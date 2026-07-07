import { NextResponse } from "next/server";
import { operationalPermissionDefinitions, screenPermissionDefinitions } from "@/lib/app-permissions";
import { createAppUser, guardPermission, listAppRoles, listAppUsers, updateAppUser } from "@/lib/app-users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const guard = guardPermission(request, "users.manage");
  if (!guard.user || guard.status) {
    return NextResponse.json({ message: guard.message }, { status: guard.status || 403 });
  }
  return NextResponse.json({ users: listAppUsers(), roles: listAppRoles(), screenPermissions: screenPermissionDefinitions, operationalPermissions: operationalPermissionDefinitions });
}

export async function POST(request: Request) {
  const guard = guardPermission(request, "users.manage");
  if (!guard.user || guard.status) {
    return NextResponse.json({ message: guard.message }, { status: guard.status || 403 });
  }
  try {
    const input = await request.json().catch(() => ({})) as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
      permissions?: string[];
      approvalLimitMode?: "role" | "limited" | "unlimited";
      approvalLimit?: number | null;
    };
    const user = createAppUser({
      name: String(input.name || ""),
      email: String(input.email || ""),
      password: String(input.password || ""),
      role: String(input.role || ""),
      permissions: Array.isArray(input.permissions) ? input.permissions : undefined,
      approvalLimitMode: input.approvalLimitMode,
      approvalLimit: input.approvalLimit
    });
    return NextResponse.json({ ok: true, user, users: listAppUsers() }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Não foi possível criar o usuário." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const guard = guardPermission(request, "users.manage");
  if (!guard.user || guard.status) {
    return NextResponse.json({ message: guard.message }, { status: guard.status || 403 });
  }
  try {
    const input = await request.json().catch(() => ({})) as {
      id?: number;
      name?: string;
      role?: string;
      active?: boolean;
      password?: string;
      permissions?: string[];
      permissionsMode?: "role" | "custom";
      approvalLimitMode?: "role" | "limited" | "unlimited";
      approvalLimit?: number | null;
    };
    const id = Number(input.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ message: "Informe o usuário a atualizar." }, { status: 400 });
    }
    const user = updateAppUser(id, {
      name: typeof input.name === "string" ? input.name : undefined,
      role: typeof input.role === "string" ? input.role : undefined,
      active: typeof input.active === "boolean" ? input.active : undefined,
      password: typeof input.password === "string" && input.password ? input.password : undefined,
      permissions: Array.isArray(input.permissions) ? input.permissions : undefined,
      permissionsMode: input.permissionsMode,
      approvalLimitMode: input.approvalLimitMode,
      approvalLimit: input.approvalLimit
    });
    return NextResponse.json({ ok: true, user, users: listAppUsers() });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Não foi possível atualizar o usuário." }, { status: 400 });
  }
}
