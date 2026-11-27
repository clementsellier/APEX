import { Suspense } from "react";
import { PlanMapView } from "@/components/plan-analysis/map-view";

export default function TeamPlanMapPage({ params }: PageProps<"/team/plans/[planId]/map">) {
  return (
    <Suspense>
      {params.then(({ planId }) => (
        <PlanMapView planId={planId} base={`/team/plans/${planId}`} backHref="/team" withPlanTab />
      ))}
    </Suspense>
  );
}
