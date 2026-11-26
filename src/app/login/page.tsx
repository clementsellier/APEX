import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { LoginForm } from "./login-form";

// Comptes du seed, affichés uniquement en développement pour faciliter les tests.
const DEMO_ACCOUNTS = [
  ["arnaud@apex.local", "FIELD_USER"],
  ["manager@apex.local", "FIELD_MANAGER"],
  ["team.manager@apex.local", "TEAM_MANAGER"],
  ["hq@apex.local", "HQ_USER"],
  ["admin@apex.local", "ADMIN"],
] as const;

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-br from-indigo-50 via-background to-sky-50 px-4 py-12 dark:from-indigo-950/40 dark:to-sky-950/30">
      <Suspense>
        <LoginCard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LoginCard({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const t = await getTranslations();
  const { callbackUrl } = await searchParams;

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex justify-end">
        <LocaleSwitcher />
      </div>
      <div className="rounded-2xl border border-black/10 bg-background/80 p-8 shadow-xl shadow-indigo-500/5 backdrop-blur dark:border-white/10">
        <h1 className="text-3xl font-semibold tracking-tight">{t("App.name")}</h1>
        <p className="mb-8 text-foreground/60">{t("App.tagline")}</p>
        <LoginForm callbackUrl={typeof callbackUrl === "string" ? callbackUrl : undefined} />
      </div>

      {process.env.NODE_ENV === "development" && (
        <details className="mt-6 text-sm text-foreground/70">
          <summary className="cursor-pointer">{t("Login.demoAccounts")}</summary>
          <ul className="mt-2 space-y-1">
            {DEMO_ACCOUNTS.map(([email, role]) => (
              <li key={email} className="flex justify-between gap-4">
                <span className="font-mono">{email}</span>
                <span>{t(`Roles.${role}`)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs">{t("Login.demoHint")}</p>
        </details>
      )}
    </div>
  );
}
