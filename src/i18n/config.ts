// Langues de l'interface. Le choix est stocké dans un cookie (pas de /fr ou /en dans l'URL) :
// c'est une app interne, la langue suit la préférence de l'utilisateur (champ User.locale).
export const locales = ["fr", "en"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "fr";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}
