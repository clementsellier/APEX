import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/dal";
import { db } from "@/lib/db";
import { IMPORT_KINDS } from "@/lib/imports";
import { ExportCard } from "./export-card";
import { ImportCard } from "./import-card";

// Données : imports (PDS, qualifications, utilisateurs, plans) et export des plans validés.
export default function DataPage() {
  return (
    <Suspense>
      <DataContent />
    </Suspense>
  );
}

async function DataContent() {
  await requireRole("ADMIN");
  const [t, cycles] = await Promise.all([
    getTranslations("Admin.data"),
    db.cycle.findMany({ select: { code: true }, orderBy: { startDate: "desc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-foreground/60">{t("intro")}</p>
      </div>
      <ExportCard cycles={cycles.map((c) => c.code)} />
      <div className="grid gap-4 lg:grid-cols-2">
        {IMPORT_KINDS.map((kind) => (
          <ImportCard key={kind} kind={kind} />
        ))}
      </div>
    </div>
  );
}
