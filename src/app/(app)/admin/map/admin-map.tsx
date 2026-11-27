"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { labelPoint } from "@/components/map/geo";
import { NO_DATA } from "@/components/map/scales";
import { UgaMap, type MapZone } from "@/components/map/uga-map";
import type { AdminZone, SectorInfo } from "@/lib/admin-map";
import { saveSectorisation } from "./actions";

// Mise en avant (un seul bleu + gris) plutôt qu'une couleur par secteur :
// au-delà de 3 teintes, une carte devient illisible pour les daltoniens.
const ASSIGNED = "#cde2fb";
const ASSIGNED_ALL = "#9ec5f4";
const FOCUS = "#3987e5";
const EDIT_TARGET = "#256abf";

function useTheme() {
  return useSyncExternalStore(
    (cb) => {
      const o = new MutationObserver(cb);
      o.observe(document.documentElement, { attributeFilter: ["data-theme"] });
      return () => o.disconnect();
    },
    () => {
      const t = document.documentElement.getAttribute("data-theme");
      return t === "dark" ||
        (t !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches)
        ? "dark"
        : "light";
    },
    () => "light" as const,
  );
}

export function AdminMap({ zones, sectors }: { zones: AdminZone[]; sectors: SectorInfo[] }) {
  const t = useTranslations("Admin.map");
  const router = useRouter();
  const theme = useTheme();
  const [sector, setSector] = useState<string>("");
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editSector, setEditSector] = useState<string>(sectors[0]?.code ?? "");
  const [pending, setPending] = useState(new Map<string, string | null>());
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState(false);

  const byCode = useMemo(() => new Map(zones.map((z) => [z.code, z])), [zones]);
  const effective = (z: AdminZone) => (pending.has(z.code) ? pending.get(z.code)! : z.sector);
  const target = editSector.trim().toUpperCase();

  const mapZones: MapZone[] = useMemo(
    () =>
      zones.map((z) => {
        const s = pending.has(z.code) ? pending.get(z.code)! : z.sector;
        let fill = NO_DATA[theme];
        if (s) {
          if (editing) fill = s === target ? EDIT_TARGET : ASSIGNED;
          else if (sector) fill = s === sector ? FOCUS : ASSIGNED;
          else fill = ASSIGNED_ALL;
        }
        return { code: z.code, geometry: z.geometry, fill, emphasis: pending.has(z.code) };
      }),
    [zones, pending, editing, target, sector, theme],
  );

  const outlines = useMemo(
    () => sectors.flatMap((s) => (s.outline ? [{ id: s.code, geometry: s.outline }] : [])),
    [sectors],
  );
  const labels = useMemo(
    () =>
      sectors.flatMap((s) => {
        const p = s.outline && labelPoint(s.outline);
        return p ? [{ id: s.code, lng: p[0], lat: p[1], text: s.code }] : [];
      }),
    [sectors],
  );
  const focus = useMemo(() => {
    if (!sector) return { key: "all", zones: [] };
    return { key: sector, zones: zones.filter((z) => z.sector === sector) };
  }, [sector, zones]);

  function click(code: string | null) {
    if (!editing || !code) return setSelected(code);
    if (!target) return;
    const zone = byCode.get(code)!;
    const next = new Map(pending);
    const current = effective(zone);
    const value = current === target ? null : target;
    if (value === zone.sector) next.delete(code);
    else next.set(code, value);
    setPending(next);
    setSelected(code);
  }

  function save() {
    setError(false);
    const changes = [...pending.entries()].map(([code, s]) => ({ code, sector: s }));
    startSaving(async () => {
      const result = await saveSectorisation(changes).catch(() => ({ ok: false }));
      if (!result.ok) return setError(true);
      setPending(new Map());
      setEditing(false);
      router.refresh();
    });
  }

  const assigned = zones.filter((z) => effective(z)).length;
  const zone = selected ? byCode.get(selected) : undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/70">
          {(editing
            ? [
                { color: EDIT_TARGET, label: t("legend.target", { code: target || "—" }) },
                { color: ASSIGNED, label: t("legend.otherSector") },
              ]
            : sector
              ? [
                  { color: FOCUS, label: t("legend.sector", { code: sector }) },
                  { color: ASSIGNED, label: t("legend.otherSector") },
                ]
              : [{ color: ASSIGNED_ALL, label: t("legend.assigned") }]
          )
            .concat({ color: NO_DATA[theme], label: t("legend.unassigned") })
            .map((item) => (
              <li key={item.label} className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: item.color }} />
                {item.label}
              </li>
            ))}
          <li className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-foreground" />
            {t("legend.border")}
          </li>
        </ul>
        <UgaMap
          zones={mapZones}
          outlines={outlines}
          labels={labels}
          selected={selected}
          onSelect={click}
          focus={focus}
          height={620}
          ariaLabel={t("aria")}
          tooltip={(code) => {
            const z = byCode.get(code);
            if (!z) return null;
            const s = effective(z);
            return (
              <>
                <p className="font-mono font-semibold">{code}</p>
                <p className="text-foreground/70">
                  {t("department", { code: z.department ?? "—" })} ·{" "}
                  {s ? t("inSector", { code: s }) : t("legend.unassigned")}
                </p>
                <p className="text-foreground/60">{t("accounts", { count: z.accounts })}</p>
                {editing && target && (
                  <p className="mt-1 text-foreground/60">
                    {s === target ? t("clickToRemove") : t("clickToAssign", { code: target })}
                  </p>
                )}
              </>
            );
          }}
        />
      </div>

      <aside className="flex flex-col gap-4 text-sm">
        <div className="rounded-2xl border bg-surface border-black/10 p-4 dark:border-white/10">
          <p className="text-foreground/60">
            {t("coverage", { assigned, total: zones.length, sectors: sectors.length })}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full rounded-full bg-[#2a78d6] dark:bg-[#3987e5]"
              style={{ width: `${(assigned / Math.max(1, zones.length)) * 100}%` }}
            />
          </div>
        </div>

        {editing ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4">
            <p className="font-medium">{t("edit.title")}</p>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-foreground/70">{t("edit.sector")}</span>
              <input
                list="sector-codes"
                value={editSector}
                onChange={(e) => setEditSector(e.target.value)}
                placeholder="S106"
                className="h-10 rounded-lg border border-black/15 bg-background px-3 font-mono uppercase outline-none focus:border-indigo-500 dark:border-white/20"
              />
              <datalist id="sector-codes">
                {sectors.map((s) => (
                  <option key={s.code} value={s.code} />
                ))}
              </datalist>
            </label>
            <p className="text-xs text-foreground/60">{t("edit.hint")}</p>
            <p className="text-xs">{t("edit.pending", { count: pending.size })}</p>
            {error && (
              <p role="alert" className="text-xs text-red-700 dark:text-red-400">
                {t("edit.failed")}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={save}
                disabled={pending.size === 0 || saving}
                className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
              >
                {saving ? "…" : t("edit.save", { count: pending.size })}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPending(new Map());
                  setEditing(false);
                }}
                className="rounded-full px-4 py-2 text-sm text-foreground/70 hover:bg-foreground/5"
              >
                {t("edit.cancel")}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setSelected(null);
              if (sector) setEditSector(sector);
            }}
            className="rounded-full border border-black/15 px-4 py-2 text-sm font-medium transition hover:bg-foreground/5 dark:border-white/20"
          >
            ✎ {t("edit.start")}
          </button>
        )}

        {zone && !editing && (
          <div className="rounded-2xl border bg-surface border-black/10 p-4 dark:border-white/10">
            <p className="font-mono font-semibold">{zone.code}</p>
            <p className="text-foreground/70">
              {t("department", { code: zone.department ?? "—" })} ·{" "}
              {zone.sector ? t("inSector", { code: zone.sector }) : t("legend.unassigned")}
            </p>
            <p className="text-foreground/60">{t("accounts", { count: zone.accounts })}</p>
          </div>
        )}

        <div className="rounded-2xl border bg-surface border-black/10 dark:border-white/10">
          <p className="border-b border-black/10 px-4 py-3 font-medium dark:border-white/10">
            {t("sectors")}
          </p>
          <ul className="max-h-80 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => setSector("")}
                aria-pressed={sector === ""}
                className="w-full px-4 py-2 text-left hover:bg-foreground/5 aria-pressed:bg-foreground/10"
              >
                {t("allFrance")}
              </button>
            </li>
            {sectors.map((s) => (
              <li key={s.code}>
                <button
                  type="button"
                  onClick={() => setSector(s.code)}
                  aria-pressed={sector === s.code}
                  className="w-full px-4 py-2 text-left hover:bg-foreground/5 aria-pressed:bg-foreground/10"
                >
                  <span className="flex justify-between gap-2">
                    <span className="font-mono font-medium">{s.code}</span>
                    <span className="text-xs text-foreground/60 tabular-nums">
                      {t("zonesCount", { count: s.zones })}
                    </span>
                  </span>
                  <span className="block text-xs text-foreground/60">
                    {s.reps.length ? s.reps.join(", ") : t("noRep")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
