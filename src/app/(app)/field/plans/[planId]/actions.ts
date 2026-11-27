"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { requireEditableTarget } from "@/lib/plans";
import { MAX_COMMENT, transitionPlan } from "@/lib/plan-workflow";

const MAX_GOAL = 99;

const goalsSchema = z.object({
  targetId: z.string().min(1),
  goalCall: z.int().min(0).max(MAX_GOAL),
  goalEvtAtt: z.int().min(0).max(MAX_GOAL),
  goalAemail: z.int().min(0).max(MAX_GOAL),
});

export type SaveResult = { ok: true } | { ok: false };

export async function saveTargetGoals(input: z.input<typeof goalsSchema>): Promise<SaveResult> {
  const parsed = goalsSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { targetId, ...goals } = parsed.data;

  try {
    await requireEditableTarget(targetId);
    await db.target.update({ where: { id: targetId }, data: goals });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function removeTarget(targetId: string): Promise<SaveResult> {
  if (typeof targetId !== "string" || !targetId) return { ok: false };
  try {
    await requireEditableTarget(targetId);
    await db.target.delete({ where: { id: targetId } });
    return { ok: true };
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
