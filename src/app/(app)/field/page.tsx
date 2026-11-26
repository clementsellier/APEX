import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";

// Accueil du délégué terrain (maquette « écran home field user »).
export default function FieldHome() {
  return (
    <Suspense>
      <FieldHomeContent />
    </Suspense>
  );
}

async function FieldHomeContent() {
  const user = await requireRole("FIELD_USER");
  const t = await getTranslations();

  const plans = await db.plan.findMany({
    where: {
      ownerId: user.id,
      status: { in: ["ACTIVE", "IN_CREATION", "IN_VALIDATION", "VALIDATED"] },
    },
    select: { id: true, name: true, status: true, _count: { select: { targets: true } } },
    orderBy: { cycle: { startDate: "asc" } },
  });
  const current = plans.find((p) => p.status === "ACTIVE");
  const next = plans.find((p) => p.status !== "ACTIVE");

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("Home.hello", { name: user.firstName })}
      </h1>

      <div className="grid gap-6 md:grid-cols-2">
        <PlanCard
          intro={t("Field.currentPlan")}
          empty={t("Field.noCurrentPlan")}
          plan={current}
          actions={[t("Field.checkAndUpdate"), t("Field.statsOverview")]}
          accent="from-indigo-500 to-sky-500"
        />
        <PlanCard
          intro={t("Field.nextPlan")}
          empty={t("Field.noNextPlan")}
          plan={next}
          actions={[t("Field.prepareNext"), t("Field.statsOverview")]}
          accent="from-fuchsia-500 to-orange-400"
        />
      </div>
    </div>
  );
}

async function PlanCard({
  intro,
  empty,
  plan,
  actions,
  accent,
}: {
  intro: string;
  empty: string;
  plan?: { name: string; status: string; _count: { targets: number } };
  actions: string[];
  accent: string;
}) {
  const t = await getTranslations();

  return (
    <section className="relative overflow-hidden rounded-2xl border border-black/10 p-6 dark:border-white/10">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} />
      {plan ? (
        <>
          <p className="text-sm text-foreground/60">{intro}</p>
          <p className="mt-1 font-mono text-xl font-semibold">{plan.name}</p>
          <p className="mt-2 text-sm text-foreground/60">
            {t(`Plan.status.${plan.status as "ACTIVE"}`)} ·{" "}
            {t("Field.targets", { count: plan._count.targets })}
          </p>
          <ul className="mt-6 flex flex-col gap-2">
            {actions.map((label) => (
              <li
                key={label}
                className="flex items-center justify-between rounded-lg bg-foreground/5 px-4 py-3 text-sm"
              >
                <span>› {label}</span>
                <span className="text-xs text-foreground/50">{t("Home.soon")}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-foreground/60">{empty}</p>
      )}
    </section>
  );
}
