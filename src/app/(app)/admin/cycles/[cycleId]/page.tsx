import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { updateCycle } from "../actions";
import { CycleForm } from "../cycle-form";

export default function EditCyclePage({ params }: PageProps<"/admin/cycles/[cycleId]">) {
  return (
    <Suspense>
      <EditCycleContent params={params} />
    </Suspense>
  );
}

async function EditCycleContent({
  params,
}: {
  params: PageProps<"/admin/cycles/[cycleId]">["params"];
}) {
  await requireRole("ADMIN");
  const { cycleId } = await params;
  const [cycle, t] = await Promise.all([
    db.cycle.findUnique({
      where: { id: cycleId },
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
  ]);
  if (!cycle) notFound();

  const iso = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/cycles" className="text-sm text-foreground/60 hover:text-foreground">
          ← {t("back")}
        </Link>
        <h1 className="mt-1 font-mono text-2xl font-semibold">{cycle.code}</h1>
        <p className="text-sm text-foreground/60">{t("usedBy", { count: cycle._count.plans })}</p>
      </div>
      {cycle._count.plans > 0 && (
        <p className="max-w-3xl rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          {t("inUseWarning")}
        </p>
      )}
      <CycleForm
        action={updateCycle.bind(null, cycle.id)}
        cycleId={cycle.id}
        planCount={cycle._count.plans}
        initial={{
          code: cycle.code,
          label: cycle.label ?? "",
          startDate: iso(cycle.startDate),
          endDate: iso(cycle.endDate),
        }}
      />
    </div>
  );
}
