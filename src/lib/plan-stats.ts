import "server-only";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/dal";
import type { ActivityType, PlanStatus } from "@/generated/prisma/enums";

// Analyse d'un plan (maquette slide 16) : par brick, activité prévue par le plan,
// performance du marché, et activité réellement réalisée sur une période de référence.

/** KPI de brick utilisés pour la performance (libellés dans KpiDefinition). */
const MARKET_KPI = "kpi1"; // ventes : sert à calculer le poids de chaque brick dans le secteur
const EVOLUTION_KPI = "kpi3"; // évolution des ventes vs N-1, en % → indice base 100

/** Poids de chaque canal dans le nombre d'interactions (à ajuster si besoin). */
const INTERACTION_WEIGHTS = { call: 1, evtAtt: 1, aemail: 1 };

export type Activity = { call: number; evtAtt: number; aemail: number };

export type BrickStats = {
  brick: string;
  plan: Activity & {
    interactions: number;
    targets: number;
    perTarget: number | null;
    share: number;
  };
  /** Poids de la brick dans les ventes du secteur (%), et indice d'évolution (base 100). */
  market: { share: number | null; evolution: number | null };
  actual: Activity & { interactions: number; accounts: number; perAccount: number | null };
};

export type PlanStats = {
  plan: { id: string; name: string; status: PlanStatus; owner: string; territory: string };
  /** Période à laquelle le plan est comparé. */
  reference: { kind: "previous" | "current"; cycle: string } | null;
  bricks: BrickStats[];
  total: Omit<BrickStats, "brick" | "market"> & { market: { share: number | null } };
  /** 100 = répartition de l'activité du plan identique au poids marché des bricks. */
  alignment: number | null;
};

function interactions(a: Activity) {
  return (
    a.call * INTERACTION_WEIGHTS.call +
    a.evtAtt * INTERACTION_WEIGHTS.evtAtt +
    a.aemail * INTERACTION_WEIGHTS.aemail
  );
}

const ACTIVITY_KEY: Record<ActivityType, keyof Activity> = {
  CALL: "call",
  EVT_ATT: "evtAtt",
  AEMAIL: "aemail",
};

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

/**
 * Statistiques d'un plan, accessibles à son délégué et à son manager terrain.
 * Référence : le cycle précédent pour un plan en préparation ; le cycle du plan lui-même
 * (réalisé à date) pour un plan en cours ou terminé.
 */
export async function getPlanStats(planId: string): Promise<PlanStats> {
  const user = await getCurrentUser();
  const scope =
    user.role === "FIELD_USER"
      ? { ownerId: user.id }
      : user.role === "FIELD_MANAGER"
        ? { owner: { managerId: user.id } }
        : null;
  if (!scope) notFound();

  const plan = await db.plan.findFirst({
    where: { id: planId, ...scope },
    select: {
      id: true,
      name: true,
      status: true,
      territory: true,
      owner: { select: { firstName: true, lastName: true } },
      cycle: { select: { code: true, startDate: true, endDate: true } },
      targets: {
        select: {
          goalCall: true,
          goalEvtAtt: true,
          goalAemail: true,
          account: { select: { brickCode: true } },
        },
      },
    },
  });
  if (!plan) notFound();

  const inProgress = plan.status === "ACTIVE" || plan.status === "COMPLETED";
  const referenceCycle = inProgress
    ? plan.cycle
    : await db.cycle.findFirst({
        where: { endDate: { lt: plan.cycle.startDate } },
        orderBy: { endDate: "desc" },
        select: { code: true, startDate: true, endDate: true },
      });

  const [bricks, activities] = await Promise.all([
    db.brick.findMany({
      where: { territory: plan.territory },
      select: {
        code: true,
        kpis: {
          where: { kpiKey: { in: [MARKET_KPI, EVOLUTION_KPI] } },
          select: { kpiKey: true, value: true },
        },
      },
    }),
    referenceCycle
      ? db.activity.findMany({
          where: {
            account: { brick: { territory: plan.territory } },
            date: {
              gte: referenceCycle.startDate,
              lt: new Date(referenceCycle.endDate.getTime() + 86_400_000),
            },
          },
          select: { type: true, accountId: true, account: { select: { brickCode: true } } },
        })
      : Promise.resolve([]),
  ]);

  // ─── Agrégation par brick ───
  type Acc = { plan: Activity & { targets: number }; actual: Activity; accounts: Set<string> };
  const byBrick = new Map<string, Acc>();
  const get = (code: string | null) => {
    const key = code ?? "—";
    let acc = byBrick.get(key);
    if (!acc) {
      acc = {
        plan: { call: 0, evtAtt: 0, aemail: 0, targets: 0 },
        actual: { call: 0, evtAtt: 0, aemail: 0 },
        accounts: new Set(),
      };
      byBrick.set(key, acc);
    }
    return acc;
  };
  for (const b of bricks) get(b.code);
  for (const t of plan.targets) {
    const acc = get(t.account.brickCode);
    acc.plan.call += t.goalCall;
    acc.plan.evtAtt += t.goalEvtAtt;
    acc.plan.aemail += t.goalAemail;
    acc.plan.targets += 1;
  }
  for (const a of activities) {
    const acc = get(a.account.brickCode);
    acc.actual[ACTIVITY_KEY[a.type]] += 1;
    acc.accounts.add(a.accountId);
  }

  const kpi = new Map(bricks.map((b) => [b.code, new Map(b.kpis.map((k) => [k.kpiKey, k.value]))]));
  const marketTotal = bricks.reduce((sum, b) => sum + (kpi.get(b.code)?.get(MARKET_KPI) ?? 0), 0);
  const planTotal = [...byBrick.values()].reduce((sum, acc) => sum + interactions(acc.plan), 0);

  const rows: BrickStats[] = [...byBrick.entries()].map(([brick, acc]) => {
    const planInteractions = interactions(acc.plan);
    const actualInteractions = interactions(acc.actual);
    const sales = kpi.get(brick)?.get(MARKET_KPI);
    const evolution = kpi.get(brick)?.get(EVOLUTION_KPI);
    return {
      brick,
      plan: {
        ...pick(acc.plan),
        interactions: planInteractions,
        targets: acc.plan.targets,
        perTarget: ratio(planInteractions, acc.plan.targets),
        share: planTotal > 0 ? (planInteractions / planTotal) * 100 : 0,
      },
      market: {
        share: sales !== undefined && marketTotal > 0 ? (sales / marketTotal) * 100 : null,
        evolution: evolution !== undefined ? 100 + evolution : null,
      },
      actual: {
        ...acc.actual,
        interactions: actualInteractions,
        accounts: acc.accounts.size,
        perAccount: ratio(actualInteractions, acc.accounts.size),
      },
    };
  });
  // Bricks les plus lourdes du marché d'abord, comme sur la maquette.
  rows.sort(
    (a, b) =>
      (b.market.share ?? -1) - (a.market.share ?? -1) || b.plan.interactions - a.plan.interactions,
  );

  const sum = (f: (r: BrickStats) => number) => rows.reduce((s, r) => s + f(r), 0);
  const totalPlan = {
    call: sum((r) => r.plan.call),
    evtAtt: sum((r) => r.plan.evtAtt),
    aemail: sum((r) => r.plan.aemail),
  };
  const totalActual = {
    call: sum((r) => r.actual.call),
    evtAtt: sum((r) => r.actual.evtAtt),
    aemail: sum((r) => r.actual.aemail),
  };
  const targets = sum((r) => r.plan.targets);
  const accounts = new Set(activities.map((a) => a.accountId)).size;

  const withMarket = rows.filter((r) => r.market.share !== null);
  const alignment =
    planTotal > 0 && withMarket.length > 0
      ? Math.max(
          0,
          100 - withMarket.reduce((s, r) => s + Math.abs(r.plan.share - r.market.share!), 0) / 2,
        )
      : null;

  return {
    plan: {
      id: plan.id,
      name: plan.name,
      status: plan.status,
      owner: `${plan.owner.firstName} ${plan.owner.lastName}`,
      territory: plan.territory,
    },
    reference: referenceCycle
      ? { kind: inProgress ? "current" : "previous", cycle: referenceCycle.code }
      : null,
    bricks: rows,
    total: {
      plan: {
        ...totalPlan,
        interactions: planTotal,
        targets,
        perTarget: ratio(planTotal, targets),
        share: 100,
      },
      market: { share: marketTotal > 0 ? 100 : null },
      actual: {
        ...totalActual,
        interactions: interactions(totalActual),
        accounts,
        perAccount: ratio(interactions(totalActual), accounts),
      },
    },
    alignment,
  };
}

function pick({ call, evtAtt, aemail }: Activity): Activity {
  return { call, evtAtt, aemail };
}
