"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEditablePlan, requireEditableTarget } from "@/lib/plans";

const MAX_GOAL = 99;

const addSchema = z.object({
  planId: z.string().min(1),
  accountId: z.string().min(1),
});

export type AddResult =
  | { ok: true; targetId: string; goals: { call: number; evtAtt: number; aemail: number } }
  | { ok: false };

/**
 * Ajoute un PDS du secteur au plan, avec des objectifs pré-remplis :
 * ceux du plan précédent du délégué s'il était déjà ciblé, sinon l'activité réalisée au dernier cycle.
 */
export async function addTarget(input: z.input<typeof addSchema>): Promise<AddResult> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { planId, accountId } = parsed.data;

  try {
    const plan = await requireEditablePlan(planId);

    // Le PDS doit appartenir au secteur du plan : on ne fait pas confiance à l'identifiant reçu.
    const account = await db.account.findFirst({
      where: { id: accountId, brick: { territory: plan.territory } },
      select: { id: true },
    });
    if (!account) return { ok: false };

    const goals = await suggestGoals(plan, accountId);
    const target = await db.target.create({
      data: {
        planId,
        accountId,
        goalCall: goals.call,
        goalEvtAtt: goals.evtAtt,
        goalAemail: goals.aemail,
      },
      select: { id: true },
    });
    // L'éditeur et l'accueil, déjà visités, seront relus au prochain affichage.
    revalidatePath(`/field/plans/${planId}`);
    return { ok: true, targetId: target.id, goals };
  } catch {
    // Dont le cas « déjà dans le plan » (contrainte unique planId + accountId).
    return { ok: false };
  }
}

/** Annule un ajout fait depuis cet écran. */
export async function undoAddTarget(targetId: string): Promise<{ ok: boolean }> {
  if (typeof targetId !== "string" || !targetId) return { ok: false };
  try {
    const { planId, user } = await requireEditableTarget(targetId);
    if (user.role !== "FIELD_USER") return { ok: false };
    await db.target.delete({ where: { id: targetId } });
    revalidatePath(`/field/plans/${planId}`);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

async function suggestGoals(
  plan: { id: string; ownerId: string; cycleStart: Date },
  accountId: string,
) {
  const previous = await db.target.findFirst({
    where: {
      accountId,
      plan: {
        ownerId: plan.ownerId,
        id: { not: plan.id },
        cycle: { endDate: { lt: plan.cycleStart } },
      },
    },
    orderBy: { plan: { cycle: { endDate: "desc" } } },
    select: { goalCall: true, goalEvtAtt: true, goalAemail: true },
  });
  if (previous) {
    return { call: previous.goalCall, evtAtt: previous.goalEvtAtt, aemail: previous.goalAemail };
  }

  const previousCycle = await db.cycle.findFirst({
    where: { endDate: { lt: plan.cycleStart } },
    orderBy: { endDate: "desc" },
    select: { startDate: true, endDate: true },
  });
  if (!previousCycle) return { call: 0, evtAtt: 0, aemail: 0 };

  const rows = await db.activity.groupBy({
    by: ["type"],
    where: {
      accountId,
      date: {
        gte: previousCycle.startDate,
        lt: new Date(previousCycle.endDate.getTime() + 86_400_000),
      },
    },
    _count: { _all: true },
  });
  const count = (type: string) =>
    Math.min(MAX_GOAL, rows.find((r) => r.type === type)?._count._all ?? 0);
  return { call: count("CALL"), evtAtt: count("EVT_ATT"), aemail: count("AEMAIL") };
}
