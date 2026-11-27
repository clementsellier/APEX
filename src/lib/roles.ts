import type { Role } from "@/generated/prisma/enums";

// Espace d'accueil de chaque rôle et préfixes d'URL autorisés.
export const ROLE_HOME: Record<Role, string> = {
  FIELD_USER: "/field",
  FIELD_MANAGER: "/manager",
  TEAM_MANAGER: "/team",
  HQ_USER: "/hq",
  ADMIN: "/admin",
};

const PREFIX_ROLES: { prefix: string; roles: Role[] }[] = [
  { prefix: "/field", roles: ["FIELD_USER"] },
  { prefix: "/manager", roles: ["FIELD_MANAGER"] },
  { prefix: "/team", roles: ["TEAM_MANAGER"] },
  { prefix: "/hq", roles: ["HQ_USER"] },
  { prefix: "/admin", roles: ["ADMIN"] },
];

/** Rôles autorisés pour un chemin, ou `null` si le chemin n'est pas réservé à un rôle. */
export function rolesForPath(pathname: string): Role[] | null {
  const match = PREFIX_ROLES.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return match?.roles ?? null;
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && value in ROLE_HOME;
}

/** Rôle que doit avoir le manager direct de chaque rôle (null = pas de manager). */
export const MANAGER_ROLE: Record<Role, Role | null> = {
  FIELD_USER: "FIELD_MANAGER",
  FIELD_MANAGER: "TEAM_MANAGER",
  TEAM_MANAGER: null,
  HQ_USER: null,
  ADMIN: null,
};

export const ROLES = Object.keys(ROLE_HOME) as Role[];
