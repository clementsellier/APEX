// Import des qualifications des PDS (ex. « Potentiel » = « P1 ») par équipe.

import type { Column } from "./table";
import { preview, type ImportIssue, type Importer } from "./types";

const columns: Column[] = [
  {
    key: "crmId",
    headers: ["CRM_ID", "ID_CRM"],
    required: true,
    help: "Identifiant CRM du PDS (déjà importé).",
    example: "CRM-A-3001",
  },
  {
    key: "team",
    headers: ["EQUIPE", "TEAM"],
    required: true,
    help: "Équipe concernée.",
    example: "FRONCO",
  },
  {
    key: "label",
    headers: ["LIBELLE", "LABEL", "QUALIFICATION"],
    required: true,
    help: "Nom de la qualification.",
    example: "Potentiel",
  },
  {
    key: "value",
    headers: ["VALEUR", "VALUE"],
    required: true,
    help: "Valeur. Vide = supprime la qualification.",
    example: "P1",
  },
  {
    key: "color",
    headers: ["COULEUR", "COLOR"],
    help: "Couleur hexadécimale (#RRGGBB).",
    example: "#2E7D32",
  },
];

export type QualifItem = {
  exists: boolean;
  accountId: string;
  team: string;
  label: string;
  value: string | null;
  color: string | null;
};

export const qualifsImporter: Importer<QualifItem> = {
  columns,
  async analyze({ db }, rows) {
    const issues: ImportIssue[] = [];
    const accounts = await db.account.findMany({
      where: { crmId: { in: rows.map((r) => r.values.crmId).filter(Boolean) } },
      select: { id: true, crmId: true, qualifs: { select: { team: true, label: true } } },
    });
    const byCrm = new Map(accounts.map((a) => [a.crmId!, a]));
    const seen = new Set<string>();
    const items: QualifItem[] = [];

    for (const { line, values: v } of rows) {
      const err = (code: string, value?: string) =>
        issues.push({ line, severity: "error", code, value });
      const account = byCrm.get(v.crmId);
      if (!account) {
        err("unknownAccount", v.crmId);
        continue;
      }
      if (!v.team || !v.label) {
        err("missingField");
        continue;
      }
      const color = v.color
        ? (v.color.startsWith("#") ? v.color : `#${v.color}`).toUpperCase()
        : null;
      if (color && !/^#[0-9A-F]{6}$/.test(color)) {
        err("invalidColor", v.color);
        continue;
      }
      const key = `${account.id}|${v.team}|${v.label}`;
      if (seen.has(key)) {
        err("duplicate", `${v.crmId} · ${v.label}`);
        continue;
      }
      seen.add(key);
      items.push({
        exists: account.qualifs.some((q) => q.team === v.team && q.label === v.label),
        accountId: account.id,
        team: v.team,
        label: v.label,
        value: v.value || null,
        color,
      });
    }
    return { preview: preview(rows.length, items, issues), items };
  },

  async apply({ db }, items) {
    await db.$transaction(
      items.map((q) => {
        const where = {
          team_accountId_label: { team: q.team, accountId: q.accountId, label: q.label },
        };
        return q.value
          ? db.accountQualif.upsert({
              where,
              create: {
                team: q.team,
                accountId: q.accountId,
                label: q.label,
                value: q.value,
                color: q.color,
              },
              update: { value: q.value, color: q.color },
            })
          : db.accountQualif.deleteMany({
              where: { team: q.team, accountId: q.accountId, label: q.label },
            });
      }),
    );
    return items.length;
  },
};
