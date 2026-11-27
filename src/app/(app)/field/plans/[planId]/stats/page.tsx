import { Suspense } from "react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { getPlanStats, type BrickStats } from "@/lib/plan-stats";
import { PlanTabs } from "../plan-tabs";
import { ShareChart } from "./share-chart";

// Analyse d'un plan (maquette slide 16) : activité prévue vs performance du marché
// et activité réalisée, par brick.
export default function PlanStatsPage({ params }: PageProps<"/field/plans/[planId]/stats">) {
  return (
    <Suspense>
      <PlanStatsContent params={params} />
    </Suspense>
  );
}

async function PlanStatsContent({
  params,
}: {
  params: PageProps<"/field/plans/[planId]/stats">["params"];
}) {
  const { planId } = await params;
  const [stats, t, format] = await Promise.all([
    getPlanStats(planId),
    getTranslations(),
    getFormatter(),
  ]);
  const { plan, reference, bricks, total, alignment } = stats;

  const n = (v: number | null, digits = 0) =>
    v === null ? "—" : format.number(v, { maximumFractionDigits: digits });
  const pct = (v: number | null, digits = 1) =>
    v === null ? "—" : format.number(v / 100, { style: "percent", maximumFractionDigits: digits });
  const refCycle = reference?.cycle ?? "—";
  const actualLabel = reference
    ? t(`Stats.actual.${reference.kind}`, { cycle: refCycle })
    : t("Stats.actual.none");
  const evolution =
    reference && total.actual.interactions > 0
      ? ((total.plan.interactions - total.actual.interactions) / total.actual.interactions) * 100
      : null;

  const tiles = [
    {
      label: t("Stats.tile.interactions"),
      value: n(total.plan.interactions),
      sub:
        evolution === null
          ? actualLabel
          : t("Stats.tile.vsActual", {
              sign: evolution >= 0 ? "+" : "−",
              value: n(Math.abs(evolution)),
              cycle: refCycle,
            }),
    },
    {
      label: t("Stats.tile.targets"),
      value: n(total.plan.targets),
      sub: t("Stats.tile.accounts", { count: total.actual.accounts, cycle: refCycle }),
    },
    {
      label: t("Stats.tile.perTarget"),
      value: n(total.plan.perTarget, 1),
      sub: t("Stats.tile.perAccount", { value: n(total.actual.perAccount, 1), cycle: refCycle }),
    },
    {
      label: t("Stats.tile.alignment"),
      value: pct(alignment, 0),
      sub: t("Stats.tile.alignmentHint"),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href={`/field/plans/${plan.id}`}
          className="text-sm text-foreground/60 hover:text-foreground"
        >
          ← {t("Stats.back")}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{t("Stats.title")}</h1>
        <p className="text-sm text-foreground/60">
          <span className="font-mono">{plan.name}</span> · {t(`Plan.status.${plan.status}`)} ·{" "}
          {t("Stats.comparedTo", { label: actualLabel })}
        </p>
      </div>

      <PlanTabs planId={plan.id} active="stats" />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile, i) => (
          <div
            key={tile.label}
            className="relative overflow-hidden rounded-xl border border-black/10 p-4 dark:border-white/10"
          >
            <div className={`absolute inset-x-0 top-0 h-1 ${ACCENTS[i]}`} />
            <div className="text-sm text-foreground/60">{tile.label}</div>
            <div className="mt-1 text-3xl font-semibold tabular-nums">{tile.value}</div>
            <div className="mt-1 text-xs text-foreground/60">{tile.sub}</div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-black/10 p-5 dark:border-white/10">
        <h2 className="font-medium">{t("Stats.chart.title")}</h2>
        <p className="mb-4 text-sm text-foreground/60">{t("Stats.chart.intro")}</p>
        <ShareChart
          rows={bricks.map((b) => ({
            brick: b.brick,
            plan: b.plan.share,
            market: b.market.share,
            evolution: b.market.evolution,
          }))}
        />
      </section>

      <section>
        <h2 className="mb-3 font-medium">{t("Stats.table.title")}</h2>
        <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
          <table className="w-full min-w-[960px] text-right text-sm tabular-nums">
            <thead className="text-foreground/60">
              <tr className="bg-foreground/5 text-xs tracking-wide uppercase">
                <th className="px-3 pt-2.5 pb-1 text-left font-medium" />
                <th
                  colSpan={6}
                  className="border-l border-black/10 px-3 pt-2.5 pb-1 text-center font-medium dark:border-white/10"
                >
                  {t("Stats.table.plan")}
                </th>
                <th
                  colSpan={2}
                  className="border-l border-black/10 px-3 pt-2.5 pb-1 text-center font-medium dark:border-white/10"
                >
                  {t("Stats.table.market")}
                </th>
                <th
                  colSpan={6}
                  className="border-l border-black/10 px-3 pt-2.5 pb-1 text-center font-medium dark:border-white/10"
                >
                  {actualLabel}
                </th>
              </tr>
              <tr className="bg-foreground/5">
                <th className="px-3 pt-1 pb-2.5 whitespace-nowrap text-left font-medium">
                  {t("Stats.table.brick")}
                </th>
                {[...ACTIVITY_COLS, "interactions", "targets", "perTarget"].map((c, i) => (
                  <th
                    key={`p-${c}`}
                    className={`px-3 pt-1 pb-2.5 whitespace-nowrap font-medium ${i === 0 ? SEP : ""}`}
                  >
                    {t(`Stats.col.${c}`)}
                  </th>
                ))}
                <th className={`px-3 pt-1 pb-2.5 whitespace-nowrap font-medium ${SEP}`}>
                  {t("Stats.col.share")}
                </th>
                <th className="px-3 pt-1 pb-2.5 whitespace-nowrap font-medium">
                  {t("Stats.col.evolution")}
                </th>
                {[...ACTIVITY_COLS, "interactions", "accounts", "perAccount"].map((c, i) => (
                  <th
                    key={`a-${c}`}
                    className={`px-3 pt-1 pb-2.5 whitespace-nowrap font-medium ${i === 0 ? SEP : ""}`}
                  >
                    {t(`Stats.col.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bricks.map((b) => (
                <Row key={b.brick} label={b.brick} row={b} n={n} pct={pct} />
              ))}
            </tbody>
            <tfoot>
              <Row
                label={t("Stats.table.total")}
                row={{
                  ...total,
                  brick: "",
                  market: { share: total.market.share, evolution: null },
                }}
                n={n}
                pct={pct}
                strong
              />
            </tfoot>
          </table>
        </div>
        <p className="mt-2 text-xs text-foreground/50">{t("Stats.table.note")}</p>
      </section>
    </div>
  );
}

function Row({
  label,
  row,
  n,
  pct,
  strong,
}: {
  label: string;
  row: BrickStats;
  n: (v: number | null, digits?: number) => string;
  pct: (v: number | null) => string;
  strong?: boolean;
}) {
  const cell = "px-3 py-2.5";
  return (
    <tr
      className={`border-t border-black/5 dark:border-white/10 ${strong ? "bg-foreground/5 font-semibold" : ""}`}
    >
      <td className={`${cell} text-left font-mono text-xs ${strong ? "font-sans text-sm" : ""}`}>
        {label}
      </td>
      <td className={`${cell} ${SEP}`}>{n(row.plan.call)}</td>
      <td className={cell}>{n(row.plan.evtAtt)}</td>
      <td className={cell}>{n(row.plan.aemail)}</td>
      <td className={`${cell} font-medium`}>{n(row.plan.interactions)}</td>
      <td className={cell}>{n(row.plan.targets)}</td>
      <td className={cell}>{n(row.plan.perTarget, 1)}</td>
      <td className={`${cell} ${SEP}`}>{pct(row.market.share)}</td>
      <td className={cell}>{n(row.market.evolution)}</td>
      <td className={`${cell} ${SEP}`}>{n(row.actual.call)}</td>
      <td className={cell}>{n(row.actual.evtAtt)}</td>
      <td className={cell}>{n(row.actual.aemail)}</td>
      <td className={`${cell} font-medium`}>{n(row.actual.interactions)}</td>
      <td className={cell}>{n(row.actual.accounts)}</td>
      <td className={cell}>{n(row.actual.perAccount, 1)}</td>
    </tr>
  );
}

const ACTIVITY_COLS = ["call", "evtAtt", "aemail"];
const SEP = "border-l border-black/10 dark:border-white/10";

const ACCENTS = [
  "bg-gradient-to-r from-indigo-500 to-sky-500",
  "bg-gradient-to-r from-fuchsia-500 to-pink-500",
  "bg-gradient-to-r from-amber-400 to-orange-500",
  "bg-gradient-to-r from-emerald-400 to-teal-500",
];
