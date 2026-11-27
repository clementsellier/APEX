import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getPlanMap } from "@/lib/plan-map";
import { PlanMap } from "./plan-map";
import { PlanTabs } from "./plan-tabs";

// Carte du secteur : UGA colorées selon un indicateur du plan, cibles géolocalisées.
// Partagée entre les espaces délégué, manager d'équipe et siège.
export async function PlanMapView({
  planId,
  base,
  backHref,
  withPlanTab = false,
}: {
  planId: string;
  base: string;
  backHref: string;
  withPlanTab?: boolean;
}) {
  const [{ stats, zones, withoutShape, targets }, t] = await Promise.all([
    getPlanMap(planId),
    getTranslations(),
  ]);
  const { plan } = stats;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href={backHref} className="text-sm text-foreground/60 hover:text-foreground">
          ← {t(withPlanTab ? "Stats.backToList" : "Stats.back")}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{t("Stats.title")}</h1>
        <p className="text-sm text-foreground/60">
          <span className="font-mono">{plan.name}</span> · {t(`Plan.status.${plan.status}`)} ·{" "}
          {withPlanTab && <>{plan.owner} · </>}
          {t("Map.sector", { code: plan.territory })}
        </p>
      </div>

      <PlanTabs base={base} active="map" withPlanTab={withPlanTab} />

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
