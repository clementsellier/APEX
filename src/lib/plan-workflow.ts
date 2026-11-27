import "server-only";
import { db } from "@/lib/db";
import type { PlanAction, PlanStatus } from "@/generated/prisma/enums";

// Circuit de validation d'un plan :
//   IN_CREATION ──(délégué : envoyer)──▶ IN_VALIDATION ──(manager : valider)──▶ VALIDATED
//        ▲                                     │
//        └──────────(manager : renvoyer, avec commentaire)──────────┘

export const MAX_COMMENT = 1000;

/**
 * Change le statut d'un plan et l'inscrit dans son historique, en une seule transaction.
 * Le changement ne s'applique que si le plan est toujours dans le statut attendu
 * (deux clics, deux onglets ou un manager et un délégué en même temps ne peuvent pas se croiser).
 */
export async function transitionPlan({
  planId,
  from,
  to,
  action,
  actorId,
  comment,
}: {
  planId: string;
  from: PlanStatus;
  to: PlanStatus;
  action: PlanAction;
  actorId: string;
  comment?: string | null;
}) {
  return db.$transaction(async (tx) => {
    const { count } = await tx.plan.updateMany({
      where: { id: planId, status: from },
      data: { status: to },
    });
    if (count !== 1) return false;
    await tx.planEvent.create({
      data: { planId, actorId, action, comment: comment?.trim() || null },
    });
    return true;
  });
}

export type HistoryEvent = {
  id: string;
  action: PlanAction;
  actor: string;
  comment: string | null;
  date: Date;
};

/** Historique d'un plan, du plus récent au plus ancien. */
export async function getPlanHistory(planId: string): Promise<HistoryEvent[]> {
  const events = await db.planEvent.findMany({
    where: { planId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      action: true,
      comment: true,
      createdAt: true,
      actor: { select: { firstName: true, lastName: true } },
    },
  });
  return events.map((e) => ({
    id: e.id,
    action: e.action,
    actor: `${e.actor.firstName} ${e.actor.lastName}`,
    comment: e.comment,
    date: e.createdAt,
  }));
}
