import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import type { PlanStatus } from "@/generated/prisma/enums";

// Ordre d'affichage : d'abord ce qui attend une décision du manager.
const STATUS_ORDER: PlanStatus[] = [
  "IN_VALIDATION",
  "IN_CREATION",
  "VALIDATED",
  "ACTIVE",
  "COMPLETED",
];

const STATUS_STYLE: Record<PlanStatus, string> = {
  IN_VALIDATION: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  IN_CREATION: "bg-foreground/5 text-foreground/70",
  VALIDATED: "bg-green-500/10 text-green-700 dark:text-green-300",
  ACTIVE: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  COMPLETED: "bg-foreground/5 text-foreground/50",
};

// Accueil du manager terrain : plans de ses délégués avec leur statut.
export default function ManagerHome() {
  return (
    <Suspense>
      <ManagerHomeContent />
    </Suspense>
  );
}

async function ManagerHomeContent() {
  const user = await requireRole("FIELD_MANAGER");
  const t = await getTranslations();

  const plans = await db.plan.findMany({
    where: { owner: { managerId: user.id } },
    select: {
      id: true,
      name: true,
      status: true,
      owner: { select: { firstName: true, lastName: true } },
      _count: { select: { targets: true } },
    },
    orderBy: { name: "asc" },
  });
  plans.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  const toReview = plans.filter((p) => p.status === "IN_VALIDATION").length;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("Home.hello", { name: user.firstName })}
        </h1>
        <p className="mt-2 text-foreground/60">{t("Manager.toReview", { count: toReview })}</p>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-medium">{t("Manager.title")}</h2>
        {plans.length === 0 ? (
          <p className="text-foreground/60">{t("Manager.empty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-foreground/5 text-foreground/60">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("Manager.plan")}</th>
                  <th className="px-4 py-3 font-medium">{t("Manager.owner")}</th>
                  <th className="px-4 py-3 font-medium">{t("Manager.status")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("Manager.targets")}</th>
                  <th className="w-32" />
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-black/5 transition-colors hover:bg-foreground/[0.03] dark:border-white/10"
                  >
                    <td className="px-4 py-3 font-mono">
                      <Link href={`/manager/plans/${p.id}`} className="hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {p.owner.firstName} {p.owner.lastName}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[p.status]}`}
                      >
                        {t(`Plan.status.${p.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{p._count.targets}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/manager/plans/${p.id}`}
                        className={
                          p.status === "IN_VALIDATION"
                            ? "rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background transition hover:opacity-90"
                            : "text-xs text-foreground/60 hover:text-foreground"
                        }
                      >
                        {p.status === "IN_VALIDATION" ? t("Manager.review") : t("Manager.view")} →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
