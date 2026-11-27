"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useFormatter, useTranslations } from "next-intl";

export type ShareRow = {
  brick: string;
  plan: number;
  market: number | null;
  evolution: number | null;
};

/** Part de la largeur réservée aux barres : le reste accueille la valeur au bout de la plus longue. */
const BAR_ROOM = 85;

// Palette catégorielle validée (slots 1 et 2), clair / sombre.
const PLAN = "bg-[#2a78d6] dark:bg-[#3987e5]";
const MARKET = "bg-[#eb6834] dark:bg-[#d95926]";

/**
 * Poids de chaque brick : part de l'activité du plan vs part du marché du secteur.
 * Barres horizontales groupées, une seule échelle (0 → max des deux séries).
 */
export function ShareChart({ rows }: { rows: ShareRow[] }) {
  const t = useTranslations("Stats.chart");
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...rows.flatMap((r) => [r.plan, r.market ?? 0]));
  const format = useFormatter();
  const pct = (v: number) => format.number(v / 100, { style: "percent", maximumFractionDigits: 0 });

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-4 text-sm text-foreground/70" aria-label={t("legend")}>
        <li className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-sm ${PLAN}`} />
          {t("plan")}
        </li>
        <li className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-sm ${MARKET}`} />
          {t("market")}
        </li>
      </ul>

      <ol className="flex flex-col gap-1">
        {rows.map((r, i) => {
          const gap = r.market === null ? null : r.plan - r.market;
          return (
            <li
              key={r.brick}
              onMouseEnter={() => setHover(r.brick)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(r.brick)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={t("aria", {
                brick: r.brick,
                plan: Math.round(r.plan),
                market: r.market === null ? "—" : Math.round(r.market),
              })}
              className="relative grid grid-cols-[4.5rem_1fr_5.5rem] items-center gap-3 rounded-lg px-2 py-2 outline-none transition-colors hover:bg-foreground/[0.04] focus-visible:bg-foreground/[0.06]"
            >
              <span className="font-mono text-xs text-foreground/70">{r.brick}</span>

              <div className="flex flex-col gap-0.5">
                {[
                  { value: r.plan, color: PLAN },
                  { value: r.market, color: MARKET },
                ].map(({ value, color }, j) => (
                  <div key={j} className="flex h-4 items-center gap-2">
                    {value === null ? (
                      <span className="text-xs text-foreground/40">{t("noData")}</span>
                    ) : (
                      <>
                        <motion.div
                          className={`h-3 rounded-r-[4px] ${color}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${(value / max) * BAR_ROOM}%` }}
                          transition={{ duration: 0.6, delay: i * 0.05, ease: "easeOut" }}
                        />
                        <span className="text-xs whitespace-nowrap text-foreground/70 tabular-nums">
                          {pct(value)}
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <span className="text-right text-xs text-foreground/70 tabular-nums">
                {gap === null
                  ? "—"
                  : `${gap >= 0 ? "▲" : "▼"} ${t("points", { gap: Math.abs(Math.round(gap)) })}`}
              </span>

              {hover === r.brick && (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute top-full right-2 z-10 mt-1 w-64 rounded-lg border border-black/10 bg-surface p-3 text-xs shadow-lg dark:border-white/15"
                >
                  <p className="mb-1.5 font-medium">{t("tooltipTitle", { brick: r.brick })}</p>
                  <p className="flex justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-sm ${PLAN}`} />
                      {t("plan")}
                    </span>
                    <span className="tabular-nums">{pct(r.plan)}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-sm ${MARKET}`} />
                      {t("market")}
                    </span>
                    <span className="tabular-nums">{r.market === null ? "—" : pct(r.market)}</span>
                  </p>
                  {r.evolution !== null && (
                    <p className="mt-1 flex justify-between text-foreground/60">
                      <span>{t("evolution")}</span>
                      <span className="tabular-nums">{Math.round(r.evolution)}</span>
                    </p>
                  )}
                  {gap !== null && Math.abs(gap) >= 5 && (
                    <p className="mt-2 text-foreground/70">
                      {t(gap > 0 ? "over" : "under", { gap: Math.abs(Math.round(gap)) })}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-xs text-foreground/50">{t("gapHint")}</p>
    </div>
  );
}
