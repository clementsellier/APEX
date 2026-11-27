"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { reviewPlan } from "./actions";

type Decision = "validate" | "return";

/** Décision du manager : valider le plan, ou le renvoyer au délégué avec un commentaire. */
export function ReviewPanel({
  planId,
  ownerFirstName,
}: {
  planId: string;
  ownerFirstName: string;
}) {
  const t = useTranslations("Review");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<Decision | null>(null);
  const [error, setError] = useState<"failed" | "needComment" | null>(null);

  async function decide(decision: Decision) {
    if (decision === "return" && !comment.trim()) return setError("needComment");
    if (decision === "validate" && !window.confirm(t("confirmValidate", { name: ownerFirstName })))
      return;

    setError(null);
    setBusy(decision);
    const result = await reviewPlan({ planId, decision, comment }).catch(() => ({ ok: false }));
    // En cas de succès, la page est rechargée par le serveur avec le nouveau statut.
    if (!result.ok) {
      setError("failed");
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-5">
      <h2 className="font-medium">{t("title")}</h2>
      <p className="mt-1 text-sm text-foreground/60">{t("intro", { name: ownerFirstName })}</p>

      <label htmlFor="review-comment" className="mt-4 block text-sm font-medium">
        {t("comment")}
      </label>
      <textarea
        id="review-comment"
        value={comment}
        onChange={(e) => {
          setComment(e.target.value);
          if (error === "needComment") setError(null);
        }}
        maxLength={1000}
        rows={3}
        placeholder={t("commentPlaceholder")}
        aria-invalid={error === "needComment"}
        className="mt-1.5 w-full resize-none rounded-lg border border-black/10 bg-background p-3 text-sm outline-none focus:border-foreground/40 aria-invalid:border-red-500 dark:border-white/15"
      />

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
          {t(error)}
        </p>
      )}

      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={() => decide("return")}
          disabled={busy !== null}
          className="rounded-full border border-amber-600/40 px-5 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-500/10 active:scale-95 disabled:opacity-50 dark:text-amber-300"
        >
          {busy === "return" ? "…" : `↩ ${t("return")}`}
        </button>
        <button
          type="button"
          onClick={() => decide("validate")}
          disabled={busy !== null}
          className="rounded-full bg-green-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-green-700 active:scale-95 disabled:opacity-50"
        >
          {busy === "validate" ? "…" : `✓ ${t("validate")}`}
        </button>
      </div>
    </section>
  );
}
