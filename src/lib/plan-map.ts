import "server-only";
import type { Geometry } from "geojson";
import { db } from "@/lib/db";
import { getPlanStats } from "@/lib/plan-stats";

export type MapTarget = {
  id: string;
  name: string;
  specialty: string | null;
  brick: string | null;
  goals: { call: number; evtAtt: number; aemail: number };
  lng: number | null;
  lat: number | null;
};

/**
 * Carte d'un plan : statistiques par UGA (mêmes règles d'accès que l'analyse),
 * contours des UGA du secteur et cibles géolocalisées.
 */
export async function getPlanMap(planId: string) {
  const stats = await getPlanStats(planId);
  const [bricks, targets] = await Promise.all([
    db.brick.findMany({
      where: { territory: stats.plan.territory },
      select: { code: true, department: true, shape: true },
      orderBy: { code: "asc" },
    }),
    db.target.findMany({
      where: { planId: stats.plan.id },
      select: {
        id: true,
        goalCall: true,
        goalEvtAtt: true,
        goalAemail: true,
        account: {
          select: {
            name: true,
            specialty: true,
            brickCode: true,
            addresses: {
              where: { isPrimary: true },
              select: { latitude: true, longitude: true },
              take: 1,
            },
          },
        },
      },
    }),
  ]);

  return {
    stats,
    zones: bricks
      .filter((b) => b.shape)
      .map((b) => ({
        code: b.code,
        department: b.department,
        geometry: b.shape as unknown as Geometry,
      })),
    withoutShape: bricks.filter((b) => !b.shape).map((b) => b.code),
    targets: targets
      .map((t): MapTarget => ({
        id: t.id,
        name: t.account.name,
        specialty: t.account.specialty,
        brick: t.account.brickCode,
        goals: { call: t.goalCall, evtAtt: t.goalEvtAtt, aemail: t.goalAemail },
        lng: t.account.addresses[0]?.longitude ?? null,
        lat: t.account.addresses[0]?.latitude ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
