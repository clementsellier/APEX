import { PlanEditor } from "@/app/(app)/field/plans/[planId]/plan-editor";
import { PlanHistory } from "@/components/plan-status";
import { getPlanForOverview, toEditorTargets } from "@/lib/plans";
import { getPlanHistory } from "@/lib/plan-workflow";
import { PlanTabs } from "./plan-tabs";

/** Plan en lecture seule (manager d'équipe, siège) : cibles, objectifs, historique. */
export async function PlanReadView({
  planId,
  base,
  backHref,
}: {
  planId: string;
  base: string;
  backHref: string;
}) {
  const plan = await getPlanForOverview(planId);
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
        mode="manager"
        initialTargets={targets}
        backHref={backHref}
        // Pas de bandeau « lecture seule » : ces espaces sont en consultation par nature.
        readOnlyNotice={false}
        panel={<PlanTabs base={base} active="plan" withPlanTab />}
      />
      <PlanHistory history={history} />
    </div>
  );
}
