import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { ROLES } from "@/lib/roles";
import type { PlanStatus } from "@/generated/prisma/enums";

// Accueil du back-office : chiffres clés et accès aux écrans de gestion.
export default function AdminHome() {
  return (
    <Suspense>
      <AdminHomeContent />
    </Suspense>
  );
}

const PLAN_STATUSES: PlanStatus[] = [
  "IN_CREATION",
  "IN_VALIDATION",
  "VALIDATED",
  "ACTIVE",
  "COMPLETED",
];

async function AdminHomeContent() {
  const user = await requireRole("ADMIN");
  const now = new Date();
  const [t, usersByRole, inactive, plansByStatus, currentCycle, nextCycle] = await Promise.all([
    getTranslations(),
    db.user.groupBy({ by: ["role"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    db.user.count({ where: { status: "INACTIVE" } }),
    db.plan.groupBy({ by: ["status"], _count: { _all: true } }),
    db.cycle.findFirst({
      where: { startDate: { lte: now }, endDate: { gte: now } },
      select: { code: true },
    }),
    db.cycle.findFirst({
      where: { startDate: { gt: now } },
      orderBy: { startDate: "asc" },
      select: { code: true },
    }),
  ]);
  const roleCount = new Map(usersByRole.map((r) => [r.role, r._count._all]));
  const planCount = new Map(plansByStatus.map((p) => [p.status, p._count._all]));
  const activeUsers = usersByRole.reduce((s, r) => s + r._count._all, 0);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("Home.hello", { name: user.firstName })}
      </h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card
          href="/admin/users"
          title={t("Admin.home.users")}
          value={activeUsers}
          sub={t("Admin.home.inactive", { count: inactive })}
          accent="from-indigo-500 to-sky-500"
        >
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {ROLES.map((r) => (
              <li key={r} className="flex justify-between">
                <span className="text-foreground/70">{t(`Roles.${r}`)}</span>
                <span className="tabular-nums">{roleCount.get(r) ?? 0}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          href="/admin/cycles"
          title={t("Admin.home.cycles")}
          value={currentCycle?.code ?? "—"}
          sub={
            nextCycle
              ? t("Admin.home.nextCycle", { code: nextCycle.code })
              : t("Admin.home.noNextCycle")
          }
          accent="from-fuchsia-500 to-orange-400"
        >
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {PLAN_STATUSES.map((s) => (
              <li key={s} className="flex justify-between">
                <span className="text-foreground/70">{t(`Plan.status.${s}`)}</span>
                <span className="tabular-nums">{planCount.get(s) ?? 0}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Card({
  href,
  title,
  value,
  sub,
  accent,
  children,
}: {
  href: string;
  title: string;
  value: string | number;
  sub: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border bg-surface border-black/10 p-6 transition hover:border-black/25 dark:border-white/10 dark:hover:border-white/25"
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-foreground/60">{title}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
          <p className="text-xs text-foreground/60">{sub}</p>
        </div>
        <span aria-hidden className="text-foreground/40 transition group-hover:translate-x-1">
          →
        </span>
      </div>
      {children}
    </Link>
  );
}
