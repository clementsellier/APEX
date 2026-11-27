import { Suspense } from "react";
import { PlanReadView } from "@/components/plan-analysis/plan-read-view";

export default function TeamPlanPage({ params }: PageProps<"/team/plans/[planId]">) {
  return (
    <Suspense>
      {params.then(({ planId }) => (
        <PlanReadView planId={planId} base={`/team/plans/${planId}`} backHref="/team" />
      ))}
    </Suspense>
  );
}
