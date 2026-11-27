import { Suspense } from "react";
import { PlanEditor } from "@/app/(app)/field/plans/[planId]/plan-editor";
import { PlanHistory, PlanNotice } from "@/components/plan-status";
import { getTeamPlanForReview, toEditorTargets } from "@/lib/plans";
import { getPlanHistory } from "@/lib/plan-workflow";
import { ReviewPanel } from "./review-panel";

// Revue d'un plan par le manager terrain : lecture du plan, puis validation ou renvoi.
export default function ReviewPage({ params }: PageProps<"/manager/plans/[planId]">) {
  return (
    <Suspense>
      <ReviewContent params={params} />
    </Suspense>
  );
}

async function ReviewContent({
  params,
}: {
  params: PageProps<"/manager/plans/[planId]">["params"];
}) {
  const { planId } = await params;
  const plan = await getTeamPlanForReview(planId);
  const history = await getPlanHistory(plan.id);
  const targets = toEditorTargets(plan);

  return (
    <div className="flex flex-col gap-10">
      <PlanEditor
        key={targets.map((t) => t.id).join()}
        planId={plan.id}
        planName={plan.name}
        ownerName={`${plan.owner.firstName} ${plan.owner.lastName}`}
        status={plan.status}
        editable={false}
        initialTargets={targets}
        backHref="/manager"
        notice={<PlanNotice status={plan.status} history={history} audience="manager" />}
        panel={
          plan.status === "IN_VALIDATION" ? (
            <ReviewPanel planId={plan.id} ownerFirstName={plan.owner.firstName} />
          ) : undefined
        }
      />
      <PlanHistory history={history} />
    </div>
  );
}
