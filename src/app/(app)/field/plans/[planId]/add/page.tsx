import { Suspense } from "react";
import { getAddTargetData } from "@/lib/plans";
import { AddTargets } from "./add-targets";

// Écran « add target » du délégué (maquette slide 15).
export default function AddTargetPage({ params }: PageProps<"/field/plans/[planId]/add">) {
  return (
    <Suspense>
      <AddTargetContent params={params} />
    </Suspense>
  );
}

async function AddTargetContent({
  params,
}: {
  params: PageProps<"/field/plans/[planId]/add">["params"];
}) {
  const { planId } = await params;
  const { plan, previousCycle, candidates } = await getAddTargetData(planId);

  return (
    <AddTargets
      planId={plan.id}
      planName={plan.name}
      previousCycle={previousCycle}
      candidates={candidates}
    />
  );
}
