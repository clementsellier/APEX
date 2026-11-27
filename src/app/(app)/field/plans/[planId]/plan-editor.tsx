"use client";

import Link from "next/link";
import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { AnimatedNumber } from "@/components/animated-number";
import { QualifCell, qualifColumns, type Qualif } from "@/components/qualif";
import type { PlanStatus } from "@/generated/prisma/enums";
import { removeTarget, saveTargetGoals, submitPlan } from "./actions";

export type EditorTarget = {
  id: string;
  name: string;
  type: "HCP" | "PHARMACY";
  specialty: string | null;
  workplace: string | null;
  brick: string;
  goalCall: number;
  goalEvtAtt: number;
  goalAemail: number;
  qualifs: Qualif[];
};

type GoalKey = "goalCall" | "goalEvtAtt" | "goalAemail";
const GOALS: GoalKey[] = ["goalCall", "goalEvtAtt", "goalAemail"];
const MAX_GOAL = 99;
const SAVE_DELAY_MS = 600;

type SaveState = "idle" | "saving" | "saved" | "error";

// Donne aux blocs affichés dans l'éditeur (ex. décision du manager) le moyen d'enregistrer
// les modifications en attente avant d'agir sur le plan.
const FlushContext = createContext<() => Promise<boolean>>(async () => true);

/** Enregistre tout de suite les objectifs modifiés et attend la fin des enregistrements. */
export function usePlanFlush() {
  return useContext(FlushContext);
}

type GoalsPayload = { targetId: string; goalCall: number; goalEvtAtt: number; goalAemail: number };

/**
 * Plan affiché par brick avec ses totaux.
 * - délégué, plan en création : objectifs modifiables, ajout / retrait de cibles, envoi au manager
 * - manager, plan en validation : objectifs modifiables et retrait de cibles, tracés dans l'historique
 * - sinon (plan envoyé, validé, en cours, ou vue du manager) : lecture seule
 */
export function PlanEditor({
  planId,
  planName,
  ownerName,
  status,
  editable,
  initialTargets,
  backHref = "/field",
  mode = "field",
  notice,
  panel,
  readOnlyNotice = true,
}: {
  planId: string;
  planName: string;
  /** Nom du délégué, affiché quand c'est le manager qui consulte. */
  ownerName?: string;
  status: PlanStatus;
  editable: boolean;
  initialTargets: EditorTarget[];
  backHref?: string;
  /** « manager » : modification par le manager terrain (pas d'envoi ni d'ajout de cibles). */
  mode?: "field" | "manager";
  /** Bandeau d'état (envoyé, renvoyé, validé…) calculé côté serveur. */
  notice?: ReactNode;
  /** Bloc affiché sous le bandeau (ex. décision du manager). */
  panel?: ReactNode;
  /** Bandeau « lecture seule » par défaut ; inutile dans les espaces de consultation. */
  readOnlyNotice?: boolean;
}) {
  const t = useTranslations();
  const [targets, setTargets] = useState(initialTargets);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [submitOpen, setSubmitOpen] = useState(false);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const queued = useRef(new Map<string, GoalsPayload>());
  const inFlight = useRef(new Set<Promise<boolean>>());
  const pending = useRef(0);

  const totals = useMemo(() => sumGoals(targets), [targets]);
  // Une colonne par qualification présente dans le plan (Potentiel, HTA…).
  const qualifLabels = useMemo(() => qualifColumns(targets), [targets]);
  const groups = useMemo(() => {
    const byBrick = new Map<string, EditorTarget[]>();
    for (const target of targets) {
      byBrick.set(target.brick, [...(byBrick.get(target.brick) ?? []), target]);
    }
    return [...byBrick.entries()];
  }, [targets]);

  function track(promise: Promise<{ ok: boolean }>) {
    pending.current += 1;
    setSaveState("saving");
    const done: Promise<boolean> = promise
      .catch(() => ({ ok: false }))
      .then((result) => {
        pending.current -= 1;
        inFlight.current.delete(done);
        if (!result.ok) setSaveState("error");
        else if (pending.current === 0) setSaveState((s) => (s === "error" ? s : "saved"));
        return result.ok;
      });
    inFlight.current.add(done);
    return done;
  }

  function saveNow(id: string) {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    const payload = queued.current.get(id);
    queued.current.delete(id);
    if (payload) void track(saveTargetGoals(payload));
  }

  /** Enregistre tout de suite les modifications en attente et attend la fin des enregistrements. */
  async function flush() {
    for (const id of [...queued.current.keys()]) saveNow(id);
    const results = await Promise.all([...inFlight.current]);
    return results.every(Boolean);
  }

  function updateGoal(id: string, key: GoalKey, raw: number) {
    const value = Math.max(0, Math.min(MAX_GOAL, Number.isFinite(raw) ? Math.trunc(raw) : 0));
    const next = targets.map((target) => (target.id === id ? { ...target, [key]: value } : target));
    setTargets(next);

    // Enregistrement automatique, regroupé : une seule requête si on clique plusieurs fois vite.
    const updated = next.find((target) => target.id === id)!;
    queued.current.set(id, {
      targetId: id,
      goalCall: updated.goalCall,
      goalEvtAtt: updated.goalEvtAtt,
      goalAemail: updated.goalAemail,
    });
    clearTimeout(timers.current.get(id));
    timers.current.set(
      id,
      setTimeout(() => saveNow(id), SAVE_DELAY_MS),
    );
  }

  async function remove(target: EditorTarget) {
    if (!window.confirm(t("PlanEditor.confirmRemove", { name: target.name }))) return;
    clearTimeout(timers.current.get(target.id));
    queued.current.delete(target.id);
    const previous = targets;
    setTargets(targets.filter((x) => x.id !== target.id));
    const ok = await track(removeTarget(target.id));
    if (!ok) setTargets(previous);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex gap-4 text-sm">
            <Link href={backHref} className="text-foreground/60 hover:text-foreground">
              ← {t("PlanEditor.back")}
            </Link>
            {mode === "field" && (
              <Link
                href={`/field/plans/${planId}/stats`}
                className="text-foreground/60 hover:text-foreground"
              >
                {t("PlanEditor.stats")} →
              </Link>
            )}
          </div>
          <h1 className="mt-1 font-mono text-2xl font-semibold">{planName}</h1>
          <p className="text-sm text-foreground/60">
            {ownerName && <>{ownerName} · </>}
            {t(`Plan.status.${status}`)} · {t("Field.targets", { count: targets.length })}
          </p>
        </div>
        {editable && (
          <div className="flex flex-wrap items-center gap-4">
            <SaveIndicator state={saveState} />
            {mode === "field" && (
              <button
                type="button"
                onClick={() => setSubmitOpen(true)}
                disabled={targets.length === 0}
                title={targets.length === 0 ? t("Submit.needTargets") : undefined}
                className="rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90 active:scale-95 disabled:opacity-40"
              >
                {t("Submit.button")} →
              </button>
            )}
          </div>
        )}
      </div>

      {notice ??
        (!editable && readOnlyNotice && (
          <p className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            {t("PlanEditor.readOnly")}
          </p>
        ))}
      <FlushContext value={flush}>{panel}</FlushContext>

      {/* Totaux du plan */}
      <section className="sticky top-0 z-10 -mx-4 grid grid-cols-3 gap-3 bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        {GOALS.map((key, i) => (
          <div
            key={key}
            className="relative overflow-hidden rounded-xl border border-black/10 p-3 dark:border-white/10 sm:p-4"
          >
            <div className={`absolute inset-x-0 top-0 h-1 ${ACCENTS[i]}`} />
            <div className="text-xs text-foreground/60 sm:text-sm">
              {t(`PlanEditor.total.${key}`)}
            </div>
            <AnimatedNumber
              value={totals[key]}
              className="text-2xl font-semibold tabular-nums sm:text-3xl"
            />
          </div>
        ))}
      </section>

      {targets.length === 0 && <p className="text-foreground/60">{t("PlanEditor.empty")}</p>}

      {groups.map(([brick, rows]) => {
        const sub = sumGoals(rows);
        return (
          <section
            key={brick}
            className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/10"
          >
            <header className="flex flex-wrap items-center justify-between gap-2 bg-foreground/5 px-4 py-3">
              <h2 className="font-medium">{t("PlanEditor.brick", { code: brick })}</h2>
              <div className="flex gap-2 text-xs">
                {GOALS.map((key, i) => (
                  <span key={key} className={`rounded-full px-2.5 py-1 ${CHIPS[i]}`}>
                    {t(`PlanEditor.short.${key}`)} {sub[key]}
                  </span>
                ))}
              </div>
            </header>

            <div className="overflow-x-auto">
              <table
                className="w-full text-left text-sm"
                style={{ minWidth: 640 + qualifLabels.length * 110 }}
              >
                <thead className="text-foreground/60">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t("PlanEditor.col.name")}</th>
                    <th className="px-4 py-2 font-medium">{t("PlanEditor.col.specialty")}</th>
                    <th className="px-4 py-2 font-medium">{t("PlanEditor.col.place")}</th>
                    {qualifLabels.map((label) => (
                      <th key={label} className="px-3 py-2 font-medium whitespace-nowrap">
                        {label}
                      </th>
                    ))}
                    {GOALS.map((key) => (
                      <th key={key} className="px-2 py-2 text-center font-medium">
                        {t(`PlanEditor.short.${key}`)}
                      </th>
                    ))}
                    {editable && <th className="w-10" />}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {rows.map((target) => (
                      <motion.tr
                        key={target.id}
                        // Réorganisation animée seulement en édition (retrait d'une cible).
                        layout={editable}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, x: -24 }}
                        className="border-t border-black/5 dark:border-white/10"
                      >
                        <td className="px-4 py-2 font-medium">{target.name}</td>
                        <td className="px-4 py-2 text-foreground/70">{target.specialty ?? "—"}</td>
                        <td className="px-4 py-2 text-foreground/70">{target.workplace ?? "—"}</td>
                        {qualifLabels.map((label) => (
                          <td key={label} className="px-3 py-2">
                            <QualifCell qualifs={target.qualifs} label={label} />
                          </td>
                        ))}
                        {GOALS.map((key) => (
                          <td key={key} className="px-2 py-2">
                            {editable ? (
                              <GoalStepper
                                value={target[key]}
                                label={`${t(`PlanEditor.total.${key}`)} — ${target.name}`}
                                onChange={(v) => updateGoal(target.id, key, v)}
                              />
                            ) : (
                              <div className="text-center tabular-nums">{target[key]}</div>
                            )}
                          </td>
                        ))}
                        {editable && (
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => remove(target)}
                              title={t("PlanEditor.remove")}
                              aria-label={`${t("PlanEditor.remove")} — ${target.name}`}
                              className="rounded-md px-2 py-1 text-foreground/40 transition hover:bg-red-500/10 hover:text-red-600"
                            >
                              ✕
                            </button>
                          </td>
                        )}
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {editable && mode === "field" && (
        <div className="flex justify-center">
          <Link
            href={`/field/plans/${planId}/add`}
            className="rounded-full border border-dashed border-black/25 px-5 py-2.5 text-sm font-medium text-foreground/70 transition hover:border-solid hover:border-foreground hover:bg-foreground hover:text-background dark:border-white/25"
          >
            + {t("PlanEditor.addTarget")}
          </Link>
        </div>
      )}

      <AnimatePresence>
        {submitOpen && (
          <SubmitDialog
            planId={planId}
            totals={totals}
            targetCount={targets.length}
            flush={flush}
            onClose={() => setSubmitOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SubmitDialog({
  planId,
  totals,
  targetCount,
  flush,
  onClose,
}: {
  planId: string;
  totals: Record<GoalKey, number>;
  targetCount: number;
  flush: () => Promise<boolean>;
  onClose: () => void;
}) {
  const t = useTranslations();
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "empty" | "failed">("idle");
  const busy = state === "sending";

  async function send() {
    setState("sending");
    // Les dernières modifications doivent être enregistrées avant que le plan ne soit verrouillé.
    if (!(await flush())) return setState("failed");
    const result = await submitPlan({ planId, comment }).catch(
      () => ({ ok: false, reason: "failed" }) as const,
    );
    if (result.ok) onClose();
    else setState(result.reason);
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => !busy && onClose()}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-title"
        initial={{ scale: 0.95, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 8 }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && !busy && onClose()}
        className="w-full max-w-md rounded-2xl border border-black/10 bg-background p-6 shadow-xl dark:border-white/15"
      >
        <h2 id="submit-title" className="text-lg font-semibold">
          {t("Submit.title")}
        </h2>
        <p className="mt-1 text-sm text-foreground/60">{t("Submit.intro")}</p>

        <dl className="mt-5 grid grid-cols-4 gap-2 text-center">
          <div className="rounded-xl bg-foreground/5 p-2">
            <dt className="text-xs text-foreground/60">{t("Manager.targets")}</dt>
            <dd className="text-xl font-semibold tabular-nums">{targetCount}</dd>
          </div>
          {GOALS.map((key, i) => (
            <div key={key} className={`rounded-xl p-2 ${CHIPS[i]}`}>
              <dt className="text-xs">{t(`PlanEditor.short.${key}`)}</dt>
              <dd className="text-xl font-semibold tabular-nums">{totals[key]}</dd>
            </div>
          ))}
        </dl>

        <label className="mt-5 block text-sm font-medium" htmlFor="submit-comment">
          {t("Submit.comment")}
        </label>
        <textarea
          id="submit-comment"
          autoFocus
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder={t("Submit.commentPlaceholder")}
          className="mt-1.5 w-full resize-none rounded-lg border border-black/10 bg-transparent p-3 text-sm outline-none focus:border-foreground/40 dark:border-white/15"
        />

        {(state === "failed" || state === "empty") && (
          <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
            {t(state === "empty" ? "Submit.needTargets" : "Submit.failed")}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full px-4 py-2 text-sm text-foreground/70 transition hover:bg-foreground/5"
          >
            {t("Submit.cancel")}
          </button>
          <button
            type="button"
            onClick={send}
            disabled={busy}
            className="rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 active:scale-95 disabled:opacity-60"
          >
            {busy ? t("Submit.sending") : t("Submit.confirm")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function GoalStepper({
  value,
  label,
  onChange,
}: {
  value: number;
  label: string;
  onChange: (value: number) => void;
}) {
  const button =
    "h-8 w-8 rounded-md text-base leading-none transition hover:bg-foreground/10 disabled:opacity-30";
  return (
    <div className="mx-auto flex w-fit items-center rounded-lg border border-black/10 dark:border-white/15">
      <button
        type="button"
        className={button}
        disabled={value <= 0}
        onClick={() => onChange(value - 1)}
        aria-label={`− ${label}`}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={MAX_GOAL}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.valueAsNumber)}
        onFocus={(e) => e.target.select()}
        className="w-10 bg-transparent text-center tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        className={button}
        disabled={value >= MAX_GOAL}
        onClick={() => onChange(value + 1)}
        aria-label={`+ ${label}`}
      >
        +
      </button>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const t = useTranslations("PlanEditor.save");
  if (state === "idle") return null;
  const style = {
    saving: "text-foreground/60",
    saved: "text-green-700 dark:text-green-400",
    error: "text-red-700 dark:text-red-400",
  }[state];
  return (
    <p role="status" className={`text-sm ${style}`}>
      {state === "saved" ? "✓ " : state === "error" ? "⚠ " : ""}
      {t(state)}
    </p>
  );
}

function sumGoals(rows: EditorTarget[]) {
  return rows.reduce(
    (acc, r) => ({
      goalCall: acc.goalCall + r.goalCall,
      goalEvtAtt: acc.goalEvtAtt + r.goalEvtAtt,
      goalAemail: acc.goalAemail + r.goalAemail,
    }),
    { goalCall: 0, goalEvtAtt: 0, goalAemail: 0 },
  );
}

const ACCENTS = [
  "bg-gradient-to-r from-indigo-500 to-sky-500",
  "bg-gradient-to-r from-fuchsia-500 to-pink-500",
  "bg-gradient-to-r from-amber-400 to-orange-500",
];
const CHIPS = [
  "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
  "bg-amber-500/10 text-amber-800 dark:text-amber-300",
];
