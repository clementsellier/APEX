"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { MANAGER_ROLE, ROLES } from "@/lib/roles";
import type { Role } from "@/generated/prisma/enums";
import type { UserError, UserField, UserFormState } from "./actions";
import { TempPassword } from "./temp-password";

export type UserValues = Record<UserField, string>;
export type ManagerOption = { id: string; name: string; role: Role };

const EMPTY: UserValues = {
  firstName: "",
  lastName: "",
  email: "",
  role: "FIELD_USER",
  status: "ACTIVE",
  locale: "fr",
  team: "",
  primaryRegion: "",
  primaryTerritory: "",
  managerId: "",
};

/** Formulaire de création / modification d'un utilisateur. */
// Après une action, React réinitialise le formulaire. Un <select> revient alors à la valeur
// de son premier rendu : on lui donne une clé qui dépend de la valeur pour le recréer.
export function UserForm({
  action,
  initial,
  managers,
  isSelf = false,
}: {
  action: (prev: UserFormState, formData: FormData) => Promise<UserFormState>;
  initial?: UserValues;
  managers: ManagerOption[];
  /** L'administrateur modifie son propre compte : rôle et statut verrouillés. */
  isSelf?: boolean;
}) {
  const t = useTranslations("Admin.users");
  const tRoles = useTranslations("Roles");
  const tStatus = useTranslations("Admin.status");
  const creating = !initial;
  const [state, formAction, pending] = useActionState(action, {});
  const [role, setRole] = useState<Role>((initial?.role as Role) ?? "FIELD_USER");

  if (state.ok && state.tempPassword) {
    return (
      <div className="flex flex-col gap-4">
        <TempPassword password={state.tempPassword} intro={t("created")} />
        <div className="flex gap-3">
          <Link
            href={`/admin/users/${state.userId}`}
            className="rounded-full border border-black/15 px-4 py-2 text-sm dark:border-white/20"
          >
            {t("viewUser")}
          </Link>
          <Link
            href="/admin/users"
            className="rounded-full bg-foreground px-4 py-2 text-sm text-background"
          >
            {t("backToList")}
          </Link>
        </div>
      </div>
    );
  }

  const values = { ...EMPTY, ...initial, ...(!state.ok ? state.values : undefined) };
  const errors = !state.ok ? (state.errors ?? {}) : {};
  const managerRole = MANAGER_ROLE[role];
  const managerChoices = managers.filter((m) => m.role === managerRole);
  const err = (field: UserField | "form") => {
    const code: UserError | undefined = errors[field];
    return code ? t(`errors.${code}`) : null;
  };

  return (
    <form action={formAction} className="flex max-w-3xl flex-col gap-6" noValidate>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-medium">{t("section.identity")}</legend>
        <Field label={t("field.firstName")} error={err("firstName")}>
          <input name="firstName" defaultValue={values.firstName} required className={INPUT} />
        </Field>
        <Field label={t("field.lastName")} error={err("lastName")}>
          <input name="lastName" defaultValue={values.lastName} required className={INPUT} />
        </Field>
        <Field label={t("field.email")} error={err("email")}>
          <input
            name="email"
            type="email"
            defaultValue={values.email}
            required
            autoComplete="off"
            className={INPUT}
          />
        </Field>
        <Field label={t("field.locale")}>
          <select key={values.locale} name="locale" defaultValue={values.locale} className={INPUT}>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-medium">{t("section.access")}</legend>
        <Field
          label={t("field.role")}
          error={err("role")}
          hint={isSelf ? t("selfLocked") : undefined}
        >
          <select
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            disabled={isSelf}
            className={INPUT}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {tRoles(r)}
              </option>
            ))}
          </select>
          {isSelf && <input type="hidden" name="role" value={role} />}
        </Field>
        <Field label={t("field.status")} error={err("status")}>
          <select
            key={values.status}
            name="status"
            defaultValue={values.status}
            disabled={isSelf || creating}
            className={INPUT}
          >
            <option value="ACTIVE">{tStatus("ACTIVE")}</option>
            <option value="INACTIVE">{tStatus("INACTIVE")}</option>
          </select>
          {(isSelf || creating) && <input type="hidden" name="status" value="ACTIVE" />}
        </Field>
        {managerRole && (
          <Field
            label={t("field.manager", { role: tRoles(managerRole) })}
            error={err("managerId")}
            className="sm:col-span-2"
          >
            <select
              key={`${managerRole}-${values.managerId}`}
              name="managerId"
              defaultValue={
                managerChoices.some((m) => m.id === values.managerId) ? values.managerId : ""
              }
              className={INPUT}
            >
              <option value="">{t("chooseManager")}</option>
              {managerChoices.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 font-medium">{t("section.organisation")}</legend>
        <Field label={t("field.team")} hint={t("hint.team")}>
          <input name="team" defaultValue={values.team} className={INPUT} />
        </Field>
        <Field label={t("field.region")}>
          <input name="primaryRegion" defaultValue={values.primaryRegion} className={INPUT} />
        </Field>
        <Field
          label={`${t("field.territory")}${role === "FIELD_USER" ? " *" : ""}`}
          error={err("primaryTerritory")}
          hint={t("hint.territory")}
        >
          <input name="primaryTerritory" defaultValue={values.primaryTerritory} className={INPUT} />
        </Field>
      </fieldset>

      {err("form") && (
        <p
          role="alert"
          className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400"
        >
          {err("form")}
        </p>
      )}
      {state.ok && !state.tempPassword && (
        <p
          role="status"
          className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-800 dark:text-green-300"
        >
          ✓ {t("saved")}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? t("saving") : creating ? t("create") : t("save")}
        </button>
        <Link
          href="/admin/users"
          className="rounded-full px-4 py-2.5 text-sm text-foreground/70 hover:bg-foreground/5"
        >
          {t("cancel")}
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  className = "",
  children,
}: {
  label: string;
  error?: string | null;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
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
  "h-10 rounded-lg border border-black/15 bg-transparent px-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60 dark:border-white/20 [&>option]:bg-background";
