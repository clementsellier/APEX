// Import du référentiel UGA IQVIA : contours (GeoJSON) et rattachement aux secteurs (Excel).
// Module sans "server-only" : il sert aussi au seed (exécuté hors Next.js).

import ExcelJS from "exceljs";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import { topology } from "topojson-server";
import { presimplify, quantile, simplify } from "topojson-simplify";
import type { Prisma, PrismaClient } from "../../generated/prisma/client";

/** Part des sommets conservés : ~10 % suffit à l'échelle d'un secteur (≈ 750 Ko pour la France). */
const KEEP = 0.1;
/** Arrondi des coordonnées : 4 décimales ≈ 10 m. */
const PRECISION = 1e4;
/** Codes UGA : département (2 caractères, 2A/2B pour la Corse) + 3 caractères. */
const UGA_CODE = /^[0-9][0-9AB][0-9A-Z]{3}$/;

export type UgaRow = { code: string; department: string | null; sector: string | null };
export type UgaShapes = Map<string, Geometry>;

export class UgaImportError extends Error {
  constructor(
    public code: "geoInvalid" | "geoNoCode" | "excelInvalid" | "excelNoColumns",
    message?: string,
  ) {
    super(message ?? code);
  }
}

const clean = (v: unknown) => {
  const s = (typeof v === "object" && v !== null && "text" in v ? String(v.text) : String(v ?? ""))
    .trim()
    .toUpperCase();
  return s || null;
};

/**
 * Contours des UGA, simplifiés en préservant les frontières communes (pas de trou ni de
 * chevauchement entre UGA voisines). Le code est lu dans la propriété « UGA » de chaque zone.
 */
export function parseUgaGeoJson(text: string): UgaShapes {
  let geo: FeatureCollection;
  try {
    geo = JSON.parse(text);
  } catch {
    throw new UgaImportError("geoInvalid");
  }
  if (geo?.type !== "FeatureCollection" || !Array.isArray(geo.features)) {
    throw new UgaImportError("geoInvalid");
  }
  const codeOf = (f: Feature) => clean(f.properties?.UGA ?? f.properties?.uga ?? f.id);
  if (!geo.features.some((f) => codeOf(f))) throw new UgaImportError("geoNoCode");

  // Types des bibliothèques topojson trop stricts sur les propriétés : on passe par `object`.
  let topo = topology({ uga: geo }, 1e5) as unknown as Parameters<typeof presimplify>[0];
  topo = presimplify(topo);
  topo = simplify(topo, quantile(topo, KEEP));
  const simplified = feature(topo, topo.objects.uga) as FeatureCollection;

  const shapes: UgaShapes = new Map();
  for (const f of simplified.features) {
    const code = codeOf(f);
    if (!code || !f.geometry || !UGA_CODE.test(code)) continue;
    shapes.set(code, round(f.geometry));
  }
  return shapes;
}

function round(geometry: Geometry): Geometry {
  const r = (c: unknown): unknown =>
    typeof (c as number[])[0] === "number"
      ? (c as number[]).map((n) => Math.round(n * PRECISION) / PRECISION)
      : (c as unknown[]).map(r);
  return "coordinates" in geometry
    ? ({ ...geometry, coordinates: r(geometry.coordinates) } as Geometry)
    : geometry;
}

/** Liste des UGA (1er onglet) : colonnes « UGA », « Département » et « SECTEUR ». */
export async function parseUgaExcel(data: ArrayBuffer): Promise<UgaRow[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(data);
  } catch {
    throw new UgaImportError("excelInvalid");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new UgaImportError("excelInvalid");

  // Repère les colonnes par leur en-tête (accents et casse ignorés).
  const norm = (v: unknown) =>
    (clean(v) ?? "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^A-Z]/g, "");
  const columns: Record<string, number> = {};
  sheet.getRow(1).eachCell((cell, col) => {
    const name = norm(cell.value);
    if (name === "UGA") columns.code = col;
    else if (name.startsWith("DEPARTEMENT")) columns.department = col;
    else if (name === "SECTEUR") columns.sector = col;
  });
  if (!columns.code) throw new UgaImportError("excelNoColumns");

  const rows: UgaRow[] = [];
  sheet.eachRow((row, i) => {
    if (i === 1) return;
    const code = clean(row.getCell(columns.code).value);
    if (!code || !UGA_CODE.test(code)) return;
    rows.push({
      code,
      department: columns.department ? clean(row.getCell(columns.department).value) : null,
      sector: columns.sector ? clean(row.getCell(columns.sector).value) : null,
    });
  });
  return rows;
}

export type UgaImportPlan = {
  created: string[];
  /** UGA dont le secteur change (seulement si la liste Excel est fournie). */
  moved: { code: string; from: string | null; to: string | null }[];
  shapes: number;
  /** UGA de la liste sans contour (seulement si les deux fichiers sont fournis). */
  withoutShape: string[];
  /** UGA dont un plan utilise des comptes et qui changent de secteur. */
  movedWithPlans: string[];
  sectors: { code: string; count: number }[];
  total: number;
};

/** Analyse l'import sans rien écrire : nouvelles UGA, changements de secteur, contours manquants. */
export async function planUgaImport(
  db: PrismaClient,
  { rows, shapes }: { rows?: UgaRow[]; shapes?: UgaShapes },
): Promise<UgaImportPlan> {
  const existing = new Map(
    (await db.brick.findMany({ select: { code: true, territory: true } })).map((b) => [
      b.code,
      b.territory,
    ]),
  );
  const codes = new Set([...(rows?.map((r) => r.code) ?? []), ...(shapes?.keys() ?? [])]);
  const created = [...codes].filter((c) => !existing.has(c)).sort();
  const moved = (rows ?? [])
    .filter((r) => existing.has(r.code) && existing.get(r.code) !== r.sector)
    .map((r) => ({ code: r.code, from: existing.get(r.code) ?? null, to: r.sector }));

  const movedWithPlans = moved.length
    ? (
        await db.brick.findMany({
          where: {
            code: { in: moved.map((m) => m.code) },
            accounts: { some: { targets: { some: {} } } },
          },
          select: { code: true },
        })
      ).map((b) => b.code)
    : [];

  const finalSector = new Map(existing);
  for (const r of rows ?? []) finalSector.set(r.code, r.sector);
  for (const c of codes) if (!finalSector.has(c)) finalSector.set(c, null);
  const bySector = new Map<string, number>();
  for (const s of finalSector.values()) if (s) bySector.set(s, (bySector.get(s) ?? 0) + 1);

  return {
    created,
    moved,
    shapes: shapes?.size ?? 0,
    withoutShape: rows && shapes ? rows.filter((r) => !shapes.has(r.code)).map((r) => r.code) : [],
    movedWithPlans,
    sectors: [...bySector.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    total: finalSector.size,
  };
}

/**
 * Applique l'import : crée les UGA manquantes, met à jour secteur et département (si la liste
 * est fournie) et contours (si le GeoJSON est fourni). Les UGA absentes des fichiers sont gardées.
 */
export async function applyUgaImport(
  db: PrismaClient,
  { rows, shapes }: { rows?: UgaRow[]; shapes?: UgaShapes },
) {
  const byCode = new Map<string, Prisma.BrickUncheckedCreateInput>();
  for (const r of rows ?? []) {
    byCode.set(r.code, { code: r.code, department: r.department, territory: r.sector });
  }
  for (const [code, shape] of shapes ?? []) {
    const entry = byCode.get(code) ?? { code, department: code.slice(0, 2) };
    entry.shape = shape as unknown as Prisma.InputJsonValue;
    byCode.set(code, entry);
  }

  const entries = [...byCode.values()];
  // Par lots, pour ne pas garder une transaction ouverte trop longtemps.
  for (let i = 0; i < entries.length; i += 200) {
    await db.$transaction(
      entries.slice(i, i + 200).map(({ code, ...data }) =>
        db.brick.upsert({
          where: { code },
          create: { code, ...data },
          update: {
            ...(rows && { territory: data.territory ?? null, department: data.department }),
            ...(data.shape !== undefined && { shape: data.shape }),
          },
        }),
      ),
    );
  }
  return entries.length;
}
