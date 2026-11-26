import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";

// Accueil du manager terrain : plans de ses délégués avec leur statut.
export default function ManagerHome() {
  return (
    <Suspense>
      <ManagerHomeContent />
    </Suspense>
  );
}

async function ManagerHomeContent() {
  const user = await requireRole("FIELD_MANAGER");
  const t = await getTranslations();

  const plans = await db.plan.findMany({
    where: { owner: { managerId: user.id } },
    select: {
      id: true,
      name: true,
      status: true,
      owner: { select: { firstName: true, lastName: true } },
      _count: { select: { targets: true } },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("Home.hello", { name: user.firstName })}
      </h1>

      <section>
        <h2 className="mb-4 text-lg font-medium">{t("Manager.title")}</h2>
        {plans.length === 0 ? (
          <p className="text-foreground/60">{t("Manager.empty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-foreground/5 text-foreground/60">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("Manager.plan")}</th>
                  <th className="px-4 py-3 font-medium">{t("Manager.owner")}</th>
                  <th className="px-4 py-3 font-medium">{t("Manager.status")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("Manager.targets")}</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} className="border-t border-black/5 dark:border-white/10">
                    <td className="px-4 py-3 font-mono">{p.name}</td>
                    <td className="px-4 py-3">
                      {p.owner.firstName} {p.owner.lastName}
                    </td>
                    <td className="px-4 py-3">{t(`Plan.status.${p.status}`)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{p._count.targets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
