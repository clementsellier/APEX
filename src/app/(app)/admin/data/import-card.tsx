"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ImportKind } from "@/lib/imports";
import { runImport, type ImportResult } from "./actions";

const MAX_ISSUES = 25;

/** Carte d'import : modèle, choix du fichier, analyse (aperçu), puis import. */
export function ImportCard({ kind }: { kind: ImportKind }) {
  const t = useTranslations("Admin.data");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, startBusy] = useTransition();
  const [mode, setMode] = useState<"analyze" | "apply">("analyze");

  function send(apply: boolean) {
    const file = input.current?.files?.[0];
    const data = new FormData();
    if (file) data.set("file", file);
    if (apply) data.set("apply", "1");
    setMode(apply ? "apply" : "analyze");
    startBusy(async () => {
      const r = await runImport(kind, data).catch(() => ({ ok: false, error: "failed" }) as const);
      setResult(r);
      if (r.ok && r.applied !== undefined) router.refresh();
    });
  }

  const preview = result?.ok ? result.preview : null;
  const applied = result?.ok ? result.applied : undefined;
  const errors = preview?.issues.filter((i) => i.severity === "error").length ?? 0;
  const importable = preview ? preview.created + preview.updated : 0;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-surface border-black/10 p-5 dark:border-white/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-medium">{t(`kinds.${kind}.title`)}</h2>
          <p className="text-sm text-foreground/60">{t(`kinds.${kind}.intro`)}</p>
        </div>
        <a
          href={`/api/admin/templates/${kind}`}
          className="rounded-full border border-black/15 px-3 py-1.5 text-xs whitespace-nowrap transition hover:bg-foreground/5 dark:border-white/20"
        >
          ↓ {t("template")}
        </a>
      </div>

      <input
        ref={input}
        type="file"
        accept=".xlsx,.csv"
        aria-label={t("file")}
        onChange={() => setResult(null)}
        className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-foreground/10 file:px-3 file:py-1.5 file:text-sm"
      />

      {result && !result.ok && (
        <p
          role="alert"
          className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400"
        >
          {t(`errors.${result.error}`, { detail: result.detail ?? "" })}
        </p>
      )}

      {preview && (
        <div
          role="status"
          className={`rounded-xl px-4 py-3 text-sm ${applied !== undefined ? "bg-green-500/10" : "bg-foreground/5"}`}
        >
          <p className="font-medium">
            {applied !== undefined ? t("applied", { count: applied }) : t("preview")}
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
            {(["total", "created", "updated", "skipped"] as const).map((k) => (
              <div key={k}>
                <dt className="text-xs text-foreground/60">
                  {t(
                    `counts.${kind === "plans" && k !== "total" && k !== "skipped" ? `plans_${k}` : k}`,
                  )}
                </dt>
                <dd className="text-lg font-semibold tabular-nums">{preview[k]}</dd>
              </div>
            ))}
          </dl>
          {preview.issues.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-foreground/70">
                {t("issuesTitle", { errors, warnings: preview.issues.length - errors })}
              </p>
              <ul className="mt-1 max-h-48 overflow-y-auto text-xs">
                {preview.issues.slice(0, MAX_ISSUES).map((issue, i) => (
                  <li key={i} className="flex gap-2 py-0.5">
                    <span
                      className={
                        issue.severity === "error"
                          ? "text-red-700 dark:text-red-400"
                          : "text-amber-700 dark:text-amber-300"
                      }
                    >
                      {issue.severity === "error" ? "✕" : "⚠"}
                    </span>
                    {issue.line > 0 && (
                      <span className="text-foreground/50 tabular-nums">
                        {t("line", { line: issue.line })}
                      </span>
                    )}
                    <span>{t(`issues.${issue.code}`, { value: issue.value ?? "" })}</span>
                  </li>
                ))}
              </ul>
              {preview.issues.length > MAX_ISSUES && (
                <p className="mt-1 text-xs text-foreground/50">
                  {t("moreIssues", { count: preview.issues.length - MAX_ISSUES })}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => send(false)}
          disabled={busy}
          className="rounded-full border border-black/15 px-4 py-2 text-sm transition hover:bg-foreground/5 disabled:opacity-50 dark:border-white/20"
        >
          {busy && mode === "analyze" ? t("analyzing") : t("analyze")}
        </button>
        {preview && applied === undefined && importable > 0 && (
          <button
            type="button"
            onClick={() => send(true)}
            disabled={busy}
            className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {busy && mode === "apply" ? t("importing") : t("apply", { count: importable })}
          </button>
        )}
      </div>
    </section>
  );
}
