"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { importUga, type ImportResult } from "./actions";

/**
 * Import du référentiel UGA en deux temps : analyse (aperçu des changements), puis import.
 * Les fichiers restent dans le navigateur entre les deux étapes et sont renvoyés à l'import.
 */
export function UgaImport() {
  const t = useTranslations("Admin.map.import");
  const router = useRouter();
  const geo = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, startBusy] = useTransition();

  function send(apply: boolean) {
    const data = new FormData();
    const g = geo.current?.files?.[0];
    const l = list.current?.files?.[0];
    if (g) data.set("geo", g);
    if (l) data.set("list", l);
    if (apply) data.set("apply", "1");
    startBusy(async () => {
      const r = await importUga(data).catch(() => ({ ok: false, error: "failed" }) as const);
      setResult(r);
      if (r.ok && r.applied !== undefined) router.refresh();
    });
  }

  const plan = result?.ok ? result.plan : null;
  const applied = result?.ok && result.applied !== undefined;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-black/10 p-5 dark:border-white/10">
      <div>
        <h2 className="font-medium">{t("title")}</h2>
        <p className="text-sm text-foreground/60">{t("intro")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t("geo")}</span>
          <input
            ref={geo}
            type="file"
            accept=".json,.geojson,application/geo+json,application/json"
            onChange={() => setResult(null)}
            className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-foreground/10 file:px-3 file:py-1.5 file:text-sm"
          />
          <span className="text-xs text-foreground/50">{t("geoHint")}</span>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t("list")}</span>
          <input
            ref={list}
            type="file"
            accept=".xlsx"
            onChange={() => setResult(null)}
            className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-foreground/10 file:px-3 file:py-1.5 file:text-sm"
          />
          <span className="text-xs text-foreground/50">{t("listHint")}</span>
        </label>
      </div>

      {result && !result.ok && (
        <p
          role="alert"
          className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400"
        >
          {t(`errors.${result.error}`)}
        </p>
      )}

      {plan && (
        <div
          role="status"
          className={`rounded-xl px-4 py-3 text-sm ${applied ? "bg-green-500/10" : "bg-foreground/5"}`}
        >
          <p className="font-medium">
            {applied ? t("applied", { count: result.ok ? result.applied! : 0 }) : t("preview")}
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-foreground/80">
            <li>{t("total", { count: plan.total })}</li>
            {plan.shapes > 0 && <li>{t("shapes", { count: plan.shapes })}</li>}
            <li>{t("created", { count: plan.created.length })}</li>
            <li>{t("moved", { count: plan.moved.length })}</li>
            {plan.withoutShape.length > 0 && (
              <li>
                {t("withoutShape", {
                  count: plan.withoutShape.length,
                  codes: plan.withoutShape.slice(0, 8).join(", "),
                })}
              </li>
            )}
            {plan.sectors.length > 0 && (
              <li>
                {t("sectors")} {plan.sectors.map((s) => `${s.code} (${s.count})`).join(" · ")}
              </li>
            )}
          </ul>
          {plan.movedWithPlans.length > 0 && (
            <p className="mt-2 text-amber-800 dark:text-amber-300">
              ⚠ {t("movedWithPlans", { codes: plan.movedWithPlans.join(", ") })}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => send(false)}
          disabled={busy}
          className="rounded-full border border-black/15 px-4 py-2 text-sm transition hover:bg-foreground/5 disabled:opacity-50 dark:border-white/20"
        >
          {busy && !plan ? t("analyzing") : t("analyze")}
        </button>
        {plan && !applied && (
          <button
            type="button"
            onClick={() => send(true)}
            disabled={busy}
            className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? t("importing") : t("apply")}
          </button>
        )}
      </div>
    </section>
  );
}
