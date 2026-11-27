"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { Geometry } from "geojson";
import { labelPoint } from "@/components/map/geo";
import { diverging, NO_DATA, sequential, type Scale } from "@/components/map/scales";
import { UgaMap, type MapZone } from "@/components/map/uga-map";
import type { MapTarget } from "@/lib/plan-map";
import type { BrickStats } from "@/lib/plan-stats";

type Indicator = "gap" | "market" | "evolution" | "interactions";
type View = "focus" | "all" | "france";
const VIEWS: View[] = ["focus", "all", "france"];
const INDICATORS: Indicator[] = ["gap", "market", "evolution", "interactions"];

function useIsDark() {
  return useSyncExternalStore(
    (cb) => {
      const o = new MutationObserver(cb);
      o.observe(document.documentElement, { attributeFilter: ["data-theme"] });
      return () => o.disconnect();
    },
    () => {
      const t = document.documentElement.getAttribute("data-theme");
      return (
        t === "dark" || (t !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches)
      );
    },
    () => false,
  );
}

export function PlanMap({
  zones,
  bricks,
  targets,
  referenceCycle,
}: {
  zones: { code: string; department: string | null; geometry: Geometry }[];
  bricks: BrickStats[];
  targets: MapTarget[];
  referenceCycle: string | null;
}) {
  const t = useTranslations("Map");
  const format = useFormatter();
  const theme = useIsDark() ? "dark" : "light";
  const [indicator, setIndicator] = useState<Indicator>("gap");
  const [selected, setSelected] = useState<string | null>(null);
  // Cadrage : les UGA où se joue le plan (cibles ou données marché), ou tout le secteur.
  const [view, setView] = useState<View>("focus");
  // Reste de la France : chargé seulement quand on choisit cette vue.
  const [france, setFrance] = useState<{ code: string; geometry: Geometry }[] | null>(null);
  const [franceState, setFranceState] = useState<"idle" | "loading" | "failed">("idle");

  const byBrick = useMemo(() => new Map(bricks.map((b) => [b.brick, b])), [bricks]);
  const pct = (v: number) => format.number(v / 100, { style: "percent", maximumFractionDigits: 0 });
  const num = (v: number) => format.number(v, { maximumFractionDigits: 0 });
  const signed = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${num(Math.abs(v))} pts`;

  const valueOf = (code: string): number | null => {
    const b = byBrick.get(code);
    if (!b) return null;
    if (indicator === "gap") return b.market.share === null ? null : b.plan.share - b.market.share;
    if (indicator === "market") return b.market.share;
    if (indicator === "evolution") return b.market.evolution;
    return b.plan.interactions;
  };

  const scale: Scale = useMemo(() => {
    const max = (f: (b: BrickStats) => number | null) =>
      Math.max(0, ...bricks.map((b) => f(b) ?? 0));
    if (indicator === "gap")
      return diverging(theme, { mid: 0, small: 3, large: 10, format: signed });
    if (indicator === "evolution")
      return diverging(theme, { mid: 100, small: 1, large: 5, format: num });
    if (indicator === "market")
      return sequential(
        theme,
        max((b) => b.market.share),
        pct,
      );
    return sequential(
      theme,
      max((b) => b.plan.interactions),
      num,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicator, theme, bricks]);

  const mapZones: MapZone[] = useMemo(
    () =>
      zones.map((z) => ({
        code: z.code,
        geometry: z.geometry,
        fill: scale.color(valueOf(z.code)),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zones, scale],
  );
  // Étiquettes seulement sur les UGA utiles (cibles ou données marché) : les autres
  // gardent leur code dans l'infobulle, sans encombrer la carte.
  const labels = useMemo(
    () =>
      zones.flatMap((z) => {
        const b = byBrick.get(z.code);
        if (!b || (b.plan.targets === 0 && b.market.share === null)) return [];
        const p = labelPoint(z.geometry);
        return p ? [{ id: z.code, lng: p[0], lat: p[1], text: z.code }] : [];
      }),
    [zones, byBrick],
  );
  const focusZones = useMemo(() => {
    const codes = new Set(labels.map((l) => l.id));
    return zones.filter((z) => codes.has(z.code));
  }, [labels, zones]);
  const sectorCodes = useMemo(() => new Set(zones.map((z) => z.code)), [zones]);
  const context = useMemo(
    () => (view === "france" && france ? france.filter((z) => !sectorCodes.has(z.code)) : []),
    [view, france, sectorCodes],
  );
  const focus =
    view === "france" && france
      ? { key: "france", zones: france }
      : view === "focus" && focusZones.length
        ? { key: "focus", zones: focusZones }
        : { key: "all", zones: [] };

  async function chooseView(next: View) {
    setView(next);
    if (next !== "france" || france) return;
    setFranceState("loading");
    try {
      const res = await fetch("/api/uga/shapes");
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { zones: { code: string; geometry: Geometry }[] };
      setFrance(data.zones);
      setFranceState("idle");
    } catch {
      setFranceState("failed");
    }
  }

  const points = useMemo(
    () =>
      targets.flatMap((tg) =>
        tg.lng !== null && tg.lat !== null ? [{ id: tg.id, lng: tg.lng, lat: tg.lat }] : [],
      ),
    [targets],
  );

  const selectedTargets = selected ? targets.filter((tg) => tg.brick === selected) : [];

  const details = (code: string) => {
    const b = byBrick.get(code);
    return (
      <>
        <p className="mb-1.5 font-mono font-semibold">{code}</p>
        {b ? (
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5">
            <dt className="text-foreground/60">{t("metric.planShare")}</dt>
            <dd className="text-right tabular-nums">{pct(b.plan.share)}</dd>
            <dt className="text-foreground/60">{t("metric.market")}</dt>
            <dd className="text-right tabular-nums">
              {b.market.share === null ? "—" : pct(b.market.share)}
            </dd>
            <dt className="text-foreground/60">{t("metric.gap")}</dt>
            <dd className="text-right tabular-nums">
              {b.market.share === null ? "—" : signed(b.plan.share - b.market.share)}
            </dd>
            <dt className="text-foreground/60">{t("metric.evolution")}</dt>
            <dd className="text-right tabular-nums">
              {b.market.evolution === null ? "—" : num(b.market.evolution)}
            </dd>
            <dt className="text-foreground/60">{t("metric.targets")}</dt>
            <dd className="text-right tabular-nums">{b.plan.targets}</dd>
            <dt className="text-foreground/60">{t("metric.interactions")}</dt>
            <dd className="text-right tabular-nums">{b.plan.interactions}</dd>
          </dl>
        ) : (
          <p className="text-foreground/60">{t("noActivity")}</p>
        )}
      </>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="radiogroup"
          aria-label={t("indicator")}
          className="flex flex-wrap gap-1 rounded-full border border-black/10 p-1 dark:border-white/15"
        >
          {INDICATORS.map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={indicator === key}
              onClick={() => setIndicator(key)}
              className="rounded-full px-3 py-1.5 text-sm text-foreground/60 transition hover:text-foreground aria-checked:bg-foreground aria-checked:text-background"
            >
              {t(`indicators.${key}`)}
            </button>
          ))}
        </div>
        <p className="text-xs text-foreground/60">
          {t(`hints.${indicator}`, { cycle: referenceCycle ?? "—" })}
        </p>
      </div>

      <ul
        aria-label={t("legend")}
        className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/70"
      >
        {scale.legend.map((item) => (
          <li key={item.label} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: item.color }} />
            {item.label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: NO_DATA[theme] }} />
          {t("noData")}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-background bg-foreground ring-1 ring-foreground/30" />
          {t("targetPoint")}
        </li>
        {view === "france" && (
          <li className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-foreground/20 bg-foreground/5" />
            {t("outsideSector")}
          </li>
        )}
        <li className="ml-auto">
          <div
            role="radiogroup"
            aria-label={t("view.label")}
            className="flex gap-0.5 rounded-full border border-black/10 p-0.5 dark:border-white/15"
          >
            {VIEWS.filter((v) => v !== "focus" || focusZones.length > 0).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={view === v}
                onClick={() => chooseView(v)}
                className="rounded-full px-3 py-1 text-xs text-foreground/60 transition hover:text-foreground aria-checked:bg-foreground aria-checked:text-background"
              >
                {v === "france" && franceState === "loading" ? "…" : t(`view.${v}`)}
              </button>
            ))}
          </div>
        </li>
      </ul>
      {franceState === "failed" && (
        <p role="alert" className="-mt-2 text-xs text-red-700 dark:text-red-400">
          {t("franceFailed")}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <UgaMap
          zones={mapZones}
          labels={labels}
          points={points}
          selected={selected}
          onSelect={setSelected}
          focus={focus}
          context={context}
          tooltip={details}
          ariaLabel={t("aria")}
        />

        <aside className="rounded-2xl border bg-surface border-black/10 p-4 text-sm dark:border-white/10">
          {selected ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">{details(selected)}</div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label={t("close")}
                  className="rounded px-1.5 text-foreground/50 hover:bg-foreground/10"
                >
                  ✕
                </button>
              </div>
              <div>
                <h3 className="mb-2 font-medium">
                  {t("targetsIn", { count: selectedTargets.length })}
                </h3>
                <ul className="flex flex-col gap-2">
                  {selectedTargets.map((tg) => (
                    <li key={tg.id} className="rounded-lg bg-foreground/5 px-3 py-2">
                      <p className="font-medium">{tg.name}</p>
                      <p className="text-xs text-foreground/60">
                        {tg.specialty ?? "—"} · {t("goals", tg.goals)}
                      </p>
                    </li>
                  ))}
                </ul>
                {selectedTargets.length === 0 && (
                  <p className="text-foreground/60">{t("noTargetsHere")}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 text-foreground/70">
              <p className="font-medium text-foreground">{t("panelTitle")}</p>
              <p>{t("panelHint")}</p>
              <p className="text-xs">
                {t("summary", {
                  zones: zones.length,
                  targets: targets.length,
                  located: points.length,
                })}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
