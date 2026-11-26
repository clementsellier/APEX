import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { getCurrentUser } from "@/lib/dal";
import { logout } from "./actions";

// Cadre commun des espaces connectés. La session est lue dans un composant sous <Suspense>,
// pas en haut du layout, pour ne pas bloquer le rendu des pages enfants.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-black/10 dark:border-white/10">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <span className="text-lg font-semibold tracking-tight">APEX</span>
          <div className="flex items-center gap-3">
            <Suspense fallback={<div className="h-9 w-40" />}>
              <UserMenu />
            </Suspense>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

async function UserMenu() {
  const [user, t] = await Promise.all([getCurrentUser(), getTranslations()]);

  return (
    <>
      <div className="hidden text-right text-sm leading-tight sm:block">
        <div className="font-medium">{user.name}</div>
        <div className="text-foreground/60">{t(`Roles.${user.role}`)}</div>
      </div>
      <LocaleSwitcher />
      <form action={logout}>
        <button
          type="submit"
          className="rounded-full border border-black/10 px-3 py-1.5 text-sm transition hover:bg-foreground/5 dark:border-white/15"
        >
          {t("Nav.signOut")}
        </button>
      </form>
    </>
  );
}
