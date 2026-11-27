"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/** Export des plans pour le CRM : choix du cycle et du périmètre, puis téléchargement. */
export function ExportCard({ cycles }: { cycles: string[] }) {
  const t = useTranslations("Admin.data.export");
  const [cycle, setCycle] = useState(cycles[0] ?? "");
  const [all, setAll] = useState(false);

  const params = new URLSearchParams();
  if (cycle) params.set("cycle", cycle);
  if (all) params.set("status", "all");
  const href = `/api/admin/export/plans${params.size ? `?${params}` : ""}`;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-5">
      <div>
        <h2 className="font-medium">{t("title")}</h2>
        <p className="text-sm text-foreground/60">{t("intro")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <select
          value={cycle}
          onChange={(e) => setCycle(e.target.value)}
          aria-label={t("cycle")}
          className="h-10 rounded-lg border border-black/10 bg-transparent px-3 text-sm outline-none dark:border-white/15 [&>option]:bg-background"
        >
          <option value="">{t("allCycles")}</option>
          {cycles.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
          {t("includeAll")}
        </label>
        <a
          href={href}
          className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition hover:opacity-90"
        >
          ↓ {t("download")}
        </a>
      </div>
    </section>
  );
}
