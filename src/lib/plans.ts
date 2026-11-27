import "server-only";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/dal";
import type { PlanStatus } from "@/generated/prisma/enums";
import type { EditorTarget } from "@/app/(app)/field/plans/[planId]/plan-editor";

// Statuts dans lesquels le délégué peut modifier son plan directement.
// Le plan en cours (ACTIVE) passera par une demande de modification validée par le manager.
export const EDITABLE_STATUSES: PlanStatus[] = ["IN_CREATION"];

export function isEditable(status: PlanStatus) {
  return EDITABLE_STATUSES.includes(status);
}

// Champs du plan affichés dans l'éditeur (délégué) et l'écran de revue (manager).
const PLAN_VIEW_SELECT = {
  id: true,
  name: true,
  status: true,
  owner: { select: { firstName: true, lastName: true } },
  cycle: { select: { code: true, startDate: true, endDate: true } },
  targets: {
    select: {
      id: true,
      goalCall: true,
      goalEvtAtt: true,
      goalAemail: true,
      account: {
        select: {
          id: true,
          name: true,
          type: true,
          specialty: true,
          workplace: true,
          brickCode: true,
        },
      },
    },
  },
} as const;

type PlanView = NonNullable<Awaited<ReturnType<typeof findPlanView>>>;

function findPlanView(where: { id: string; ownerId?: string; owner?: { managerId: string } }) {
  return db.plan.findFirst({ where, select: PLAN_VIEW_SELECT });
}

function sortTargets(plan: PlanView) {
  plan.targets.sort(
    (a, b) =>
      (a.account.brickCode ?? "").localeCompare(b.account.brickCode ?? "") ||
      a.account.name.localeCompare(b.account.name),
  );
  return plan;
}

/** Plan du délégué connecté avec ses cibles, triées par brick puis par nom. 404 si ce n'est pas le sien. */
export async function getOwnPlanForEditor(planId: string) {
  const user = await requireRole("FIELD_USER");
  const plan = await findPlanView({ id: planId, ownerId: user.id });
  if (!plan) notFound();
  return sortTargets(plan);
}

/** Plan d'un délégué de l'équipe du manager connecté. 404 si le délégué n'est pas dans son équipe. */
export async function getTeamPlanForReview(planId: string) {
  const user = await requireRole("FIELD_MANAGER");
  const plan = await findPlanView({ id: planId, owner: { managerId: user.id } });
  if (!plan) notFound();
  return sortTargets(plan);
}

/**
 * Vérifie qu'une cible appartient à un plan modifiable du délégué connecté.
 * À appeler dans chaque server action : on ne fait jamais confiance aux identifiants reçus du client.
 */
export async function requireEditableTarget(targetId: string) {
  const user = await requireRole("FIELD_USER");
  const target = await db.target.findFirst({
    where: { id: targetId, plan: { ownerId: user.id, status: { in: EDITABLE_STATUSES } } },
    select: { id: true, planId: true },
  });
  if (!target) throw new Error("Target not found or plan not editable");
  return target;
}

/** Plan modifiable du délégué connecté. Lève une erreur sinon (à utiliser dans les server actions). */
export async function requireEditablePlan(planId: string) {
  const user = await requireRole("FIELD_USER");
  const plan = await db.plan.findFirst({
    where: { id: planId, ownerId: user.id, status: { in: EDITABLE_STATUSES } },
    select: { id: true, ownerId: true, territory: true, cycle: { select: { startDate: true } } },
  });
  if (!plan) throw new Error("Plan not found or not editable");
  return {
    id: plan.id,
    ownerId: plan.ownerId,
    territory: plan.territory,
    cycleStart: plan.cycle.startDate,
  };
}

export type Candidate = {
  id: string;
  name: string;
  type: "HCP" | "PHARMACY";
  specialty: string | null;
  workplace: string | null;
  brick: string;
  qualifs: { label: string; value: string; color: string | null }[];
  lastCycle: { call: number; evtAtt: number; aemail: number };
  /** Date de la dernière visite (tous cycles confondus), au format ISO. */
  lastCallDate: string | null;
};

/**
 * Écran « add target » : PDS du secteur du plan qui n'y sont pas encore,
 * avec leurs qualifications et l'activité réalisée sur le cycle précédent.
 * Un plan qui n'est plus modifiable renvoie vers l'éditeur (lecture seule).
 */
export async function getAddTargetData(planId: string) {
  const user = await requireRole("FIELD_USER");

  const plan = await db.plan.findFirst({
    where: { id: planId, ownerId: user.id },
    select: {
      id: true,
      name: true,
      status: true,
      territory: true,
      owner: { select: { team: true } },
      cycle: { select: { startDate: true } },
      targets: { select: { accountId: true } },
    },
  });
  if (!plan) notFound();
  if (!isEditable(plan.status)) redirect(`/field/plans/${plan.id}`);

  // Cycle précédent = le dernier cycle terminé avant le début de celui du plan.
  const previousCycle = await db.cycle.findFirst({
    where: { endDate: { lt: plan.cycle.startDate } },
    orderBy: { endDate: "desc" },
    select: { code: true, startDate: true, endDate: true },
  });

  const accounts = await db.account.findMany({
    where: {
      brick: { territory: plan.territory },
      id: { notIn: plan.targets.map((t) => t.accountId) },
    },
    select: {
      id: true,
      name: true,
      type: true,
      specialty: true,
      workplace: true,
      brickCode: true,
      qualifs: {
        where: plan.owner.team ? { team: plan.owner.team } : undefined,
        select: { label: true, value: true, color: true },
        orderBy: { label: "desc" },
      },
    },
    orderBy: [{ brickCode: "asc" }, { lastName: "asc" }, { name: "asc" }],
  });
  const ids = accounts.map((a) => a.id);

  const [cycleActivity, lastCalls] = await Promise.all([
    previousCycle
      ? db.activity.groupBy({
          by: ["accountId", "type"],
          where: {
            accountId: { in: ids },
            date: { gte: previousCycle.startDate, lte: endOfDay(previousCycle.endDate) },
          },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    db.activity.groupBy({
      by: ["accountId"],
      where: { accountId: { in: ids }, type: "CALL" },
      _max: { date: true },
    }),
  ]);

  const counts = new Map<string, Candidate["lastCycle"]>();
  for (const row of cycleActivity) {
    const c = counts.get(row.accountId) ?? { call: 0, evtAtt: 0, aemail: 0 };
    const key = ({ CALL: "call", EVT_ATT: "evtAtt", AEMAIL: "aemail" } as const)[row.type];
    c[key] = row._count._all;
    counts.set(row.accountId, c);
  }
  const lastCallById = new Map(lastCalls.map((r) => [r.accountId, r._max.date]));

  const candidates: Candidate[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    specialty: a.specialty,
    workplace: a.workplace,
    brick: a.brickCode ?? "—",
    qualifs: a.qualifs,
    lastCycle: counts.get(a.id) ?? { call: 0, evtAtt: 0, aemail: 0 },
    lastCallDate: lastCallById.get(a.id)?.toISOString() ?? null,
  }));

  return {
    plan: { id: plan.id, name: plan.name },
    previousCycle: previousCycle?.code ?? null,
    candidates,
  };
}

function endOfDay(date: Date) {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1);
}

/** Cibles du plan au format attendu par l'éditeur (composant client). */
export function toEditorTargets(plan: PlanView): EditorTarget[] {
  return plan.targets.map((t) => ({
    id: t.id,
    name: t.account.name,
    type: t.account.type,
    specialty: t.account.specialty,
    workplace: t.account.workplace,
    brick: t.account.brickCode ?? "—",
    goalCall: t.goalCall,
    goalEvtAtt: t.goalEvtAtt,
    goalAemail: t.goalAemail,
  }));
}
