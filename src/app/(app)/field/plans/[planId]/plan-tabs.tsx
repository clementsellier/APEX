import Link from "next/link";
import { getTranslations } from "next-intl/server";

/** Onglets de l'analyse d'un plan : tableau de bord ou carte des UGA. */
export async function PlanTabs({ planId, active }: { planId: string; active: "stats" | "map" }) {
  const t = await getTranslations("Stats.tabs");
  const tabs = [
    { key: "stats", href: `/field/plans/${planId}/stats` },
    { key: "map", href: `/field/plans/${planId}/map` },
  ] as const;
  return (
    <nav className="-mt-2 flex w-fit gap-1 rounded-full border border-black/10 p-1 dark:border-white/15">
      {tabs.map(({ key, href }) => (
        <Link
          key={key}
          href={href}
          aria-current={active === key ? "page" : undefined}
          className="rounded-full px-4 py-1.5 text-sm text-foreground/60 transition hover:text-foreground aria-[current=page]:bg-foreground aria-[current=page]:text-background"
        >
          {t(key)}
        </Link>
      ))}
    </nav>
  );
}
