import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
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

/** Route qui détruit la session puis renvoie vers /login. */
export const SESSION_ENDED_PATH = "/api/session/ended";

/**
 * Utilisateur connecté, relu en base à chaque requête (une seule fois grâce à `cache`).
 * - pas de session → /login
 * - compte supprimé ou désactivé depuis la connexion → session détruite, puis /login
 * Le rôle et le nom viennent de la base, pas du jeton : un changement de rôle s'applique tout de suite.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, firstName: true, lastName: true, role: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") redirect(SESSION_ENDED_PATH);

  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    firstName: user.firstName,
    role: user.role,
  };
});

/** Utilisateur connecté ayant l'un des rôles demandés ; sinon renvoi vers son propre espace. */
export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!roles.includes(user.role)) redirect(ROLE_HOME[user.role]);
  return user;
}
