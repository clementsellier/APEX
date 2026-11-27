"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useFormatter, useTranslations } from "next-intl";
import { AnimatedNumber } from "@/components/animated-number";
import type { Candidate } from "@/lib/plans";
import { addTarget, undoAddTarget } from "./actions";

type Presence = "all" | "with" | "without";
type Kind = "HCP" | "PHARMACY";

/** Ligne ajoutée au plan : identifiant de la cible créée, pour pouvoir annuler. */
type Added = { targetId: string } | "pending";

export function AddTargets({
  planId,
  planName,
  previousCycle,
  candidates: initialCandidates,
}: {
  planId: string;
  planName: string;
  previousCycle: string | null;
  candidates: Candidate[];
}) {
  // Liste figée pour la durée de la visite : après un ajout, le serveur renvoie une liste
  // sans ce PDS, mais on garde sa ligne affichée pour pouvoir annuler.
  const [candidates] = useState(initialCandidates);
  const t = useTranslations("AddTarget");
  const format = useFormatter();
  const cycle = previousCycle ?? "—";

  const [kind, setKind] = useState<Kind>("HCP");
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [brick, setBrick] = useState("");
  const [withCall, setWithCall] = useState<Presence>("all");
  const [withEvt, setWithEvt] = useState<Presence>("all");
  const [added, setAdded] = useState(new Map<string, Added>());
  const [error, setError] = useState(false);

  const ofKind = useMemo(() => candidates.filter((c) => c.type === kind), [candidates, kind]);
  const specialties = useMemo(
    () => [...new Set(ofKind.map((c) => c.specialty).filter((s): s is string => !!s))].sort(),
    [ofKind],
  );
  const bricks = useMemo(() => [...new Set(candidates.map((c) => c.brick))].sort(), [candidates]);

  const rows = useMemo(() => {
    const q = normalize(query.trim());
    return ofKind.filter(
      (c) =>
        (!q || normalize(`${c.name} ${c.workplace ?? ""}`).includes(q)) &&
        (!specialty || c.specialty === specialty) &&
        (!brick || c.brick === brick) &&
        matches(withCall, c.lastCycle.call) &&
        matches(withEvt, c.lastCycle.evtAtt),
    );
  }, [ofKind, query, specialty, brick, withCall, withEvt]);

  const addedCount = [...added.values()].filter((a) => a !== "pending").length;
  const filtered = !!(query || specialty || brick || withCall !== "all" || withEvt !== "all");

  function setRow(id: string, value: Added | null) {
    setAdded((prev) => {
      const next = new Map(prev);
      if (value === null) next.delete(id);
      else next.set(id, value);
      return next;
    });
  }

  async function toggle(candidate: Candidate) {
    const state = added.get(candidate.id);
    if (state === "pending") return;
    setError(false);

    if (state) {
      // Deuxième clic : on annule l'ajout.
      setRow(candidate.id, null);
      const result = await undoAddTarget(state.targetId).catch(() => ({ ok: false }));
      if (!result.ok) {
        setRow(candidate.id, state);
        setError(true);
      }
      return;
    }

    setRow(candidate.id, "pending");
    const result = await addTarget({ planId, accountId: candidate.id }).catch(
      () => ({ ok: false }) as const,
    );
    if (result.ok) setRow(candidate.id, { targetId: result.targetId });
    else {
      setRow(candidate.id, null);
      setError(true);
    }
  }

  function reset() {
    setQuery("");
    setSpecialty("");
    setBrick("");
    setWithCall("all");
    setWithEvt("all");
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href={`/field/plans/${planId}`}
            className="text-sm text-foreground/60 hover:text-foreground"
          >
            ← {t("back")}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{t("title")}</h1>
          <p className="font-mono text-sm text-foreground/60">{planName}</p>
        </div>

        <Link
          href={`/field/plans/${planId}`}
          className="flex items-center gap-3 rounded-full bg-foreground py-1.5 pr-5 pl-1.5 text-sm font-medium text-background transition hover:opacity-90"
        >
          <span className="grid h-8 min-w-8 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 px-2 text-white tabular-nums">
            <span>
              +<AnimatedNumber value={addedCount} />
            </span>
          </span>
          {t("done")}
        </Link>
      </div>

      {/* Type de compte */}
      <div
        role="tablist"
        className="flex w-fit gap-1 rounded-full border border-black/10 p-1 dark:border-white/15"
      >
        {(["HCP", "PHARMACY"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={kind === value}
            onClick={() => {
              setKind(value);
              setSpecialty("");
            }}
            className="rounded-full px-4 py-1.5 text-sm text-foreground/60 transition hover:text-foreground aria-selected:bg-foreground aria-selected:text-background"
          >
            {t(`kind.${value}`)} · {candidates.filter((c) => c.type === value).length}
          </button>
        ))}
      </div>

      {/* Filtres */}
      <section className="flex flex-col gap-3 rounded-2xl border border-black/10 p-4 dark:border-white/10">
        <div className="flex flex-wrap gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            aria-label={t("search")}
            className={`${FIELD} min-w-48 flex-1`}
          />
          {kind === "HCP" && (
            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              aria-label={t("filter.specialty")}
              className={FIELD}
            >
              <option value="">{t("filter.allSpecialties")}</option>
              {specialties.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          )}
          <select
            value={brick}
            onChange={(e) => setBrick(e.target.value)}
            aria-label={t("filter.brick")}
            className={FIELD}
          >
            <option value="">{t("filter.allBricks")}</option>
            {bricks.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <PresenceFilter
            label={t("filter.call", { cycle })}
            value={withCall}
            onChange={setWithCall}
          />
          <PresenceFilter
            label={t("filter.evt", { cycle })}
            value={withEvt}
            onChange={setWithEvt}
          />
          {filtered && (
            <button
              type="button"
              onClick={reset}
              className="text-foreground/60 underline-offset-4 hover:text-foreground hover:underline"
            >
              {t("filter.reset")}
            </button>
          )}
        </div>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300"
        >
          {t("error")}
        </p>
      )}

      <p className="-mb-3 text-sm text-foreground/60">{t("results", { count: rows.length })}</p>

      <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-foreground/5 text-foreground/60">
            <tr>
              <th className="px-4 py-2.5 font-medium">{t("col.brick")}</th>
              <th className="px-4 py-2.5 font-medium">{t("col.name")}</th>
              {kind === "HCP" && <th className="px-4 py-2.5 font-medium">{t("col.specialty")}</th>}
              <th className="px-4 py-2.5 font-medium">{t("col.place")}</th>
              <th className="px-4 py-2.5 font-medium">{t("col.qualifs")}</th>
              <th className="px-2 py-2.5 text-center font-medium" colSpan={3}>
                {t("col.lastCycle", { cycle })}
              </th>
              <th className="px-4 py-2.5 font-medium">{t("col.lastCall")}</th>
              <th className="w-28" />
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {rows.map((c) => {
                const state = added.get(c.id);
                const isAdded = !!state && state !== "pending";
                return (
                  <motion.tr
                    key={c.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`border-t border-black/5 transition-colors dark:border-white/10 ${
                      isAdded ? "bg-green-500/5" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground/60">{c.brick}</td>
                    <td className="px-4 py-2.5 font-medium">{c.name}</td>
                    {kind === "HCP" && (
                      <td className="px-4 py-2.5 text-foreground/70">{c.specialty ?? "—"}</td>
                    )}
                    <td className="px-4 py-2.5 text-foreground/70">{c.workplace ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {c.qualifs.length === 0 && <span className="text-foreground/40">—</span>}
                        {c.qualifs.map((q) => (
                          <span
                            key={q.label}
                            title={q.label}
                            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-2 py-0.5 text-xs font-medium dark:border-white/15"
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: q.color ?? "currentColor" }}
                            />
                            {q.value}
                          </span>
                        ))}
                      </div>
                    </td>
                    {(["call", "evtAtt", "aemail"] as const).map((key, i) => (
                      <td key={key} className="px-1 py-2.5 text-center">
                        <span
                          title={t(`activity.${key}`)}
                          className={`inline-block min-w-12 rounded-full px-2 py-0.5 text-xs whitespace-nowrap tabular-nums ${
                            c.lastCycle[key] ? CHIPS[i] : "text-foreground/30"
                          }`}
                        >
                          {t(`short.${key}`)} {c.lastCycle[key]}
                        </span>
                      </td>
                    ))}
                    <td className="px-4 py-2.5 whitespace-nowrap text-foreground/70">
                      {c.lastCallDate
                        ? format.dateTime(new Date(c.lastCallDate), { dateStyle: "medium" })
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => toggle(c)}
                        disabled={state === "pending"}
                        aria-pressed={isAdded}
                        aria-label={`${isAdded ? t("undo") : t("add")} — ${c.name}`}
                        title={isAdded ? t("undo") : t("add")}
                        className={`group inline-flex h-8 min-w-24 items-center justify-center gap-1 rounded-full px-3 text-sm font-medium whitespace-nowrap transition active:scale-95 disabled:opacity-60 ${
                          isAdded
                            ? "bg-green-600 text-white hover:bg-red-600"
                            : "border border-black/15 hover:border-transparent hover:bg-foreground hover:text-background dark:border-white/20"
                        }`}
                      >
                        {state === "pending" ? (
                          "…"
                        ) : isAdded ? (
                          <>
                            <span className="group-hover:hidden">✓ {t("added")}</span>
                            <span className="hidden group-hover:inline">{t("undo")}</span>
                          </>
                        ) : (
                          <>+ {t("add")}</>
                        )}
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-4 py-10 text-center text-foreground/60">
            {ofKind.length === 0 ? t("emptyAll") : t("empty")}
          </p>
        )}
      </div>
    </div>
  );
}

function PresenceFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Presence;
  onChange: (value: Presence) => void;
}) {
  const t = useTranslations("AddTarget.filter");
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <span className="text-foreground/70">{label}</span>
      <div className="flex gap-0.5 rounded-full border border-black/10 p-0.5 dark:border-white/15">
        {(["all", "with", "without"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className="rounded-full px-3 py-1 text-xs text-foreground/60 transition hover:text-foreground aria-pressed:bg-foreground aria-pressed:text-background"
          >
            {t(v)}
          </button>
        ))}
      </div>
    </div>
  );
}

function matches(filter: Presence, count: number) {
  return filter === "all" || (filter === "with" ? count > 0 : count === 0);
}

/** Recherche insensible à la casse et aux accents. */
function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const FIELD =
  "h-10 rounded-lg border border-black/10 bg-transparent px-3 text-sm outline-none focus:border-foreground/40 dark:border-white/15 [&>option]:bg-background";

const CHIPS = [
  "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
  "bg-amber-500/10 text-amber-800 dark:text-amber-300",
];
