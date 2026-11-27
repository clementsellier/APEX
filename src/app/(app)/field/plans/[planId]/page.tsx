import { Suspense } from "react";
import { PlanHistory, PlanNotice } from "@/components/plan-status";
import { getOwnPlanForEditor, isEditable, toEditorTargets } from "@/lib/plans";
import { getPlanHistory } from "@/lib/plan-workflow";
import { PlanEditor } from "./plan-editor";

// Écran « update plan » du délégué (maquette slide 14) et envoi en validation.
export default function PlanPage({ params }: PageProps<"/field/plans/[planId]">) {
  return (
    <Suspense>
      <PlanPageContent params={params} />
    </Suspense>
  );
}

async function PlanPageContent({
  params,
}: {
  params: PageProps<"/field/plans/[planId]">["params"];
}) {
  const { planId } = await params;
  const plan = await getOwnPlanForEditor(planId);
  const history = await getPlanHistory(plan.id);
  const targets = toEditorTargets(plan);

  return (
    <div className="flex flex-col gap-10">
      <PlanEditor
        // L'éditeur garde ses cibles dans un état local : on le recrée quand la liste change
        // côté serveur (cibles ajoutées depuis l'écran d'ajout), sinon il afficherait l'ancienne.
        key={targets.map((t) => t.id).join()}
        planId={plan.id}
        planName={plan.name}
        status={plan.status}
        editable={isEditable(plan.status)}
        initialTargets={targets}
        notice={<PlanNotice status={plan.status} history={history} audience="field" />}
      />
      <PlanHistory history={history} />
    </div>
  );
}
