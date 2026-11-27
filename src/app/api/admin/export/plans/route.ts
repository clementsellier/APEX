import ExcelJS from "exceljs";
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { styleSheet, xlsxResponse } from "@/lib/imports/xlsx";
import { VALIDATED_STATUSES } from "@/lib/plans-overview";
import type { Prisma } from "@/generated/prisma/client";

// Export des plans pour le CRM : une ligne par cible, avec les identifiants CRM.
// Paramètres : ?cycle=26C2 (facultatif), ?status=all pour inclure les plans non validés.
export async function GET(req: NextRequest) {
  await requireRole("ADMIN");
  const cycle = req.nextUrl.searchParams.get("cycle")?.toUpperCase() || null;
  const all = req.nextUrl.searchParams.get("status") === "all";

  const where: Prisma.PlanWhereInput = {
    ...(cycle && { cycle: { code: cycle } }),
    ...(!all && { status: { in: VALIDATED_STATUSES } }),
  };
  const plans = await db.plan.findMany({
    where,
    orderBy: [{ cycle: { startDate: "asc" } }, { name: "asc" }],
    select: {
      name: true,
      crmId: true,
      status: true,
      territory: true,
      cycle: { select: { code: true } },
      owner: { select: { email: true, crmId: true, firstName: true, lastName: true } },
      events: {
        where: { action: "VALIDATED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, actor: { select: { email: true } } },
      },
      targets: {
        orderBy: { account: { name: "asc" } },
        select: {
          goalCall: true,
          goalEvtAtt: true,
          goalAemail: true,
          account: {
            select: { crmId: true, name: true, type: true, specialty: true, brickCode: true },
          },
        },
      },
    },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Cibles");
  sheet.addRow([
    "PLAN",
    "PLAN_CRM_ID",
    "CYCLE",
    "STATUT",
    "SECTEUR",
    "DELEGUE",
    "DELEGUE_EMAIL",
    "DELEGUE_CRM_ID",
    "CRM_ID",
    "PDS",
    "TYPE",
    "SPECIALITE",
    "UGA",
    "VISITES",
    "EVENEMENTS",
    "EMAILS",
    "VALIDE_LE",
    "VALIDE_PAR",
  ]);
  for (const p of plans) {
    const validation = p.events[0];
    for (const t of p.targets) {
      sheet.addRow([
        p.name,
        p.crmId ?? "",
        p.cycle.code,
        p.status,
        p.territory,
        `${p.owner.firstName} ${p.owner.lastName}`,
        p.owner.email,
        p.owner.crmId ?? "",
        t.account.crmId ?? "",
        t.account.name,
        t.account.type,
        t.account.specialty ?? "",
        t.account.brickCode ?? "",
        t.goalCall,
        t.goalEvtAtt,
        t.goalAemail,
        validation?.createdAt ?? "",
        validation?.actor.email ?? "",
      ]);
    }
  }
  sheet.getColumn(17).numFmt = "dd/mm/yyyy hh:mm";
  styleSheet(sheet);

  const date = new Date().toISOString().slice(0, 10);
  const scope = all ? "plans" : "plans-valides";
  return xlsxResponse(workbook, `${scope}${cycle ? `-${cycle}` : ""}-${date}.xlsx`);
}
