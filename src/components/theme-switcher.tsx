"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { defaultTheme, isTheme, THEME_COOKIE, themes, type Theme } from "@/lib/theme";

const ICONS: Record<Theme, React.ReactNode> = {
  light: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  system: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  ),
  dark: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  ),
};

/** Applique le thème à la page et le mémorise (lu par le serveur au prochain chargement). */
function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

// La source de vérité est l'attribut data-theme de <html> : tous les sélecteurs de la page
// (et ceux gardés en cache par le routeur) affichent donc toujours le thème réellement appliqué.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function readTheme(): Theme {
  const value = document.documentElement.getAttribute("data-theme");
  return isTheme(value) ? value : defaultTheme;
}

/** Choix Clair / Système / Sombre. Appliqué tout de suite, sans aller-retour serveur. */
export function ThemeSwitcher({ initial }: { initial: Theme }) {
  const t = useTranslations("Theme");
  const theme = useSyncExternalStore(subscribe, readTheme, () => initial);
  const choose = applyTheme;

  return (
    <div
      role="group"
      aria-label={t("label")}
      className="flex gap-1 rounded-full border border-black/10 p-1 dark:border-white/15"
    >
      {themes.map((value) => (
        <button
          key={value}
          type="button"
          title={t(value)}
          aria-label={t(value)}
          aria-pressed={theme === value}
          onClick={() => choose(value)}
          className="grid h-7 w-7 place-items-center rounded-full text-foreground/60 transition-colors hover:text-foreground aria-pressed:bg-foreground aria-pressed:text-background [&>svg]:h-4 [&>svg]:w-4"
        >
          {ICONS[value]}
        </button>
      ))}
    </div>
  );
}
