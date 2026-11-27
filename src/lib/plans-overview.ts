import "server-only";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import { planScopeFor } from "@/lib/plan-access";
import type { Prisma } from "@/generated/prisma/client";
import type { PlanStatus } from "@/generated/prisma/enums";

/** Statuts regroupés sous « validés » (plans engagés : validés, en cours, terminés). */
export const VALIDATED_STATUSES: PlanStatus[] = ["VALIDATED", "ACTIVE", "COMPLETED"];
export const STATUS_FILTERS = ["validated", "all", "IN_CREATION", "IN_VALIDATION"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export type OverviewFilters = {
  cycle?: string;
  status?: string;
  manager?: string;
  q?: string;
};

export type OverviewPlan = {
  id: string;
  name: string;
  status: PlanStatus;
  territory: string;
  cycle: string;
  owner: string;
  manager: string | null;
  targets: number;
  goals: { call: number; evtAtt: number; aemail: number };
  interactions: number;
  updatedAt: Date;
};

/**
 * Vue d'ensemble des plans pour le manager d'équipe (son équipe) et le siège (tous).
 * Les compteurs par statut ignorent le filtre de statut, pour montrer tout le circuit.
 */
export async function getPlansOverview(filters: OverviewFilters) {
  const user = await requireRole("TEAM_MANAGER", "HQ_USER");
  const scope = planScopeFor(user)!;

  const status: StatusFilter = (STATUS_FILTERS as readonly string[]).includes(filters.status ?? "")
    ? (filters.status as StatusFilter)
    : "validated";
  const q = filters.q?.trim();

  const base: Prisma.PlanWhereInput = {
    AND: [
      scope,
      filters.cycle ? { cycle: { code: filters.cycle } } : {},
      filters.manager ? { owner: { managerId: filters.manager } } : {},
      q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { territory: { contains: q, mode: "insensitive" } },
              { owner: { lastName: { contains: q, mode: "insensitive" } } },
              { owner: { firstName: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {},
    ],
  };
  const statusWhere: Prisma.PlanWhereInput =
    status === "all"
      ? {}
      : status === "validated"
        ? { status: { in: VALIDATED_STATUSES } }
        : { status };

  const [plans, byStatus, cycles, managers] = await Promise.all([
    db.plan.findMany({
      where: { AND: [base, statusWhere] },
      select: {
        id: true,
        name: true,
        status: true,
        territory: true,
        updatedAt: true,
        cycle: { select: { code: true } },
        owner: {
          select: {
            firstName: true,
            lastName: true,
            manager: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: [{ cycle: { startDate: "desc" } }, { name: "asc" }],
    }),
    db.plan.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
    db.cycle.findMany({
      where: { plans: { some: scope } },
      select: { code: true },
      orderBy: { startDate: "desc" },
    }),
    db.user.findMany({
      where: { role: "FIELD_MANAGER", reports: { some: { plans: { some: scope } } } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
    }),
  ]);

  // Totaux d'objectifs par plan, en une seule requête.
  const sums = plans.length
    ? await db.target.groupBy({
        by: ["planId"],
        where: { planId: { in: plans.map((p) => p.id) } },
        _sum: { goalCall: true, goalEvtAtt: true, goalAemail: true },
        _count: { _all: true },
      })
    : [];
  const sumByPlan = new Map(sums.map((s) => [s.planId, s]));

  const rows: OverviewPlan[] = plans.map((p) => {
    const s = sumByPlan.get(p.id);
    const goals = {
      call: s?._sum.goalCall ?? 0,
      evtAtt: s?._sum.goalEvtAtt ?? 0,
      aemail: s?._sum.goalAemail ?? 0,
    };
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      territory: p.territory,
      cycle: p.cycle.code,
      owner: `${p.owner.firstName} ${p.owner.lastName}`,
      manager: p.owner.manager ? `${p.owner.manager.firstName} ${p.owner.manager.lastName}` : null,
      targets: s?._count._all ?? 0,
      goals,
      interactions: goals.call + goals.evtAtt + goals.aemail,
      updatedAt: p.updatedAt,
    };
  });

  const totals = rows.reduce(
    (t, r) => ({
      targets: t.targets + r.targets,
      interactions: t.interactions + r.interactions,
      call: t.call + r.goals.call,
    }),
    { targets: 0, interactions: 0, call: 0 },
  );

  return {
    scopeLabel: user.role,
    filters: { cycle: filters.cycle ?? "", status, manager: filters.manager ?? "", q: q ?? "" },
    plans: rows,
    totals,
    statusCounts: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])) as Partial<
      Record<PlanStatus, number>
    >,
    cycles: cycles.map((c) => c.code),
    managers: managers.map((m) => ({ id: m.id, name: `${m.firstName} ${m.lastName}` })),
  };
}
