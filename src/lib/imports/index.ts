import { accountsImporter } from "./accounts";
import { plansImporter } from "./plans";
import { qualifsImporter } from "./qualifs";
import type { Importer } from "./types";
import { usersImporter } from "./users";

export const IMPORT_KINDS = ["accounts", "qualifs", "users", "plans"] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

export const IMPORTERS: Record<ImportKind, Importer<unknown>> = {
  accounts: accountsImporter as Importer<unknown>,
  qualifs: qualifsImporter as Importer<unknown>,
  users: usersImporter as Importer<unknown>,
  plans: plansImporter as Importer<unknown>,
};

export function isImportKind(value: unknown): value is ImportKind {
  return typeof value === "string" && (IMPORT_KINDS as readonly string[]).includes(value);
}
