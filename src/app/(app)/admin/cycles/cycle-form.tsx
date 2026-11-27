"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { CycleError, CycleField, CycleFormState } from "./actions";
import { deleteCycle } from "./actions";

export type CycleValues = Record<CycleField, string>;

/** Création ou modification d'un cycle (code, libellé, dates). */
export function CycleForm({
  action,
  initial,
  cycleId,
  planCount = 0,
}: {
  action: (prev: CycleFormState, formData: FormData) => Promise<CycleFormState>;
  initial?: CycleValues;
  cycleId?: string;
  planCount?: number;
}) {
  const t = useTranslations("Admin.cycles");
  const [state, formAction, pending] = useActionState(action, {});
  const [deleteError, setDeleteError] = useState<CycleError | null>(null);
  // Après une création réussie, on vide le formulaire en le recréant.
  const [formKey, setFormKey] = useState(0);
  const [lastOk, setLastOk] = useState<CycleFormState | null>(null);
  if (!initial && state.ok && state !== lastOk) {
    setLastOk(state);
    setFormKey((k) => k + 1);
  }

  const values = { code: "", label: "", startDate: "", endDate: "", ...initial, ...state.values };
  const errors = state.errors ?? {};
  const err = (field: CycleField | "form") => {
    const code = errors[field];
    return code ? t(`errors.${code}`, { cycle: state.conflict ?? "" }) : null;
  };

  async function remove() {
    if (!cycleId || !window.confirm(t("confirmDelete", { code: values.code }))) return;
    const result = await deleteCycle(cycleId);
    // En cas de succès, l'action redirige vers la liste.
    setDeleteError(result?.errors?.form ?? null);
  }

  return (
    <form
      key={formKey}
      action={formAction}
      noValidate
      className="grid gap-4 rounded-2xl border bg-surface border-black/10 p-5 sm:grid-cols-[8rem_1fr_10rem_10rem_auto] sm:items-start dark:border-white/10"
    >
      <Field label={t("field.code")} error={err("code")} hint={t("hint.code")}>
        <input
          name="code"
          defaultValue={values.code}
          placeholder="27C1"
          required
          className={`${INPUT} font-mono uppercase`}
        />
      </Field>
      <Field label={t("field.label")}>
        <input
          name="label"
          defaultValue={values.label}
          placeholder={t("hint.label")}
          className={INPUT}
        />
      </Field>
      <Field label={t("field.startDate")} error={err("startDate")}>
        <input
          name="startDate"
          type="date"
          defaultValue={values.startDate}
          required
          className={INPUT}
        />
      </Field>
      <Field label={t("field.endDate")} error={err("endDate")}>
        <input
          name="endDate"
          type="date"
          defaultValue={values.endDate}
          required
          className={INPUT}
        />
      </Field>
      <div className="flex gap-2 sm:pt-6">
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-full bg-foreground px-5 text-sm font-medium whitespace-nowrap text-background transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "…" : initial ? t("save") : `+ ${t("create")}`}
        </button>
        {cycleId && (
          <button
            type="button"
            onClick={remove}
            disabled={planCount > 0}
            title={planCount > 0 ? t("errors.hasPlans") : undefined}
            className="h-10 rounded-full px-4 text-sm text-red-700 transition hover:bg-red-500/10 disabled:opacity-40 dark:text-red-400"
          >
            {t("delete")}
          </button>
        )}
      </div>

      {(err("form") || deleteError) && (
        <p role="alert" className="text-sm text-red-700 sm:col-span-5 dark:text-red-400">
          {err("form") ?? t(`errors.${deleteError!}`)}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-sm text-green-800 sm:col-span-5 dark:text-green-300">
          ✓ {initial ? t("saved") : t("created")}
        </p>
      )}
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string | null;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error ? (
        <span className="text-xs text-red-700 dark:text-red-400">{error}</span>
      ) : (
        hint && <span className="text-xs text-foreground/50">{hint}</span>
      )}
    </label>
  );
}

const INPUT =
  "h-10 w-full rounded-lg border border-black/15 bg-transparent px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-white/20";
