// Import des PDS (comptes) : clé = identifiant CRM. Réimporter un fichier met les comptes à jour.

import type { AccountType } from "../../generated/prisma/enums";
import type { Column } from "./table";
import { preview, type ImportIssue, type Importer } from "./types";

const columns: Column[] = [
  {
    key: "crmId",
    headers: ["CRM_ID", "ID_CRM", "ID"],
    required: true,
    help: "Identifiant du compte dans le CRM (clé unique).",
    example: "CRM-A-3001",
  },
  {
    key: "type",
    headers: ["TYPE"],
    help: "HCP (professionnel de santé) ou PHARMACIE. Par défaut : HCP.",
    example: "HCP",
  },
  { key: "title", headers: ["TITRE", "TITLE"], help: "Dr, Pr…", example: "Dr" },
  { key: "firstName", headers: ["PRENOM", "FIRST_NAME"], help: "Prénom.", example: "Camille" },
  {
    key: "lastName",
    headers: ["NOM", "LAST_NAME"],
    help: "Nom (ou nom de la pharmacie).",
    example: "ROUSSEL",
  },
  {
    key: "name",
    headers: ["NOM_AFFICHE", "DISPLAY_NAME"],
    help: "Nom affiché. Par défaut : titre + prénom + nom.",
    example: "",
  },
  {
    key: "specialty",
    headers: ["SPECIALITE", "SPECIALTY"],
    help: "Spécialité.",
    example: "Cardiologue",
  },
  {
    key: "workplace",
    headers: ["LIEU", "ETABLISSEMENT", "WORKPLACE"],
    help: "Lieu d'exercice.",
    example: "CHU Besançon",
  },
  {
    key: "brick",
    headers: ["UGA", "BRICK"],
    help: "Code de l'UGA (doit exister dans le référentiel).",
    example: "25BES",
  },
  {
    key: "line1",
    headers: ["ADRESSE", "ADDRESS"],
    help: "Adresse principale.",
    example: "3 boulevard Fleming",
  },
  {
    key: "postalCode",
    headers: ["CP", "CODE_POSTAL", "POSTAL_CODE"],
    help: "Code postal.",
    example: "25000",
  },
  { key: "city", headers: ["VILLE", "CITY"], help: "Ville.", example: "Besançon" },
  {
    key: "lat",
    headers: ["LATITUDE", "LAT"],
    help: "Latitude (degrés décimaux).",
    example: "47.2253",
  },
  {
    key: "lng",
    headers: ["LONGITUDE", "LNG", "LON"],
    help: "Longitude (degrés décimaux).",
    example: "5.9506",
  },
];

export type AccountItem = {
  exists: boolean;
  crmId: string;
  data: {
    type: AccountType;
    title: string | null;
    firstName: string | null;
    lastName: string | null;
    name: string;
    specialty: string | null;
    workplace: string | null;
    brickCode: string | null;
  };
  address: {
    line1: string;
    postalCode: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
};

const nil = (v: string | undefined) => (v ? v : null);
const number = (v: string | undefined) => (v ? Number(v.replace(",", ".")) : null);

export const accountsImporter: Importer<AccountItem> = {
  columns,
  async analyze({ db }, rows) {
    const issues: ImportIssue[] = [];
    const [bricks, existing] = await Promise.all([
      db.brick.findMany({ select: { code: true } }),
      db.account.findMany({
        where: { crmId: { in: rows.map((r) => r.values.crmId).filter(Boolean) } },
        select: { crmId: true },
      }),
    ]);
    const brickCodes = new Set(bricks.map((b) => b.code));
    const known = new Set(existing.map((a) => a.crmId));
    const seen = new Set<string>();
    const items: AccountItem[] = [];

    for (const { line, values: v } of rows) {
      const err = (code: string, value?: string) =>
        issues.push({ line, severity: "error", code, value });
      if (!v.crmId) {
        err("missingCrmId");
        continue;
      }
      if (seen.has(v.crmId)) {
        err("duplicate", v.crmId);
        continue;
      }
      seen.add(v.crmId);

      const typeRaw = (v.type ?? "").toUpperCase();
      const type: AccountType | null =
        !typeRaw || typeRaw === "HCP" ? "HCP" : typeRaw.startsWith("PHARMA") ? "PHARMACY" : null;
      if (!type) {
        err("invalidType", v.type);
        continue;
      }
      const name =
        v.name ||
        (type === "PHARMACY"
          ? v.lastName
          : [v.title, v.firstName, v.lastName].filter(Boolean).join(" "));
      if (!name) {
        err("missingName");
        continue;
      }
      const brick = v.brick?.toUpperCase();
      if (brick && !brickCodes.has(brick)) {
        err("unknownBrick", brick);
        continue;
      }
      const lat = number(v.lat);
      const lng = number(v.lng);
      if (
        (lat !== null && (!Number.isFinite(lat) || Math.abs(lat) > 90)) ||
        (lng !== null && (!Number.isFinite(lng) || Math.abs(lng) > 180))
      ) {
        err("invalidCoordinates", `${v.lat ?? ""} ${v.lng ?? ""}`);
        continue;
      }
      if (!brick) issues.push({ line, severity: "warning", code: "noBrick" });

      items.push({
        exists: known.has(v.crmId),
        crmId: v.crmId,
        data: {
          type,
          title: nil(v.title),
          firstName: nil(v.firstName),
          lastName: nil(v.lastName),
          name,
          specialty: nil(v.specialty),
          workplace: nil(v.workplace),
          brickCode: brick || null,
        },
        address:
          v.line1 || v.city || lat !== null
            ? {
                line1: v.line1 || v.workplace || name,
                postalCode: nil(v.postalCode),
                city: nil(v.city),
                latitude: lat,
                longitude: lng,
              }
            : null,
      });
    }
    return { preview: preview(rows.length, items, issues), items };
  },

  async apply({ db }, items) {
    for (let i = 0; i < items.length; i += 100) {
      await db.$transaction(async (tx) => {
        for (const item of items.slice(i, i + 100)) {
          const account = await tx.account.upsert({
            where: { crmId: item.crmId },
            create: { crmId: item.crmId, ...item.data },
            update: item.data,
            select: { id: true },
          });
          if (item.address) {
            // L'adresse principale est remplacée ; les adresses secondaires sont conservées.
            await tx.address.deleteMany({ where: { accountId: account.id, isPrimary: true } });
            await tx.address.create({
              data: { accountId: account.id, isPrimary: true, ...item.address },
            });
          }
        }
      });
    }
    return items.length;
  },
};
