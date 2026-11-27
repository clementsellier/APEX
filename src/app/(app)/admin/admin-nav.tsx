"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const LINKS = [
  { href: "/admin", key: "home" },
  { href: "/admin/users", key: "users" },
  { href: "/admin/cycles", key: "cycles" },
  { href: "/admin/map", key: "map" },
] as const;

/** Onglets du back-office. */
export function AdminNav() {
  const t = useTranslations("Admin.nav");
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label={t("label")}
      className="flex w-fit gap-1 rounded-full border border-black/10 p-1 dark:border-white/15"
    >
      {LINKS.map(({ href, key }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(href) ? "page" : undefined}
          className="rounded-full px-4 py-1.5 text-sm text-foreground/60 transition hover:text-foreground aria-[current=page]:bg-foreground aria-[current=page]:text-background"
        >
          {t(key)}
        </Link>
      ))}
    </nav>
  );
}
