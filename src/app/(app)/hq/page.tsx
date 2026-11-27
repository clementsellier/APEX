import { Suspense } from "react";
import { PlansOverview } from "@/components/plans-overview/overview";
import { requireRole } from "@/lib/dal";

// Accueil : circuit des plans, chiffres clés et liste filtrable.
export default function HqHome({ searchParams }: PageProps<"/hq">) {
  return (
    <Suspense>
      <HqHomeContent searchParams={searchParams} />
    </Suspense>
  );
}

async function HqHomeContent({ searchParams }: { searchParams: PageProps<"/hq">["searchParams"] }) {
  const [user, params] = await Promise.all([requireRole("HQ_USER"), searchParams]);
  return <PlansOverview base="/hq" firstName={user.firstName} searchParams={params} />;
}
