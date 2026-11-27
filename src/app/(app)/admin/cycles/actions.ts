"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { Prisma } from "@/generated/prisma/client";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const cycleSchema = z.object({
  // Convention de nommage des plans : <AA>C<n>, ex. 26C2 = 2026, cycle 2.
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^\d{2}C\d{1,2}$/),
  label: z
    .string()
    .trim()
    .max(100)
    .transform((v) => v || null),
  startDate: z.string().regex(DATE),
  endDate: z.string().regex(DATE),
});

export type CycleField = keyof z.infer<typeof cycleSchema>;
export type CycleError =
  "codeFormat" | "codeTaken" | "date" | "endBeforeStart" | "overlap" | "hasPlans" | "failed";

export type CycleFormState = {
  ok?: boolean;
  errors?: Partial<Record<CycleField | "form", CycleError>>;
  values?: Record<string, string>;
  /** Cycle en conflit (chevauchement), pour le message d'erreur. */
  conflict?: string;
};

// Les dates sont stockées en @db.Date : on travaille en UTC à minuit.
const toDate = (s: string) => new Date(`${s}T00:00:00Z`);

async function save(cycleId: string | null, formData: FormData): Promise<CycleFormState> {
  await requireRole("ADMIN");
  const raw = Object.fromEntries(
    Object.keys(cycleSchema.shape).map((k) => [k, String(formData.get(k) ?? "")]),
  );
  const parsed = cycleSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: CycleFormState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as CycleField;
      errors[field] ??= field === "code" ? "codeFormat" : "date";
    }
    return { errors, values: raw };
  }
  const { code, label } = parsed.data;
  const startDate = toDate(parsed.data.startDate);
  const endDate = toDate(parsed.data.endDate);
  if (endDate <= startDate) return { errors: { endDate: "endBeforeStart" }, values: raw };

  // Deux cycles ne peuvent pas se chevaucher : « le cycle précédent » doit rester sans ambiguïté.
  const overlapping = await db.cycle.findFirst({
    where: {
      startDate: { lte: endDate },
      endDate: { gte: startDate },
      ...(cycleId && { NOT: { id: cycleId } }),
    },
    select: { code: true },
  });
  if (overlapping) {
    return { errors: { startDate: "overlap" }, values: raw, conflict: overlapping.code };
  }

  try {
    const data = { code, label, startDate, endDate };
    if (cycleId) await db.cycle.update({ where: { id: cycleId }, data });
    else await db.cycle.create({ data });
  } catch (e) {
    const taken = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
    return { errors: taken ? { code: "codeTaken" } : { form: "failed" }, values: raw };
  }
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function createCycle(_prev: CycleFormState, formData: FormData) {
  return save(null, formData);
}

export async function updateCycle(cycleId: string, _prev: CycleFormState, formData: FormData) {
  return save(cycleId, formData);
}

/** Suppression d'un cycle sans plan (erreur de saisie). Un cycle utilisé ne se supprime pas. */
export async function deleteCycle(cycleId: string): Promise<CycleFormState> {
  await requireRole("ADMIN");
  const plans = await db.plan.count({ where: { cycleId } });
  if (plans > 0) return { errors: { form: "hasPlans" } };
  try {
    await db.cycle.delete({ where: { id: cycleId } });
  } catch {
    return { errors: { form: "failed" } };
  }
  revalidatePath("/admin", "layout");
  redirect("/admin/cycles");
}
