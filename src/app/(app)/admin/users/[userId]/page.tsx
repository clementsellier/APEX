import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { getManagerOptions } from "@/lib/admin-users";
import { updateUser } from "../actions";
import { UserForm } from "../user-form";
import { ResetPassword } from "./reset-password";

export default function EditUserPage({ params }: PageProps<"/admin/users/[userId]">) {
  return (
    <Suspense>
      <EditUserContent params={params} />
    </Suspense>
  );
}

async function EditUserContent({
  params,
}: {
  params: PageProps<"/admin/users/[userId]">["params"];
}) {
  const admin = await requireRole("ADMIN");
  const { userId } = await params;
  const [user, managers, t, format] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        locale: true,
        team: true,
        primaryRegion: true,
        primaryTerritory: true,
        managerId: true,
        lastLoginAt: true,
        lastLoginSuccess: true,
        createdAt: true,
        _count: { select: { plans: true } },
        reports: {
          where: { status: "ACTIVE" },
          select: { id: true, firstName: true, lastName: true },
          orderBy: { lastName: "asc" },
        },
      },
    }),
    getManagerOptions(),
    getTranslations("Admin.users"),
    getFormatter(),
  ]);
  if (!user) notFound();

  const date = (d: Date) => format.dateTime(d, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/users" className="text-sm text-foreground/60 hover:text-foreground">
          ← {t("backToList")}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          {user.firstName} {user.lastName}
        </h1>
        <p className="text-sm text-foreground/60">
          {t("createdOn", { date: format.dateTime(user.createdAt, { dateStyle: "long" }) })} ·{" "}
          {user.lastLoginAt
            ? t(user.lastLoginSuccess ? "lastLoginOk" : "lastLoginFailed", {
                date: date(user.lastLoginAt),
              })
            : t("neverLoggedIn")}{" "}
          · {t("plans", { count: user._count.plans })}
        </p>
      </div>

      {user.reports.length > 0 && (
        <p className="max-w-3xl rounded-xl bg-foreground/5 px-4 py-3 text-sm">
          {t("reports", { count: user.reports.length })}{" "}
          {user.reports.map((r, i) => (
            <span key={r.id}>
              {i > 0 && ", "}
              <Link href={`/admin/users/${r.id}`} className="underline-offset-4 hover:underline">
                {r.firstName} {r.lastName}
              </Link>
            </span>
          ))}
        </p>
      )}

      <UserForm
        action={updateUser.bind(null, user.id)}
        managers={managers}
        isSelf={user.id === admin.id}
        initial={{
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          status: user.status,
          locale: user.locale,
          team: user.team ?? "",
          primaryRegion: user.primaryRegion ?? "",
          primaryTerritory: user.primaryTerritory ?? "",
          managerId: user.managerId ?? "",
        }}
      />

      <ResetPassword userId={user.id} name={user.firstName} />
    </div>
  );
}
