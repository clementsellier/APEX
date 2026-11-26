"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { login, type LoginState } from "./actions";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const t = useTranslations("Login");
  const [state, action, pending] = useActionState<LoginState, FormData>(login, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t("email")}</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="rounded-lg border border-black/15 bg-background px-3 py-2.5 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-white/20"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t("password")}</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-lg border border-black/15 bg-background px-3 py-2.5 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-white/20"
        />
      </label>

      {state?.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400"
        >
          {t("invalid")}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60"
      >
        {pending ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
