import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/dal";
import type { Role } from "@/generated/prisma/enums";

/** Accueil provisoire des espaces qui seront construits plus tard. */
export async function PlaceholderHome({ role }: { role: Role }) {
  const [user, t] = await Promise.all([requireRole(role), getTranslations("Home")]);

  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("hello", { name: user.firstName })}
      </h1>
      <p className="text-foreground/60">{t("comingSoon")}</p>
    </section>
  );
}
