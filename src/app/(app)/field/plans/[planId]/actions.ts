"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { requireEditableTarget } from "@/lib/plans";
import { lockPlan, MAX_COMMENT, recordManagerChange, transitionPlan } from "@/lib/plan-workflow";

const MAX_GOAL = 99;

const goalsSchema = z.object({
  targetId: z.string().min(1),
  goalCall: z.int().min(0).max(MAX_GOAL),
  goalEvtAtt: z.int().min(0).max(MAX_GOAL),
  goalAemail: z.int().min(0).max(MAX_GOAL),
});

export type SaveResult = { ok: true } | { ok: false };

const GOAL_FIELDS = { goalCall: true, goalEvtAtt: true, goalAemail: true } as const;

/**
 * Enregistre les objectifs d'une cible. Utilisée par le délégué (plan en création)
 * et par le manager terrain (plan envoyé en validation, modification tracée dans l'historique).
 */
export async function saveTargetGoals(input: z.input<typeof goalsSchema>): Promise<SaveResult> {
  const parsed = goalsSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { targetId, ...goals } = parsed.data;

  try {
    const target = await requireEditableTarget(targetId);
    return await db.$transaction(async (tx) => {
      // Le plan ne doit pas avoir changé de statut entre la vérification et l'écriture.
      if ((await lockPlan(tx, target.planId)) !== target.status) return { ok: false };
      const before = await tx.target.findUniqueOrThrow({
        where: { id: targetId },
        select: GOAL_FIELDS,
      });
      await tx.target.update({ where: { id: targetId }, data: goals });
      if (target.user.role === "FIELD_MANAGER") {
        await recordManagerChange(tx, {
          planId: target.planId,
          actorId: target.user.id,
          accountId: target.accountId,
          name: target.name,
          before,
          after: goals,
        });
      }
      return { ok: true } as const;
    });
  } catch {
    return { ok: false };
  }
}

export async function removeTarget(targetId: string): Promise<SaveResult> {
  if (typeof targetId !== "string" || !targetId) return { ok: false };
  try {
    const target = await requireEditableTarget(targetId);
    return await db.$transaction(async (tx) => {
      if ((await lockPlan(tx, target.planId)) !== target.status) return { ok: false };
      const removed = await tx.target.delete({ where: { id: targetId }, select: GOAL_FIELDS });
      if (target.user.role === "FIELD_MANAGER") {
        await recordManagerChange(tx, {
          planId: target.planId,
          actorId: target.user.id,
          accountId: target.accountId,
          name: target.name,
          before: removed,
          after: null,
        });
      }
      return { ok: true } as const;
    });
  } catch {
    return { ok: false };
  }
}

const submitSchema = z.object({
  planId: z.string().min(1),
  comment: z.string().max(MAX_COMMENT).optional(),
});

export type SubmitResult = { ok: true } | { ok: false; reason: "empty" | "failed" };

/** Envoie le plan au manager terrain : il passe « en validation » et n'est plus modifiable. */
export async function submitPlan(input: z.input<typeof submitSchema>): Promise<SubmitResult> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "failed" };
  const { planId, comment } = parsed.data;

  try {
    const user = await requireRole("FIELD_USER");
    const plan = await db.plan.findFirst({
      where: { id: planId, ownerId: user.id, status: "IN_CREATION" },
      select: { _count: { select: { targets: true } } },
    });
    if (!plan) return { ok: false, reason: "failed" };
    if (plan._count.targets === 0) return { ok: false, reason: "empty" };

    const done = await transitionPlan({
      planId,
      from: "IN_CREATION",
      to: "IN_VALIDATION",
      action: "SUBMITTED",
      actorId: user.id,
      comment,
    });
    if (!done) return { ok: false, reason: "failed" };
  } catch {
    return { ok: false, reason: "failed" };
  }

  revalidatePath("/field", "layout");
  return { ok: true };
}
