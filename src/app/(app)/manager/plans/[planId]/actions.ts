"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { MAX_COMMENT, transitionPlan } from "@/lib/plan-workflow";

const reviewSchema = z.discriminatedUnion("decision", [
  z.object({
    planId: z.string().min(1),
    decision: z.literal("validate"),
    comment: z.string().max(MAX_COMMENT).optional(),
  }),
  z.object({
    planId: z.string().min(1),
    decision: z.literal("return"),
    // Un renvoi doit dire au délégué ce qu'il faut revoir.
    comment: z.string().trim().min(1).max(MAX_COMMENT),
  }),
]);

export type ReviewResult = { ok: boolean };

/** Décision du manager terrain sur un plan envoyé en validation : valider ou renvoyer au délégué. */
export async function reviewPlan(input: z.input<typeof reviewSchema>): Promise<ReviewResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { planId, decision, comment } = parsed.data;

  try {
    const user = await requireRole("FIELD_MANAGER");
    // Seulement les plans des délégués de son équipe.
    const plan = await db.plan.findFirst({
      where: { id: planId, owner: { managerId: user.id } },
      select: { id: true },
    });
    if (!plan) return { ok: false };

    const done = await transitionPlan({
      planId,
      from: "IN_VALIDATION",
      to: decision === "validate" ? "VALIDATED" : "IN_CREATION",
      action: decision === "validate" ? "VALIDATED" : "RETURNED",
      actorId: user.id,
      comment,
    });
    if (!done) return { ok: false };
  } catch {
    return { ok: false };
  }

  revalidatePath("/manager", "layout");
  return { ok: true };
}
