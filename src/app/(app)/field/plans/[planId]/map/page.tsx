import { Suspense } from "react";
import { PlanMapView } from "@/components/plan-analysis/map-view";

export default function FieldPlanMapPage({ params }: PageProps<"/field/plans/[planId]/map">) {
  return (
    <Suspense>
      {params.then(({ planId }) => (
        <PlanMapView
          planId={planId}
          base={`/field/plans/${planId}`}
          backHref={`/field/plans/${planId}`}
        />
      ))}
    </Suspense>
  );
}
