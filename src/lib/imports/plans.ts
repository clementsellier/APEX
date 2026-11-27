// Import de plans vides ou préconçus : une ligne par cible (ou une ligne sans PDS pour un plan vide).
// Les plans sont créés « en création » ; un plan existant n'est complété que s'il est encore en création.

import type { Column } from "./table";
import { INT, type ImportIssue, type Importer } from "./types";

const columns: Column[] = [
  {
    key: "cycle",
    headers: ["CYCLE"],
    required: true,
    help: "Code du cycle (doit exister).",
    example: "26C2",
  },
  {
    key: "owner",
    headers: ["DELEGUE", "EMAIL_DELEGUE", "FIELD_USER"],
    required: true,
    help: "E-mail du délégué (son secteur donne celui du plan).",
    example: "arnaud@apex.local",
  },
  {
    key: "crmId",
    headers: ["CRM_ID", "ID_CRM", "PDS"],
    help: "Identifiant CRM du PDS ciblé. Vide = plan vide.",
    example: "CRM-A-1003",
  },
  {
    key: "call",
    headers: ["VISITES", "CALL", "GOAL_CALL"],
    help: "Objectif de visites (0 à 99).",
    example: "3",
  },
  {
    key: "evtAtt",
    headers: ["EVENEMENTS", "EVT_ATT", "GOAL_EVTATT"],
    help: "Objectif de participations à des événements (0 à 99).",
    example: "1",
  },
  {
    key: "aemail",
    headers: ["EMAILS", "AEMAIL", "GOAL_AEMAIL"],
    help: "Objectif d'e-mails approuvés (0 à 99).",
    example: "1",
  },
];

type TargetItem = { accountId: string; goalCall: number; goalEvtAtt: number; goalAemail: number };

export type PlanItem = {
  exists: boolean;
  /** Plan existant (en création) à compléter, sinon plan à créer. */
  planId: string | null;
  cycleId: string;
  ownerId: string;
  name: string;
  territory: string;
  targets: TargetItem[];
};

export const plansImporter: Importer<PlanItem> = {
  columns,
  async analyze({ db }, rows) {
    const issues: ImportIssue[] = [];
    const [cycles, users, accounts, plans] = await Promise.all([
      db.cycle.findMany({ select: { id: true, code: true } }),
      db.user.findMany({
        where: { email: { in: [...new Set(rows.map((r) => r.values.owner?.toLowerCase()))] } },
        select: { id: true, email: true, role: true, team: true, primaryTerritory: true },
      }),
      db.account.findMany({
        where: { crmId: { in: rows.map((r) => r.values.crmId).filter(Boolean) } },
        select: { id: true, crmId: true, brick: { select: { territory: true } } },
      }),
      db.plan.findMany({ select: { id: true, ownerId: true, cycleId: true, status: true } }),
    ]);
    const cycleByCode = new Map(cycles.map((c) => [c.code, c.id]));
    const userByEmail = new Map(users.map((u) => [u.email, u]));
    const accountByCrm = new Map(accounts.map((a) => [a.crmId!, a]));
    const planByKey = new Map(plans.map((p) => [`${p.ownerId}|${p.cycleId}`, p]));

    const byPlan = new Map<string, PlanItem>();
    const targetKeys = new Set<string>();
    let kept = 0;

    for (const { line, values: v } of rows) {
      const err = (code: string, value?: string) =>
        issues.push({ line, severity: "error", code, value });
      const cycleCode = v.cycle?.toUpperCase();
      const cycleId = cycleByCode.get(cycleCode);
      if (!cycleId) {
        err("unknownCycle", v.cycle);
        continue;
      }
      const owner = userByEmail.get(v.owner?.toLowerCase());
      if (!owner || owner.role !== "FIELD_USER") {
        err("unknownOwner", v.owner);
        continue;
      }
      if (!owner.primaryTerritory) {
        err("ownerWithoutTerritory", v.owner);
        continue;
      }
      const existing = planByKey.get(`${owner.id}|${cycleId}`);
      if (existing && existing.status !== "IN_CREATION") {
        err("planLocked", `${cycleCode} · ${owner.email}`);
        continue;
      }

      const key = `${owner.id}|${cycleId}`;
      const plan = byPlan.get(key) ?? {
        exists: !!existing,
        planId: existing?.id ?? null,
        cycleId,
        ownerId: owner.id,
        name: `${cycleCode}-${owner.team ?? "APEX"}-${owner.primaryTerritory}`,
        territory: owner.primaryTerritory,
        targets: [],
      };

      if (v.crmId) {
        const account = accountByCrm.get(v.crmId);
        if (!account) {
          err("unknownAccount", v.crmId);
          continue;
        }
        const goals = [v.call, v.evtAtt, v.aemail].map((g) => (g ? g.trim() : "0"));
        if (goals.some((g) => !INT.test(g) || Number(g) > 99)) {
          err("invalidGoal", goals.join(" / "));
          continue;
        }
        if (targetKeys.has(`${key}|${account.id}`)) {
          err("duplicate", v.crmId);
          continue;
        }
        targetKeys.add(`${key}|${account.id}`);
        if (account.brick?.territory !== owner.primaryTerritory) {
          issues.push({ line, severity: "warning", code: "outsideTerritory", value: v.crmId });
        }
        plan.targets.push({
          accountId: account.id,
          goalCall: Number(goals[0]),
          goalEvtAtt: Number(goals[1]),
          goalAemail: Number(goals[2]),
        });
      }
      byPlan.set(key, plan);
      kept++;
    }

    const items = [...byPlan.values()];
    const created = items.filter((p) => !p.exists).length;
    return {
      preview: {
        total: rows.length,
        created,
        updated: items.length - created,
        skipped: rows.length - kept,
        issues: issues.sort((a, b) => a.line - b.line),
      },
      items,
    };
  },

  async apply({ db, adminId }, items) {
    for (const plan of items) {
      await db.$transaction(async (tx) => {
        const planId =
          plan.planId ??
          (
            await tx.plan.create({
              data: {
                name: plan.name,
                territory: plan.territory,
                status: "IN_CREATION",
                ownerId: plan.ownerId,
                cycleId: plan.cycleId,
                events: {
                  create: {
                    actorId: adminId,
                    action: "CREATED",
                    comment: "Importé par l'administrateur",
                  },
                },
              },
              select: { id: true },
            })
          ).id;
        for (const t of plan.targets) {
          await tx.target.upsert({
            where: { planId_accountId: { planId, accountId: t.accountId } },
            create: { planId, ...t },
            update: { goalCall: t.goalCall, goalEvtAtt: t.goalEvtAtt, goalAemail: t.goalAemail },
          });
        }
      });
    }
    return items.length;
  },
};
