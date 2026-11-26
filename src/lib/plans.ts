import "server-only";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import type { PlanStatus } from "@/generated/prisma/enums";

// Statuts dans lesquels le délégué peut modifier son plan directement.
// Le plan en cours (ACTIVE) passera par une demande de modification validée par le manager.
export const EDITABLE_STATUSES: PlanStatus[] = ["IN_CREATION"];

export function isEditable(status: PlanStatus) {
  return EDITABLE_STATUSES.includes(status);
}

/** Plan du délégué connecté avec ses cibles, triées par brick puis par nom. 404 si ce n'est pas le sien. */
export async function getOwnPlanForEditor(planId: string) {
  const user = await requireRole("FIELD_USER");

  const plan = await db.plan.findFirst({
    where: { id: planId, ownerId: user.id },
    select: {
      id: true,
      name: true,
      status: true,
      cycle: { select: { code: true, startDate: true, endDate: true } },
      targets: {
        select: {
          id: true,
          goalCall: true,
          goalEvtAtt: true,
          goalAemail: true,
          account: {
            select: {
              id: true,
              name: true,
              type: true,
              specialty: true,
              workplace: true,
              brickCode: true,
            },
          },
        },
      },
    },
  });
  if (!plan) notFound();

  plan.targets.sort(
    (a, b) =>
      (a.account.brickCode ?? "").localeCompare(b.account.brickCode ?? "") ||
      a.account.name.localeCompare(b.account.name),
  );
  return plan;
}

/**
 * Vérifie qu'une cible appartient à un plan modifiable du délégué connecté.
 * À appeler dans chaque server action : on ne fait jamais confiance aux identifiants reçus du client.
 */
export async function requireEditableTarget(targetId: string) {
  const user = await requireRole("FIELD_USER");
  const target = await db.target.findFirst({
    where: { id: targetId, plan: { ownerId: user.id, status: { in: EDITABLE_STATUSES } } },
    select: { id: true, planId: true },
  });
  if (!target) throw new Error("Target not found or plan not editable");
  return target;
}
