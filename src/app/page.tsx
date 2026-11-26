import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { db } from "@/lib/db";

// Page provisoire : vérifie que l'environnement (Next.js, i18n, base) fonctionne.
// Elle sera remplacée par l'écran de connexion puis l'accueil du délégué.
export default function Home() {
  return (
    <Suspense fallback={<main className="flex-1" />}>
      <StatusPage />
    </Suspense>
  );
}

async function StatusPage() {
  const t = await getTranslations();

  let stats: { users: number; accounts: number; plans: number; targets: number } | null = null;
  let plans: { name: string; status: string }[] = [];
  try {
    const [users, accounts, planCount, targets, planList] = await Promise.all([
      db.user.count(),
      db.account.count(),
      db.plan.count(),
      db.target.count(),
      db.plan.findMany({ select: { name: true, status: true }, orderBy: { name: "asc" } }),
    ]);
    stats = { users, accounts, plans: planCount, targets };
    plans = planList;
  } catch {
    stats = null;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-16">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t("App.name")}</h1>
          <p className="text-foreground/60">{t("App.tagline")}</p>
        </div>
        <LocaleSwitcher />
      </header>

      <section className="rounded-2xl border border-black/10 p-6 dark:border-white/15">
        <h2 className="mb-4 font-medium">{t("Status.title")}</h2>
        {stats ? (
          <>
            <p className="mb-6 text-sm text-green-700 dark:text-green-400">● {t("Status.ready")}</p>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {(Object.keys(stats) as (keyof typeof stats)[]).map((key) => (
                <div key={key} className="rounded-xl bg-foreground/5 p-4">
                  <dt className="text-xs text-foreground/60">{t(`Status.${key}`)}</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{stats[key]}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-6 space-y-2 text-sm">
              {plans.map((p) => (
                <li
                  key={p.name}
                  className="flex justify-between border-t border-black/5 pt-2 dark:border-white/10"
                >
                  <span className="font-mono">{p.name}</span>
                  <span className="text-foreground/60">
                    {t(`Plan.status.${p.status as "ACTIVE"}`)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-red-700 dark:text-red-400">● {t("Status.unreachable")}</p>
        )}
      </section>
    </main>
  );
}
