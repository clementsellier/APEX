import { Suspense } from "react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { isRole } from "@/lib/roles";
import type { Prisma } from "@/generated/prisma/client";
import { UserFilters } from "./user-filters";

// Liste des utilisateurs, filtrable par texte, rôle et statut (paramètres d'URL).
export default function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <Suspense>
      <UsersContent searchParams={searchParams} />
    </Suspense>
  );
}

const ROLE_STYLE = {
  FIELD_USER: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  FIELD_MANAGER: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
  TEAM_MANAGER: "bg-amber-500/10 text-amber-800 dark:text-amber-300",
  HQ_USER: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  ADMIN: "bg-foreground/10 text-foreground/80",
} as const;

async function UsersContent({
  searchParams,
}: {
  searchParams: PageProps<"/admin/users">["searchParams"];
}) {
  await requireRole("ADMIN");
  const [params, t, format] = await Promise.all([searchParams, getTranslations(), getFormatter()]);
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = one(params.q).trim();
  const role = one(params.role);
  const status = one(params.status);

  const where: Prisma.UserWhereInput = {
    ...(isRole(role) && { role }),
    ...((status === "ACTIVE" || status === "INACTIVE") && { status }),
    ...(q && {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { primaryTerritory: { contains: q, mode: "insensitive" } },
      ],
    }),
  };

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        team: true,
        primaryTerritory: true,
        lastLoginAt: true,
        manager: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ status: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
    }),
    db.user.count(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("Admin.users.title")}</h1>
          <p className="text-sm text-foreground/60">
            {t("Admin.users.count", { shown: users.length, total })}
          </p>
        </div>
        <Link
          href="/admin/users/new"
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
        >
          + {t("Admin.users.new")}
        </Link>
      </div>

      <UserFilters q={q} role={role} status={status} />

      <div className="overflow-x-auto rounded-2xl border bg-surface border-black/10 dark:border-white/10">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-foreground/5 text-foreground/60">
            <tr>
              <th className="px-4 py-3 font-medium">{t("Admin.users.col.name")}</th>
              <th className="px-4 py-3 font-medium">{t("Admin.users.col.role")}</th>
              <th className="px-4 py-3 font-medium">{t("Admin.users.col.manager")}</th>
              <th className="px-4 py-3 font-medium">{t("Admin.users.col.territory")}</th>
              <th className="px-4 py-3 font-medium">{t("Admin.users.col.status")}</th>
              <th className="px-4 py-3 font-medium">{t("Admin.users.col.lastLogin")}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className={`border-t border-black/5 transition-colors hover:bg-foreground/[0.03] dark:border-white/10 ${
                  u.status === "INACTIVE" ? "text-foreground/50" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">
                    {u.firstName} {u.lastName}
                  </Link>
                  <div className="text-xs text-foreground/60">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_STYLE[u.role]}`}
                  >
                    {t(`Roles.${u.role}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-foreground/70">
                  {u.manager ? `${u.manager.firstName} ${u.manager.lastName}` : "—"}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-foreground/70">
                  {[u.team, u.primaryTerritory].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <span
                      className={`h-2 w-2 rounded-full ${u.status === "ACTIVE" ? "bg-green-500" : "bg-foreground/30"}`}
                    />
                    {t(`Admin.status.${u.status}`)}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs whitespace-nowrap text-foreground/60">
                  {u.lastLoginAt
                    ? format.relativeTime(u.lastLoginAt, new Date())
                    : t("Admin.users.never")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="px-4 py-10 text-center text-foreground/60">{t("Admin.users.empty")}</p>
        )}
      </div>
    </div>
  );
}
