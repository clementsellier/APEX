import type { Prisma } from "@/generated/prisma/client";
import type { CurrentUser } from "@/lib/dal";

/**
 * Plans visibles par un utilisateur, selon son rôle :
 * - délégué : ses propres plans ;
 * - manager terrain : les plans de ses délégués ;
 * - manager d'équipe : les plans des délégués de ses managers terrain ;
 * - siège : tous les plans.
 * `null` = aucun accès aux plans (administrateur).
 */
export function planScopeFor(user: Pick<CurrentUser, "id" | "role">): Prisma.PlanWhereInput | null {
  switch (user.role) {
    case "FIELD_USER":
      return { ownerId: user.id };
    case "FIELD_MANAGER":
      return { owner: { managerId: user.id } };
    case "TEAM_MANAGER":
      return { owner: { manager: { managerId: user.id } } };
    case "HQ_USER":
      return {};
    default:
      return null;
  }
}
