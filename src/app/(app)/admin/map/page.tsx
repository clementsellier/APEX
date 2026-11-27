import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/dal";
import { getAdminMap } from "@/lib/admin-map";
import { AdminMap } from "./admin-map";
import { UgaImport } from "./uga-import";

// Carte des zones : sectorisation des UGA (consultation et modification) et import du référentiel.
export default function AdminMapPage() {
  return (
    <Suspense>
      <AdminMapContent />
    </Suspense>
  );
}

async function AdminMapContent() {
  await requireRole("ADMIN");
  const [{ zones, sectors, withoutShape, total }, t] = await Promise.all([
    getAdminMap(),
    getTranslations("Admin.map"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-foreground/60">{t("intro")}</p>
      </div>
      {zones.length > 0 ? (
        <AdminMap zones={zones} sectors={sectors} />
      ) : (
        <p className="rounded-xl bg-foreground/5 px-4 py-6 text-center text-sm text-foreground/60">
          {t("empty")}
        </p>
      )}
      {withoutShape > 0 && (
        <p className="text-xs text-foreground/50">
          {t("withoutShape", { count: withoutShape, total })}
        </p>
      )}
      <UgaImport />
    </div>
  );
}
