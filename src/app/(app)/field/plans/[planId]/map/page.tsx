import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getPlanMap } from "@/lib/plan-map";
import { PlanTabs } from "../plan-tabs";
import { PlanMap } from "./plan-map";

// Carte du secteur : UGA colorées selon un indicateur du plan, cibles géolocalisées.
export default function PlanMapPage({ params }: PageProps<"/field/plans/[planId]/map">) {
  return (
    <Suspense>
      <PlanMapContent params={params} />
    </Suspense>
  );
}

async function PlanMapContent({
  params,
}: {
  params: PageProps<"/field/plans/[planId]/map">["params"];
}) {
  const { planId } = await params;
  const [{ stats, zones, withoutShape, targets }, t] = await Promise.all([
    getPlanMap(planId),
    getTranslations(),
  ]);
  const { plan } = stats;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href={`/field/plans/${plan.id}`}
          className="text-sm text-foreground/60 hover:text-foreground"
        >
          ← {t("Stats.back")}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{t("Stats.title")}</h1>
        <p className="text-sm text-foreground/60">
          <span className="font-mono">{plan.name}</span> · {t(`Plan.status.${plan.status}`)} ·{" "}
          {t("Map.sector", { code: plan.territory })}
        </p>
      </div>

      <PlanTabs planId={plan.id} active="map" />

      {zones.length === 0 ? (
        <p className="rounded-xl bg-foreground/5 px-4 py-6 text-center text-sm text-foreground/60">
          {t("Map.noShapes")}
        </p>
      ) : (
        <PlanMap
          zones={zones}
          bricks={stats.bricks}
          targets={targets}
          referenceCycle={stats.reference?.cycle ?? null}
        />
      )}
      {withoutShape.length > 0 && (
        <p className="text-xs text-foreground/50">
          {t("Map.withoutShape", { codes: withoutShape.join(", ") })}
        </p>
      )}
    </div>
  );
}
