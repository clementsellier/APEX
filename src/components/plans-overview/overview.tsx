import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import {
  getPlansOverview,
  STATUS_FILTERS,
  type OverviewFilters as Filters,
} from "@/lib/plans-overview";
import type { PlanStatus } from "@/generated/prisma/enums";
import { OverviewFilters } from "./overview-filters";

const PIPELINE: PlanStatus[] = ["IN_CREATION", "IN_VALIDATION", "VALIDATED", "ACTIVE", "COMPLETED"];

const STATUS_STYLE: Record<PlanStatus, string> = {
  IN_CREATION: "bg-foreground/5 text-foreground/70",
  IN_VALIDATION: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  VALIDATED: "bg-green-500/10 text-green-700 dark:text-green-300",
  ACTIVE: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  COMPLETED: "bg-foreground/5 text-foreground/50",
};

const ACCENTS = [
  "bg-gradient-to-r from-indigo-500 to-sky-500",
  "bg-gradient-to-r from-fuchsia-500 to-pink-500",
  "bg-gradient-to-r from-amber-400 to-orange-500",
];

/**
 * Accueil du manager d'équipe et du siège : circuit des plans, chiffres clés et liste filtrable.
 * `base` = racine de l'espace (« /team » ou « /hq »).
 */
export async function PlansOverview({
  base,
  firstName,
  searchParams,
}: {
  base: string;
  firstName: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const filters: Filters = {
    cycle: one(searchParams.cycle),
    status: one(searchParams.status),
    manager: one(searchParams.manager),
    q: one(searchParams.q),
  };
  const [data, t, format] = await Promise.all([
    getPlansOverview(filters),
    getTranslations(),
    getFormatter(),
  ]);
  const { plans, totals, statusCounts } = data;
  const n = (v: number, digits = 0) => format.number(v, { maximumFractionDigits: digits });
  const maxInteractions = Math.max(1, ...plans.map((p) => p.interactions));
  const showManager = data.managers.length > 1;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("Home.hello", { name: firstName })}
        </h1>
        <p className="mt-2 text-foreground/60">{t(`Overview.scope.${data.scopeLabel}`)}</p>
      </div>

      {/* Circuit des plans (tous statuts, selon les autres filtres) */}
      <section aria-label={t("Overview.pipeline")}>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {PIPELINE.map((s) => (
            <li key={s} className={`rounded-xl px-4 py-3 ${STATUS_STYLE[s]}`}>
              <p className="text-xs">{t(`Plan.status.${s}`)}</p>
              <p className="text-2xl font-semibold tabular-nums">{statusCounts[s] ?? 0}</p>
            </li>
          ))}
        </ol>
      </section>

      <OverviewFilters
        filters={data.filters}
        cycles={data.cycles}
        managers={data.managers}
        statuses={STATUS_FILTERS}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[
          {
            label: t("Overview.tile.targets"),
            value: n(totals.targets),
            sub: t("Overview.tile.plans", { count: plans.length }),
          },
          {
            label: t("Overview.tile.interactions"),
            value: n(totals.interactions),
            sub: t("Overview.tile.calls", { count: totals.call }),
          },
          {
            label: t("Overview.tile.perTarget"),
            value: totals.targets ? n(totals.interactions / totals.targets, 1) : "—",
            sub: t("Overview.tile.perTargetHint"),
          },
        ].map((tile, i) => (
          <div
            key={tile.label}
            className="relative overflow-hidden rounded-xl border bg-surface border-black/10 p-4 dark:border-white/10"
          >
            <div className={`absolute inset-x-0 top-0 h-1 ${ACCENTS[i]}`} />
            <div className="text-sm text-foreground/60">{tile.label}</div>
            <div className="mt-1 text-3xl font-semibold tabular-nums">{tile.value}</div>
            <div className="mt-1 text-xs text-foreground/60">{tile.sub}</div>
          </div>
        ))}
      </section>

      <div className="overflow-x-auto rounded-2xl border bg-surface border-black/10 dark:border-white/10">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-foreground/5 text-foreground/60">
            <tr>
              <th className="px-4 py-3 font-medium">{t("Overview.col.plan")}</th>
              <th className="px-4 py-3 font-medium">{t("Overview.col.owner")}</th>
              {showManager && (
                <th className="px-4 py-3 font-medium">{t("Overview.col.manager")}</th>
              )}
              <th className="px-4 py-3 font-medium">{t("Overview.col.status")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("Overview.col.targets")}</th>
              <th className="w-56 px-4 py-3 font-medium">{t("Overview.col.interactions")}</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr
                key={p.id}
                className="border-t border-black/5 transition-colors hover:bg-foreground/[0.03] dark:border-white/10"
              >
                <td className="px-4 py-3">
                  <Link href={`${base}/plans/${p.id}`} className="font-mono hover:underline">
                    {p.name}
                  </Link>
                  <div className="text-xs text-foreground/60">
                    {p.cycle} · {p.territory}
                  </div>
                </td>
                <td className="px-4 py-3">{p.owner}</td>
                {showManager && (
                  <td className="px-4 py-3 text-foreground/70">{p.manager ?? "—"}</td>
                )}
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[p.status]}`}
                  >
                    {t(`Plan.status.${p.status}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{p.targets}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2" title={t("Overview.goals", p.goals)}>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/5">
                      <div
                        className="h-full rounded-full bg-[#2a78d6] dark:bg-[#3987e5]"
                        style={{ width: `${(p.interactions / maxInteractions) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs tabular-nums">{p.interactions}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`${base}/plans/${p.id}`}
                    className="text-xs text-foreground/60 hover:text-foreground"
                  >
                    {t("Overview.open")} →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {plans.length === 0 && (
          <p className="px-4 py-10 text-center text-foreground/60">{t("Overview.empty")}</p>
        )}
      </div>
    </div>
  );
}
