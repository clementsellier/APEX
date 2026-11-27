"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type Filters = { cycle: string; status: string; manager: string; q: string };

/** Filtres de la vue d'ensemble, reflétés dans l'URL. */
export function OverviewFilters({
  filters,
  cycles,
  managers,
  statuses,
}: {
  filters: Filters;
  cycles: string[];
  managers: { id: string; name: string }[];
  statuses: readonly string[];
}) {
  const t = useTranslations("Overview.filter");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.q);

  function apply(next: Partial<Filters>) {
    const params = new URLSearchParams();
    const merged = { ...filters, q: query, ...next };
    for (const [k, v] of Object.entries(merged)) {
      if (v && !(k === "status" && v === "validated")) params.set(k, v);
    }
    startTransition(() => router.replace(params.size ? `${pathname}?${params}` : pathname));
  }

  useEffect(() => {
    if (query === filters.q) return;
    const timer = setTimeout(() => apply({ q: query }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const field =
    "h-10 rounded-lg border border-black/10 bg-transparent px-3 text-sm outline-none focus:border-foreground/40 dark:border-white/15 [&>option]:bg-background";

  return (
    <div className={`flex flex-wrap gap-3 transition-opacity ${pending ? "opacity-60" : ""}`}>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("search")}
        aria-label={t("search")}
        className={`${field} min-w-56 flex-1`}
      />
      <select
        value={filters.status}
        onChange={(e) => apply({ status: e.target.value })}
        aria-label={t("status")}
        className={field}
      >
        {statuses.map((s) => (
          <option key={s} value={s}>
            {t(`statuses.${s}`)}
          </option>
        ))}
      </select>
      <select
        value={filters.cycle}
        onChange={(e) => apply({ cycle: e.target.value })}
        aria-label={t("cycle")}
        className={field}
      >
        <option value="">{t("allCycles")}</option>
        {cycles.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {managers.length > 1 && (
        <select
          value={filters.manager}
          onChange={(e) => apply({ manager: e.target.value })}
          aria-label={t("manager")}
          className={field}
        >
          <option value="">{t("allManagers")}</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
