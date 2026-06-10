export type Role = "admin" | "financeiro" | "consulta";
export type Permission = "view:dashboard" | "manage:payables" | "manage:receivables" | "view:reports";

const grants: Record<Role, Permission[]> = {
  admin: ["view:dashboard", "manage:payables", "manage:receivables", "view:reports"],
  financeiro: ["view:dashboard", "manage:payables", "manage:receivables", "view:reports"],
  consulta: ["view:dashboard", "view:reports"]
};

export const can = (role: Role, permission: Permission) => grants[role].includes(permission);
