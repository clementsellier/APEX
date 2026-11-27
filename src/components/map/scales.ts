// Échelles de couleur des cartes (palette de référence du skill dataviz, validée).
// Remplissages identiques en clair et en sombre : seul le gris neutre change.

export type LegendItem = { color: string; label: string };

/** Absence de donnée : gris neutre, distinct des classes. */
export const NO_DATA = { light: "#e4e3df", dark: "#2c2c2a" };
/** Point milieu d'une échelle divergente (« rien à signaler »). */
const NEUTRAL = { light: "#f0efec", dark: "#383835" };

// Divergente bleu ↔ rouge : 2 crans par bras + milieu gris.
const BLUE = ["#86b6ef", "#256abf"];
const RED = ["#f1a3a2", "#d03b3b"];
// Séquentielle bleue, du clair au foncé.
const SEQ = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#1c5cab"];

export type Scale = {
  color: (value: number | null) => string;
  legend: LegendItem[];
};

type Theme = "light" | "dark";

/**
 * Échelle divergente autour de `mid` : |écart| < `small` → neutre, < `large` → clair, sinon foncé.
 * Au-dessus du milieu en bleu, en dessous en rouge.
 */
export function diverging(
  theme: Theme,
  {
    mid,
    small,
    large,
    format,
  }: { mid: number; small: number; large: number; format: (v: number) => string },
): Scale {
  const colors = [RED[1], RED[0], NEUTRAL[theme], BLUE[0], BLUE[1]];
  return {
    color: (v) => {
      if (v === null) return NO_DATA[theme];
      const d = v - mid;
      if (Math.abs(d) < small) return colors[2];
      if (d > 0) return d < large ? colors[3] : colors[4];
      return -d < large ? colors[1] : colors[0];
    },
    legend: [
      { color: colors[0], label: `< ${format(mid - large)}` },
      { color: colors[1], label: `${format(mid - large)} … ${format(mid - small)}` },
      { color: colors[2], label: `${format(mid - small)} … ${format(mid + small)}` },
      { color: colors[3], label: `${format(mid + small)} … ${format(mid + large)}` },
      { color: colors[4], label: `> ${format(mid + large)}` },
    ],
  };
}

/** Échelle séquentielle en 5 classes de largeur égale entre 0 et `max`. */
export function sequential(theme: Theme, max: number, format: (v: number) => string): Scale {
  const top = max > 0 ? max : 1;
  const step = top / SEQ.length;
  return {
    color: (v) => {
      if (v === null) return NO_DATA[theme];
      if (v <= 0) return SEQ[0];
      return SEQ[Math.min(SEQ.length - 1, Math.floor(v / step))];
    },
    legend: SEQ.map((color, i) => ({
      color,
      label: `${format(i * step)} … ${format((i + 1) * step)}`,
    })),
  };
}
