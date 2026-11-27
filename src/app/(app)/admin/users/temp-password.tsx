"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/** Mot de passe provisoire, affiché une seule fois à l'administrateur. */
export function TempPassword({ password, intro }: { password: string; intro: string }) {
  const t = useTranslations("Admin.users");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      // Copie impossible (navigateur ou permissions) : le mot de passe reste visible.
    }
  }

  return (
    <div role="status" className="rounded-2xl border border-green-600/30 bg-green-500/5 p-5">
      <p className="font-medium">{intro}</p>
      <p className="mt-1 text-sm text-foreground/70">{t("tempPassword.intro")}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <code className="rounded-lg border border-black/10 bg-background px-4 py-2 font-mono text-lg tracking-wider select-all dark:border-white/15">
          {password}
        </code>
        <button
          type="button"
          onClick={copy}
          className="rounded-full border border-black/15 px-4 py-2 text-sm transition hover:bg-foreground/5 dark:border-white/20"
        >
          {copied ? `✓ ${t("tempPassword.copied")}` : t("tempPassword.copy")}
        </button>
      </div>
      <p className="mt-3 text-xs text-foreground/60">{t("tempPassword.once")}</p>
    </div>
  );
}
