import Link from "next/link";
import { getTranslations } from "next-intl/server";

export type PlanTab = "plan" | "stats" | "map";

/**
 * Onglets d'un plan. `base` = racine des pages du plan pour l'espace courant
 * (ex. « /field/plans/abc » ou « /team/plans/abc »). L'onglet « Plan » n'est affiché
 * que dans les espaces de consultation (manager d'équipe, siège).
 */
export async function PlanTabs({
  base,
  active,
  withPlanTab = false,
}: {
  base: string;
  active: PlanTab;
  withPlanTab?: boolean;
}) {
  const t = await getTranslations("Stats.tabs");
  const tabs: { key: PlanTab; href: string }[] = [
    ...(withPlanTab ? [{ key: "plan" as const, href: base }] : []),
    { key: "stats", href: `${base}/stats` },
    { key: "map", href: `${base}/map` },
  ];
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
