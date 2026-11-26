"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requireEditableTarget } from "@/lib/plans";

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
