import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
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
  changes: TargetChange[];
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
      changes: true,
      createdAt: true,
      actor: { select: { firstName: true, lastName: true } },
    },
  });
  return events.map((e) => ({
    id: e.id,
    action: e.action,
    actor: `${e.actor.firstName} ${e.actor.lastName}`,
    comment: e.comment,
    changes: Object.values((e.changes as PlanChanges | null) ?? {}).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    date: e.createdAt,
  }));
}

// ─── Modifications du manager ────────────────────────────────────────────────

export type GoalSet = { goalCall: number; goalEvtAtt: number; goalAemail: number };

/** Une cible modifiée : objectifs au moment de l'envoi, et après modification (null = retirée). */
export type TargetChange = { name: string; before: GoalSet; after: GoalSet | null };

/** Modifications regroupées par compte (PDS). */
export type PlanChanges = Record<string, TargetChange>;

type Tx = Prisma.TransactionClient;

/**
 * Verrouille le plan pour la durée de la transaction et renvoie son statut.
 * Deux enregistrements simultanés sur le même plan s'exécutent ainsi l'un après l'autre.
 */
export async function lockPlan(tx: Tx, planId: string): Promise<PlanStatus | null> {
  const rows = await tx.$queryRaw<{ status: PlanStatus }[]>`
    SELECT status FROM "Plan" WHERE id = ${planId} FOR UPDATE`;
  return rows[0]?.status ?? null;
}

function sameGoals(a: GoalSet, b: GoalSet) {
  return (
    a.goalCall === b.goalCall && a.goalEvtAtt === b.goalEvtAtt && a.goalAemail === b.goalAemail
  );
}

/**
 * Inscrit une modification du manager dans l'historique.
 * Toutes les modifications d'une même revue sont regroupées dans un seul événement
 * (le dernier de l'historique, s'il est de ce manager) ; pour chaque cible on garde
 * les objectifs d'origine, et une cible remise à l'identique disparaît du détail.
 */
export async function recordManagerChange(
  tx: Tx,
  {
    planId,
    actorId,
    accountId,
    name,
    before,
    after,
  }: {
    planId: string;
    actorId: string;
    accountId: string;
    name: string;
    before: GoalSet;
    after: GoalSet | null;
  },
) {
  const last = await tx.planEvent.findFirst({
    where: { planId },
    orderBy: { createdAt: "desc" },
    select: { id: true, action: true, actorId: true, changes: true },
  });
  const event = last?.action === "UPDATED_BY_MANAGER" && last.actorId === actorId ? last : null;

  const changes: PlanChanges = { ...((event?.changes as PlanChanges | null) ?? {}) };
  const original = changes[accountId]?.before ?? before;
  if (after && sameGoals(original, after)) delete changes[accountId];
  else changes[accountId] = { name, before: original, after };

  if (Object.keys(changes).length === 0) {
    if (event) await tx.planEvent.delete({ where: { id: event.id } });
  } else if (event) {
    await tx.planEvent.update({
      where: { id: event.id },
      data: { changes, createdAt: new Date() },
    });
  } else {
    await tx.planEvent.create({
      data: { planId, actorId, action: "UPDATED_BY_MANAGER", changes },
    });
  }
}
