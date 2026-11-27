import { Suspense } from "react";
import { PlansOverview } from "@/components/plans-overview/overview";
import { requireRole } from "@/lib/dal";

// Accueil : circuit des plans, chiffres clés et liste filtrable.
export default function TeamHome({ searchParams }: PageProps<"/team">) {
  return (
    <Suspense>
      <TeamHomeContent searchParams={searchParams} />
    </Suspense>
  );
}

async function TeamHomeContent({
  searchParams,
}: {
  searchParams: PageProps<"/team">["searchParams"];
}) {
  const [user, params] = await Promise.all([requireRole("TEAM_MANAGER"), searchParams]);
  return <PlansOverview base="/team" firstName={user.firstName} searchParams={params} />;
}
