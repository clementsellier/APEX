import { Suspense } from "react";
import { PlanReadView } from "@/components/plan-analysis/plan-read-view";

export default function HqPlanPage({ params }: PageProps<"/hq/plans/[planId]">) {
  return (
    <Suspense>
      {params.then(({ planId }) => (
        <PlanReadView planId={planId} base={`/hq/plans/${planId}`} backHref="/hq" />
      ))}
    </Suspense>
  );
}
