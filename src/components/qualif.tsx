// Qualifications des PDS (ex. « Potentiel » = « P1 ») affichées en colonnes dans les tableaux.

export type Qualif = { label: string; value: string; color: string | null };

/**
 * Libellés de qualification présents dans un tableau, un par colonne :
 * les plus fréquents d'abord (le potentiel avant une qualification rare), puis par ordre alphabétique.
 */
export function qualifColumns(rows: { qualifs: Qualif[] }[]): string[] {
  const count = new Map<string, number>();
  for (const row of rows)
    for (const q of row.qualifs) count.set(q.label, (count.get(q.label) ?? 0) + 1);
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label]) => label);
}

/** Valeur d'une qualification avec sa pastille de couleur ; tiret si le PDS n'en a pas. */
export function QualifCell({ qualifs, label }: { qualifs: Qualif[]; label: string }) {
  const q = qualifs.find((x) => x.label === label);
  if (!q) return <span className="text-foreground/30">—</span>;
  return (
    <span
      title={`${q.label} : ${q.value}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-2 py-0.5 text-xs font-medium whitespace-nowrap dark:border-white/15"
    >
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: q.color ?? "currentColor" }}
      />
      {q.value}
    </span>
  );
}
