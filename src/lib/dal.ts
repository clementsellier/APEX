import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ROLE_HOME } from "@/lib/roles";
import type { Role } from "@/generated/prisma/enums";

// Couche d'accès aux données (DAL) : toute lecture de session passe par ici.
// Le proxy ne fait qu'une redirection rapide ; la vraie vérification est faite ici,
// au plus près des données, dans chaque layout / page / server action.

export type CurrentUser = {
  id: string;
  name: string;
  firstName: string;
  role: Role;
};

/** Utilisateur connecté, ou redirection vers /login. */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id, name, firstName, role } = session.user;
  return { id, name: name ?? firstName, firstName, role };
});

/** Utilisateur connecté ayant l'un des rôles demandés ; sinon renvoi vers son propre espace. */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!roles.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}
