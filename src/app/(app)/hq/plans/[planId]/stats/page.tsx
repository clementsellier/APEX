import { Suspense } from "react";
import { PlanStatsView } from "@/components/plan-analysis/stats-view";

export default function HqPlanStatsPage({ params }: PageProps<"/hq/plans/[planId]/stats">) {
  return (
    <Suspense>
      {params.then(({ planId }) => (
        <PlanStatsView planId={planId} base={`/hq/plans/${planId}`} backHref="/hq" withPlanTab />
      ))}
    </Suspense>
  );
}
