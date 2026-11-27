// Import des utilisateurs : clé = e-mail. Les comptes créés n'ont pas de mot de passe :
// l'administrateur en génère un provisoire depuis la fiche (aucun fichier de mots de passe ne circule).

import type { Locale, Role, UserStatus } from "../../generated/prisma/enums";
import { MANAGER_ROLE } from "../roles";
import { normalizeHeader, type Column } from "./table";
import { preview, type ImportIssue, type Importer } from "./types";

const columns: Column[] = [
  {
    key: "email",
    headers: ["EMAIL", "E_MAIL", "MAIL"],
    required: true,
    help: "Adresse e-mail (clé unique).",
    example: "lea.petit@exemple.fr",
  },
  {
    key: "firstName",
    headers: ["PRENOM", "FIRST_NAME"],
    required: true,
    help: "Prénom.",
    example: "Léa",
  },
  {
    key: "lastName",
    headers: ["NOM", "LAST_NAME"],
    required: true,
    help: "Nom.",
    example: "PETIT",
  },
  {
    key: "role",
    headers: ["ROLE"],
    required: true,
    help: "DELEGUE, MANAGER_TERRAIN, MANAGER_EQUIPE, SIEGE ou ADMIN.",
    example: "DELEGUE",
  },
  {
    key: "manager",
    headers: ["MANAGER", "EMAIL_MANAGER"],
    help: "E-mail du manager (manager terrain pour un délégué, manager d'équipe pour un manager terrain).",
    example: "manager@apex.local",
  },
  { key: "team", headers: ["EQUIPE", "TEAM"], help: "Équipe.", example: "FRONCO" },
  { key: "region", headers: ["REGION"], help: "Région.", example: "Est" },
  {
    key: "territory",
    headers: ["SECTEUR", "TERRITORY"],
    help: "Secteur (obligatoire pour un délégué).",
    example: "S106",
  },
  {
    key: "locale",
    headers: ["LANGUE", "LOCALE"],
    help: "FR ou EN. Par défaut : FR.",
    example: "FR",
  },
  {
    key: "status",
    headers: ["STATUT", "STATUS"],
    help: "ACTIF ou INACTIF. Par défaut : ACTIF.",
    example: "ACTIF",
  },
];

const ROLE_ALIASES: Record<string, Role> = {
  FIELDUSER: "FIELD_USER",
  DELEGUE: "FIELD_USER",
  DELEGUETERRAIN: "FIELD_USER",
  FIELDMANAGER: "FIELD_MANAGER",
  MANAGERTERRAIN: "FIELD_MANAGER",
  TEAMMANAGER: "TEAM_MANAGER",
  MANAGEREQUIPE: "TEAM_MANAGER",
  HQUSER: "HQ_USER",
  SIEGE: "HQ_USER",
  HQ: "HQ_USER",
  ADMIN: "ADMIN",
  ADMINISTRATEUR: "ADMIN",
};
// Les managers sont traités avant les personnes qu'ils encadrent.
const RANK: Record<Role, number> = {
  ADMIN: 0,
  HQ_USER: 0,
  TEAM_MANAGER: 1,
  FIELD_MANAGER: 2,
  FIELD_USER: 3,
};

export type UserItem = {
  exists: boolean;
  email: string;
  managerEmail: string | null;
  data: {
    firstName: string;
    lastName: string;
    role: Role;
    team: string | null;
    primaryRegion: string | null;
    primaryTerritory: string | null;
    locale: Locale;
    status: UserStatus;
  };
};

const nil = (v: string | undefined) => (v ? v : null);

export const usersImporter: Importer<UserItem> = {
  columns,
  async analyze({ db, adminId }, rows) {
    const issues: ImportIssue[] = [];
    const existing = await db.user.findMany({
      select: { id: true, email: true, role: true, status: true },
    });
    const dbByEmail = new Map(existing.map((u) => [u.email, u]));
    const admin = existing.find((u) => u.id === adminId);

    // Première passe : lecture et contrôles propres à chaque ligne.
    const parsed: (UserItem & { line: number })[] = [];
    const seen = new Set<string>();
    for (const { line, values: v } of rows) {
      const err = (code: string, value?: string) =>
        issues.push({ line, severity: "error", code, value });
      const email = v.email?.toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        err("invalidEmail", v.email);
        continue;
      }
      if (seen.has(email)) {
        err("duplicate", email);
        continue;
      }
      seen.add(email);
      if (!v.firstName || !v.lastName) {
        err("missingField");
        continue;
      }
      const role = ROLE_ALIASES[normalizeHeader(v.role ?? "")];
      if (!role) {
        err("invalidRole", v.role);
        continue;
      }
      const locale = (v.locale || "fr").toLowerCase();
      if (locale !== "fr" && locale !== "en") {
        err("invalidLocale", v.locale);
        continue;
      }
      const statusRaw = normalizeHeader(v.status || "ACTIF");
      const status: UserStatus | null = ["ACTIF", "ACTIVE"].includes(statusRaw)
        ? "ACTIVE"
        : ["INACTIF", "INACTIVE"].includes(statusRaw)
          ? "INACTIVE"
          : null;
      if (!status) {
        err("invalidStatus", v.status);
        continue;
      }
      if (role === "FIELD_USER" && !v.territory) {
        err("territoryRequired");
        continue;
      }
      if (admin && email === admin.email && (role !== "ADMIN" || status !== "ACTIVE")) {
        err("selfChange");
        continue;
      }
      parsed.push({
        line,
        exists: dbByEmail.has(email),
        email,
        managerEmail: v.manager?.toLowerCase() || null,
        data: {
          firstName: v.firstName,
          lastName: v.lastName,
          role,
          team: nil(v.team),
          primaryRegion: nil(v.region),
          primaryTerritory: v.territory ? v.territory.toUpperCase() : null,
          locale,
          status,
        },
      });
    }

    // Seconde passe : le manager doit exister (en base ou dans le fichier) avec le rôle attendu.
    const roleAfterImport = new Map(
      existing.map((u) => [u.email, { role: u.role, status: u.status }]),
    );
    for (const p of parsed)
      roleAfterImport.set(p.email, { role: p.data.role, status: p.data.status });
    const items = parsed.filter((p) => {
      const expected = MANAGER_ROLE[p.data.role];
      if (!expected) {
        p.managerEmail = null;
        return true;
      }
      if (!p.managerEmail) {
        issues.push({ line: p.line, severity: "error", code: "managerRequired" });
        return false;
      }
      const manager = roleAfterImport.get(p.managerEmail);
      if (!manager || manager.role !== expected || manager.status !== "ACTIVE") {
        issues.push({
          line: p.line,
          severity: "error",
          code: "managerInvalid",
          value: p.managerEmail,
        });
        return false;
      }
      return true;
    });
    items.sort((a, b) => RANK[a.data.role] - RANK[b.data.role]);
    const newOnes = items.filter((i) => !i.exists).length;
    if (newOnes)
      issues.push({ line: 0, severity: "warning", code: "noPassword", value: String(newOnes) });

    return {
      preview: preview(rows.length, items, issues),
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      items: items.map(({ line, ...item }) => item),
    };
  },

  async apply({ db }, items) {
    await db.$transaction(async (tx) => {
      for (const item of items) {
        const manager = item.managerEmail
          ? await tx.user.findUnique({ where: { email: item.managerEmail }, select: { id: true } })
          : null;
        const data = { ...item.data, managerId: manager?.id ?? null };
        await tx.user.upsert({
          where: { email: item.email },
          create: { email: item.email, ...data },
          update: data,
        });
      }
    });
    return items.length;
  },
};
