"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import {
  applyUgaImport,
  parseUgaExcel,
  parseUgaGeoJson,
  planUgaImport,
  UgaImportError,
  type UgaImportPlan,
} from "@/lib/uga/import";

export type ImportResult =
  | { ok: true; plan: UgaImportPlan; applied?: number }
  | { ok: false; error: UgaImportError["code"] | "noFile" | "failed" };

async function readFiles(formData: FormData) {
  const geo = formData.get("geo");
  const list = formData.get("list");
  const hasGeo = geo instanceof File && geo.size > 0;
  const hasList = list instanceof File && list.size > 0;
  return {
    shapes: hasGeo ? parseUgaGeoJson(await geo.text()) : undefined,
    rows: hasList ? await parseUgaExcel(await list.arrayBuffer()) : undefined,
    empty: !hasGeo && !hasList,
  };
}

/**
 * Import du référentiel UGA. `apply` absent : analyse seule (aperçu des changements) ;
 * `apply=1` : écriture en base. Les fichiers sont renvoyés à chaque étape (rien n'est stocké entre les deux).
 */
export async function importUga(formData: FormData): Promise<ImportResult> {
  await requireRole("ADMIN");
  try {
    const { shapes, rows, empty } = await readFiles(formData);
    if (empty) return { ok: false, error: "noFile" };
    const plan = await planUgaImport(db, { rows, shapes });
    if (formData.get("apply") !== "1") return { ok: true, plan };
    const applied = await applyUgaImport(db, { rows, shapes });
    revalidatePath("/", "layout");
    return { ok: true, plan, applied };
  } catch (e) {
    return { ok: false, error: e instanceof UgaImportError ? e.code : "failed" };
  }
}

const changesSchema = z
  .array(
    z.object({
      code: z.string().regex(/^[0-9][0-9AB][0-9A-Z]{3}$/),
      sector: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9_-]{1,20}$/)
        .nullable(),
    }),
  )
  .min(1)
  .max(1000);

/** Enregistre les rattachements UGA → secteur modifiés sur la carte. */
export async function saveSectorisation(
  input: z.input<typeof changesSchema>,
): Promise<{ ok: boolean; saved?: number }> {
  await requireRole("ADMIN");
  const parsed = changesSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  try {
    await db.$transaction(
      parsed.data.map((c) =>
        db.brick.update({ where: { code: c.code }, data: { territory: c.sector } }),
      ),
    );
  } catch {
    return { ok: false };
  }
  revalidatePath("/", "layout");
  return { ok: true, saved: parsed.data.length };
}
