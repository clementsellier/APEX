import { Suspense } from "react";
import { PlanStatsView } from "@/components/plan-analysis/stats-view";

export default function TeamPlanStatsPage({ params }: PageProps<"/team/plans/[planId]/stats">) {
  return (
    <Suspense>
      {params.then(({ planId }) => (
        <PlanStatsView
          planId={planId}
          base={`/team/plans/${planId}`}
          backHref="/team"
          withPlanTab
        />
      ))}
    </Suspense>
  );
}
