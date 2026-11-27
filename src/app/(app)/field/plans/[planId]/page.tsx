import { Suspense } from "react";
import { getOwnPlanForEditor, isEditable } from "@/lib/plans";
import { PlanEditor, type EditorTarget } from "./plan-editor";

// Écran « update plan » du délégué (maquette slide 14).
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

  const targets: EditorTarget[] = plan.targets.map((t) => ({
    id: t.id,
    name: t.account.name,
    type: t.account.type,
    specialty: t.account.specialty,
    workplace: t.account.workplace,
    brick: t.account.brickCode ?? "—",
    goalCall: t.goalCall,
    goalEvtAtt: t.goalEvtAtt,
    goalAemail: t.goalAemail,
  }));

  return (
    <PlanEditor
      planName={plan.name}
      status={plan.status}
      editable={isEditable(plan.status)}
      initialTargets={targets}
    />
  );
}
