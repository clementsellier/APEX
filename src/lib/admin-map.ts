import "server-only";
import type { Feature, FeatureCollection, Geometry, MultiPolygon } from "geojson";
import { merge } from "topojson-client";
import { topology } from "topojson-server";
import { db } from "@/lib/db";

export type AdminZone = {
  code: string;
  department: string | null;
  sector: string | null;
  accounts: number;
  geometry: Geometry;
};
export type SectorInfo = {
  code: string;
  zones: number;
  accounts: number;
  reps: string[];
  /** Contour du secteur (fusion de ses UGA), pour les limites épaisses et l'étiquette. */
  outline: MultiPolygon | null;
};

/** Toutes les UGA avec leur secteur, et les secteurs avec leurs délégués et leur contour. */
export async function getAdminMap() {
  const [bricks, reps] = await Promise.all([
    db.brick.findMany({
      select: {
        code: true,
        department: true,
        territory: true,
        shape: true,
        _count: { select: { accounts: true } },
      },
      orderBy: { code: "asc" },
    }),
    db.user.findMany({
      where: { role: "FIELD_USER", status: "ACTIVE", primaryTerritory: { not: null } },
      select: { firstName: true, lastName: true, primaryTerritory: true },
    }),
  ]);

  const zones: AdminZone[] = bricks
    .filter((b) => b.shape)
    .map((b) => ({
      code: b.code,
      department: b.department,
      sector: b.territory,
      accounts: b._count.accounts,
      geometry: b.shape as unknown as Geometry,
    }));

  // Fusion des UGA par secteur sur une topologie commune : les frontières internes disparaissent.
  const geo: FeatureCollection = {
    type: "FeatureCollection",
    features: zones.map((z): Feature => ({
      type: "Feature",
      geometry: z.geometry,
      properties: { sector: z.sector },
    })),
  };
  const topo = topology({ zones: geo }, 1e5);
  const object = topo.objects.zones as unknown as {
    geometries: { properties: { sector: string | null } }[];
  };

  const sectors = new Map<string, SectorInfo>();
  for (const b of bricks) {
    if (!b.territory) continue;
    const s = sectors.get(b.territory) ?? {
      code: b.territory,
      zones: 0,
      accounts: 0,
      reps: [],
      outline: null,
    };
    s.zones += 1;
    s.accounts += b._count.accounts;
    sectors.set(b.territory, s);
  }
  for (const s of sectors.values()) {
    const parts = object.geometries.filter((g) => g.properties.sector === s.code);
    if (parts.length) {
      s.outline = merge(topo, parts as unknown as Parameters<typeof merge>[1]);
    }
  }
  for (const r of reps) {
    sectors.get(r.primaryTerritory!)?.reps.push(`${r.firstName} ${r.lastName}`);
  }

  return {
    zones,
    sectors: [...sectors.values()].sort((a, b) => a.code.localeCompare(b.code)),
    withoutShape: bricks.filter((b) => !b.shape).length,
    total: bricks.length,
  };
}
