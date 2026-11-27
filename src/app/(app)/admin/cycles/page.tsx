import { Suspense } from "react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { createCycle } from "./actions";
import { CycleForm } from "./cycle-form";

// Cycles : création et liste, du plus récent au plus ancien.
export default function CyclesPage() {
  return (
    <Suspense>
      <CyclesContent />
    </Suspense>
  );
}

const PHASE_STYLE = {
  past: "bg-foreground/5 text-foreground/60",
  current: "bg-green-500/10 text-green-800 dark:text-green-300",
  upcoming: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
};

async function CyclesContent() {
  await requireRole("ADMIN");
  const [cycles, t, format] = await Promise.all([
    db.cycle.findMany({
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        code: true,
        label: true,
        startDate: true,
        endDate: true,
        _count: { select: { plans: true } },
      },
    }),
    getTranslations("Admin.cycles"),
    getFormatter(),
  ]);
  const now = new Date();
  const phase = (c: { startDate: Date; endDate: Date }) =>
    now < c.startDate ? "upcoming" : now > c.endDate ? "past" : "current";
  // Dates stockées à minuit UTC : on les affiche en UTC pour ne pas décaler d'un jour.
  const date = (d: Date) => format.dateTime(d, { dateStyle: "medium", timeZone: "UTC" });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-foreground/60">{t("intro")}</p>
      </div>

      <CycleForm action={createCycle} />

      <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-foreground/5 text-foreground/60">
            <tr>
              <th className="px-4 py-3 font-medium">{t("field.code")}</th>
              <th className="px-4 py-3 font-medium">{t("field.label")}</th>
              <th className="px-4 py-3 font-medium">{t("period")}</th>
              <th className="px-4 py-3 font-medium">{t("phase.label")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("plans")}</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {cycles.map((c) => (
              <tr key={c.id} className="border-t border-black/5 dark:border-white/10">
                <td className="px-4 py-3 font-mono font-medium">{c.code}</td>
                <td className="px-4 py-3 text-foreground/70">{c.label ?? "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {date(c.startDate)} → {date(c.endDate)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${PHASE_STYLE[phase(c)]}`}
                  >
                    {t(`phase.${phase(c)}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{c._count.plans}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/cycles/${c.id}`}
                    className="text-xs text-foreground/60 hover:text-foreground"
                  >
                    {t("edit")} →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {cycles.length === 0 && (
          <p className="px-4 py-10 text-center text-foreground/60">{t("empty")}</p>
        )}
      </div>
    </div>
  );
}
