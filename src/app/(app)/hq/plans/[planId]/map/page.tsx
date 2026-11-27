import { Suspense } from "react";
import { PlanMapView } from "@/components/plan-analysis/map-view";

export default function HqPlanMapPage({ params }: PageProps<"/hq/plans/[planId]/map">) {
  return (
    <Suspense>
      {params.then(({ planId }) => (
        <PlanMapView planId={planId} base={`/hq/plans/${planId}`} backHref="/hq" withPlanTab />
      ))}
    </Suspense>
  );
}
