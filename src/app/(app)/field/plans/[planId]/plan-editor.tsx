"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { AnimatedNumber } from "@/components/animated-number";
import type { PlanStatus } from "@/generated/prisma/enums";
import { removeTarget, saveTargetGoals } from "./actions";

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
};

type GoalKey = "goalCall" | "goalEvtAtt" | "goalAemail";
const GOALS: GoalKey[] = ["goalCall", "goalEvtAtt", "goalAemail"];
const MAX_GOAL = 99;
const SAVE_DELAY_MS = 600;

type SaveState = "idle" | "saving" | "saved" | "error";

export function PlanEditor({
  planId,
  planName,
  status,
  editable,
  initialTargets,
}: {
  planId: string;
  planName: string;
  status: PlanStatus;
  editable: boolean;
  initialTargets: EditorTarget[];
}) {
  const t = useTranslations();
  const [targets, setTargets] = useState(initialTargets);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pending = useRef(0);

  const totals = useMemo(() => sumGoals(targets), [targets]);
  const groups = useMemo(() => {
    const byBrick = new Map<string, EditorTarget[]>();
    for (const target of targets) {
      byBrick.set(target.brick, [...(byBrick.get(target.brick) ?? []), target]);
    }
    return [...byBrick.entries()];
  }, [targets]);

  async function track(promise: Promise<{ ok: boolean }>) {
    pending.current += 1;
    setSaveState("saving");
    const result = await promise.catch(() => ({ ok: false }));
    pending.current -= 1;
    if (!result.ok) setSaveState("error");
    else if (pending.current === 0) setSaveState((s) => (s === "error" ? s : "saved"));
    return result.ok;
  }

  function updateGoal(id: string, key: GoalKey, raw: number) {
    const value = Math.max(0, Math.min(MAX_GOAL, Number.isFinite(raw) ? Math.trunc(raw) : 0));
    const next = targets.map((target) => (target.id === id ? { ...target, [key]: value } : target));
    setTargets(next);

    // Enregistrement automatique, regroupé : une seule requête si on clique plusieurs fois vite.
    const updated = next.find((target) => target.id === id)!;
    clearTimeout(timers.current.get(id));
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        void track(
          saveTargetGoals({
            targetId: id,
            goalCall: updated.goalCall,
            goalEvtAtt: updated.goalEvtAtt,
            goalAemail: updated.goalAemail,
          }),
        );
      }, SAVE_DELAY_MS),
    );
  }

  async function remove(target: EditorTarget) {
    if (!window.confirm(t("PlanEditor.confirmRemove", { name: target.name }))) return;
    clearTimeout(timers.current.get(target.id));
    const previous = targets;
    setTargets(targets.filter((x) => x.id !== target.id));
    const ok = await track(removeTarget(target.id));
    if (!ok) setTargets(previous);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/field" className="text-sm text-foreground/60 hover:text-foreground">
            ← {t("PlanEditor.back")}
          </Link>
          <h1 className="mt-1 font-mono text-2xl font-semibold">{planName}</h1>
          <p className="text-sm text-foreground/60">
            {t(`Plan.status.${status}`)} · {t("Field.targets", { count: targets.length })}
          </p>
        </div>
        {editable && <SaveIndicator state={saveState} />}
      </div>

      {!editable && (
        <p className="rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          {t("PlanEditor.readOnly")}
        </p>
      )}

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
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-foreground/60">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t("PlanEditor.col.name")}</th>
                    <th className="px-4 py-2 font-medium">{t("PlanEditor.col.specialty")}</th>
                    <th className="px-4 py-2 font-medium">{t("PlanEditor.col.place")}</th>
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
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, x: -24 }}
                        className="border-t border-black/5 dark:border-white/10"
                      >
                        <td className="px-4 py-2 font-medium">{target.name}</td>
                        <td className="px-4 py-2 text-foreground/70">{target.specialty ?? "—"}</td>
                        <td className="px-4 py-2 text-foreground/70">{target.workplace ?? "—"}</td>
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

      {editable && (
        <div className="flex justify-center">
          <Link
            href={`/field/plans/${planId}/add`}
            className="rounded-full border border-dashed border-black/25 px-5 py-2.5 text-sm font-medium text-foreground/70 transition hover:border-solid hover:border-foreground hover:bg-foreground hover:text-background dark:border-white/25"
          >
            + {t("PlanEditor.addTarget")}
          </Link>
        </div>
      )}
    </div>
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
