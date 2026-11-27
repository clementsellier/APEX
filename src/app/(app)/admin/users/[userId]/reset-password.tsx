"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { resetPassword } from "../actions";
import { TempPassword } from "../temp-password";

/** Réinitialisation du mot de passe : un nouveau mot de passe provisoire est généré. */
export function ResetPassword({ userId, name }: { userId: string; name: string }) {
  const t = useTranslations("Admin.users.reset");
  const [password, setPassword] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "pending" | "failed">("idle");

  async function reset() {
    if (!window.confirm(t("confirm", { name }))) return;
    setState("pending");
    const result = await resetPassword(userId).catch(() => ({}) as { tempPassword?: string });
    if (result.tempPassword) {
      setPassword(result.tempPassword);
      setState("idle");
    } else setState("failed");
  }

  return (
    <section className="max-w-3xl border-t border-black/10 pt-6 dark:border-white/10">
      <h2 className="font-medium">{t("title")}</h2>
      {password ? (
        <div className="mt-3">
          <TempPassword password={password} intro={t("done", { name })} />
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-foreground/60">{t("intro")}</p>
          <button
            type="button"
            onClick={reset}
            disabled={state === "pending"}
            className="mt-3 rounded-full border border-amber-600/40 px-4 py-2 text-sm text-amber-800 transition hover:bg-amber-500/10 disabled:opacity-60 dark:text-amber-300"
          >
            {state === "pending" ? "…" : t("button")}
          </button>
          {state === "failed" && (
            <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
              {t("failed")}
            </p>
          )}
        </>
      )}
    </section>
  );
}
