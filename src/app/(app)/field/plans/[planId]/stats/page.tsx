import { Suspense } from "react";
import { PlanStatsView } from "@/components/plan-analysis/stats-view";

export default function FieldPlanStatsPage({ params }: PageProps<"/field/plans/[planId]/stats">) {
  return (
    <Suspense>
      {params.then(({ planId }) => (
        <PlanStatsView
          planId={planId}
          base={`/field/plans/${planId}`}
          backHref={`/field/plans/${planId}`}
        />
      ))}
    </Suspense>
  );
}
