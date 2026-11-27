// Préférence d'affichage, stockée dans un cookie lisible côté serveur (pas de flash au chargement).
export const themes = ["light", "system", "dark"] as const;
export type Theme = (typeof themes)[number];
export const THEME_COOKIE = "THEME";
export const defaultTheme: Theme = "system";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (themes as readonly string[]).includes(value);
}
