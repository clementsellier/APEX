// Lecture des fichiers d'import (Excel .xlsx ou CSV) en lignes de valeurs texte.
// Les colonnes sont reconnues par leur en-tête, sans tenir compte des accents, espaces ni casse.

import ExcelJS from "exceljs";

export type Column = {
  key: string;
  /** En-têtes acceptés (le premier sert dans le modèle téléchargeable). */
  headers: string[];
  required?: boolean;
  /** Explication affichée dans l'onglet « Aide » du modèle. */
  help: string;
  example?: string;
};

export type TableRow = { line: number; values: Record<string, string> };

export class ImportFileError extends Error {
  constructor(
    public code: "unreadable" | "empty" | "missingColumns",
    public detail?: string,
  ) {
    super(code);
  }
}

/** « Prénom » → « PRENOM », « crm id » → « CRMID ». */
export function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && value.text !== undefined) return String(value.text);
    if ("result" in value && value.result !== undefined) return String(value.result);
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
    return "";
  }
  return String(value);
}

async function readXlsx(data: ArrayBuffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(data);
  } catch {
    throw new ImportFileError("unreadable");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new ImportFileError("empty");
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, i) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cells[col - 1] = cellText(cell.value).trim();
    });
    rows[i - 1] = cells;
  });
  return Array.from(rows, (r) => r ?? []);
}

/** CSV : séparateur « ; » (Excel français) ou « , », guillemets doublés, UTF-8 ou Windows-1252. */
function readCsv(data: ArrayBuffer): string[][] {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    text = new TextDecoder("windows-1252").decode(data);
  }
  text = text.replace(/^﻿/, "");
  const firstLine = text.slice(0, text.indexOf("\n") === -1 ? undefined : text.indexOf("\n"));
  const sep =
    (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell.trim());
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

/**
 * Lit le fichier et associe chaque colonne connue à sa valeur.
 * Les lignes vides sont ignorées ; `line` est le numéro de ligne dans le fichier (en-tête = 1).
 */
export async function readTable(
  file: { name: string; data: ArrayBuffer },
  columns: Column[],
): Promise<TableRow[]> {
  const raw = file.name.toLowerCase().endsWith(".csv")
    ? readCsv(file.data)
    : await readXlsx(file.data);
  if (raw.length < 2) throw new ImportFileError("empty");

  const header = raw[0].map((h) => normalizeHeader(h ?? ""));
  const index = new Map<string, number>();
  for (const col of columns) {
    const accepted = col.headers.map(normalizeHeader);
    const at = header.findIndex((h) => accepted.includes(h));
    if (at >= 0) index.set(col.key, at);
  }
  const missing = columns.filter((c) => c.required && !index.has(c.key)).map((c) => c.headers[0]);
  if (missing.length) throw new ImportFileError("missingColumns", missing.join(", "));

  const rows: TableRow[] = [];
  raw.slice(1).forEach((cells, i) => {
    if (!cells.some((c) => c && c.trim())) return;
    const values: Record<string, string> = {};
    for (const [key, at] of index) values[key] = (cells[at] ?? "").trim();
    rows.push({ line: i + 2, values });
  });
  if (rows.length === 0) throw new ImportFileError("empty");
  return rows;
}
