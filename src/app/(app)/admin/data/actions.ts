"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { IMPORTERS, isImportKind } from "@/lib/imports";
import { ImportFileError, readTable } from "@/lib/imports/table";
import type { ImportPreview } from "@/lib/imports/types";

export type ImportResult =
  | { ok: true; preview: ImportPreview; applied?: number }
  | { ok: false; error: ImportFileError["code"] | "noFile" | "failed"; detail?: string };

/**
 * Import d'un fichier. Sans `apply` : analyse seule (aperçu et anomalies, rien n'est écrit).
 * Avec `apply=1` : le fichier est relu, réanalysé, puis les lignes valides sont enregistrées.
 */
export async function runImport(kind: string, formData: FormData): Promise<ImportResult> {
  const admin = await requireRole("ADMIN");
  if (!isImportKind(kind)) return { ok: false, error: "failed" };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "noFile" };

  const importer = IMPORTERS[kind];
  const ctx = { db, adminId: admin.id };
  try {
    const rows = await readTable(
      { name: file.name, data: await file.arrayBuffer() },
      importer.columns,
    );
    const { preview, items } = await importer.analyze(ctx, rows);
    if (formData.get("apply") !== "1") return { ok: true, preview };
    const applied = items.length ? await importer.apply(ctx, items) : 0;
    revalidatePath("/", "layout");
    return { ok: true, preview, applied };
  } catch (e) {
    if (e instanceof ImportFileError) return { ok: false, error: e.code, detail: e.detail };
    console.error(e);
    return { ok: false, error: "failed" };
  }
}
