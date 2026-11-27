import type { PrismaClient } from "../../generated/prisma/client";
import type { Column, TableRow } from "./table";

/** Anomalie sur une ligne : « error » = ligne ignorée, « warning » = ligne importée avec réserve. */
export type ImportIssue = {
  line: number;
  severity: "error" | "warning";
  /** Code traduit côté écran (Admin.data.issues.*). */
  code: string;
  value?: string;
};

export type ImportPreview = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  issues: ImportIssue[];
};

export type ImportContext = { db: PrismaClient; adminId: string };

/** Un type d'import : colonnes attendues, analyse (sans écrire), puis application. */
export type Importer<T> = {
  columns: Column[];
  analyze: (
    ctx: ImportContext,
    rows: TableRow[],
  ) => Promise<{ preview: ImportPreview; items: T[] }>;
  apply: (ctx: ImportContext, items: T[]) => Promise<number>;
};

export const INT = /^\d+$/;

export function preview(total: number, items: { exists: boolean }[], issues: ImportIssue[]) {
  const created = items.filter((i) => !i.exists).length;
  return {
    total,
    created,
    updated: items.length - created,
    skipped: total - items.length,
    issues: issues.sort((a, b) => a.line - b.line),
  };
}
