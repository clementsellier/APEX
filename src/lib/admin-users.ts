import "server-only";
import { randomInt } from "node:crypto";
import { db } from "@/lib/db";

// Règles de gestion des utilisateurs (back-office).
export { MANAGER_ROLE } from "@/lib/roles";

// Sans caractères ambigus (0/O, 1/l/I) : le mot de passe est dicté ou recopié à la main.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Mot de passe provisoire lisible, ex. « Kp7m-x4Rt-9qWz ». */
export function generateTempPassword() {
  const block = () =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${block()}-${block()}-${block()}`;
}

/** Managers possibles pour un rôle donné (utilisateurs actifs du rôle attendu). */
export async function getManagerOptions() {
  const managers = await db.user.findMany({
    where: { role: { in: ["FIELD_MANAGER", "TEAM_MANAGER"] }, status: "ACTIVE" },
    select: { id: true, firstName: true, lastName: true, role: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return managers.map((m) => ({ id: m.id, name: `${m.firstName} ${m.lastName}`, role: m.role }));
}
