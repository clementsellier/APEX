import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/dal";
import { getManagerOptions } from "@/lib/admin-users";
import { createUser } from "../actions";
import { UserForm } from "../user-form";

export default function NewUserPage() {
  return (
    <Suspense>
      <NewUserContent />
    </Suspense>
  );
}

async function NewUserContent() {
  await requireRole("ADMIN");
  const [managers, t] = await Promise.all([getManagerOptions(), getTranslations("Admin.users")]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/users" className="text-sm text-foreground/60 hover:text-foreground">
          ← {t("backToList")}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{t("new")}</h1>
      </div>
      <UserForm action={createUser} managers={managers} />
    </div>
  );
}
