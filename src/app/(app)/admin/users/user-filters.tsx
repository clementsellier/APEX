"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ROLES } from "@/lib/roles";

/** Filtres de la liste, reflétés dans l'URL (partageable, conservée au retour arrière). */
export function UserFilters({ q, role, status }: { q: string; role: string; status: string }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(q);

  function apply(next: { q?: string; role?: string; status?: string }) {
    const params = new URLSearchParams();
    const merged = { q: query, role, status, ...next };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    startTransition(() => router.replace(params.size ? `${pathname}?${params}` : pathname));
  }

  // Recherche lancée après une courte pause de frappe.
  useEffect(() => {
    if (query === q) return;
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
        placeholder={t("Admin.users.search")}
        aria-label={t("Admin.users.search")}
        className={`${field} min-w-56 flex-1`}
      />
      <select
        value={role}
        onChange={(e) => apply({ role: e.target.value })}
        aria-label={t("Admin.users.col.role")}
        className={field}
      >
        <option value="">{t("Admin.users.allRoles")}</option>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {t(`Roles.${r}`)}
          </option>
        ))}
      </select>
      <select
        value={status}
        onChange={(e) => apply({ status: e.target.value })}
        aria-label={t("Admin.users.col.status")}
        className={field}
      >
        <option value="">{t("Admin.users.allStatuses")}</option>
        <option value="ACTIVE">{t("Admin.status.ACTIVE")}</option>
        <option value="INACTIVE">{t("Admin.status.INACTIVE")}</option>
      </select>
    </div>
  );
}
