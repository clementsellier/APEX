"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import {
  LngLatBounds,
  Map as MapLibre,
  Marker,
  NavigationControl,
  setWorkerUrl,
  getVersion,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  type MapMouseEvent,
} from "maplibre-gl";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { useTranslations } from "next-intl";

// Carte des UGA (MapLibre GL, sans fond de carte externe : aucune donnée ne sort de l'app).

// Worker servi depuis public/ (copié à l'installation, voir scripts/copy-maplibre-worker.mjs).
setWorkerUrl(`/vendor/maplibre-gl-worker.mjs?v=${getVersion()}`);

export type MapZone = {
  code: string;
  geometry: Geometry;
  /** Couleur de remplissage déjà calculée (échelle choisie par l'écran appelant). */
  fill: string;
  /** Zone mise en avant (contour plus épais). */
  emphasis?: boolean;
};
export type MapPoint = { id: string; lng: number; lat: number };
export type MapLabel = { id: string; lng: number; lat: number; text: string };
export type MapOutline = { id: string; geometry: Geometry };

const SURFACE = { light: "#fcfcfb", dark: "#1a1a19" };
const INK = { light: "#0b0b0b", dark: "#f0efec" };
const BORDER = { light: "rgba(11,11,11,0.25)", dark: "rgba(240,239,236,0.25)" };
// UGA de contexte (hors du périmètre affiché) : plus effacées que les zones « sans donnée ».
const CONTEXT = { light: "#f3f2ef", dark: "#1f1f1e" };
const CONTEXT_BORDER = { light: "rgba(11,11,11,0.12)", dark: "rgba(240,239,236,0.1)" };

/** Thème réellement affiché (clair / sombre), d'après l'attribut data-theme et le système. */
function useResolvedTheme(): "light" | "dark" {
  return useSyncExternalStore(
    (onChange) => {
      const observer = new MutationObserver(onChange);
      observer.observe(document.documentElement, { attributeFilter: ["data-theme"] });
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener("change", onChange);
      return () => {
        observer.disconnect();
        media.removeEventListener("change", onChange);
      };
    },
    () => {
      const theme = document.documentElement.getAttribute("data-theme");
      if (theme === "dark" || theme === "light") return theme;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    },
    () => "light",
  );
}

const collection = <T extends Feature>(features: T[]): FeatureCollection =>
  ({ type: "FeatureCollection", features }) as FeatureCollection;

function bounds(zones: { geometry: Geometry }[]) {
  const b = new LngLatBounds();
  const walk = (c: unknown): void => {
    if (typeof (c as number[])[0] === "number") b.extend(c as [number, number]);
    else (c as unknown[]).forEach(walk);
  };
  for (const z of zones) if ("coordinates" in z.geometry) walk(z.geometry.coordinates);
  return b.isEmpty() ? null : b;
}

export function UgaMap({
  zones,
  outlines = [],
  points = [],
  labels = [],
  selected,
  onSelect,
  tooltip,
  height = 520,
  ariaLabel,
  focus,
  context = [],
}: {
  zones: MapZone[];
  /** Contours épais (ex. limites de secteur). */
  outlines?: MapOutline[];
  /** Points (ex. cibles du plan). */
  points?: MapPoint[];
  /** Étiquettes HTML (ex. code de secteur ou d'UGA). */
  labels?: MapLabel[];
  selected?: string | null;
  onSelect?: (code: string | null) => void;
  /** Contenu de l'infobulle pour l'UGA survolée. */
  tooltip?: (code: string) => ReactNode;
  height?: number;
  ariaLabel: string;
  /** Zones sur lesquelles cadrer (ex. un secteur choisi) ; par défaut toutes les zones. */
  focus?: { key: string; zones: { geometry: Geometry }[] } | null;
  /** Zones affichées en fond, non interactives (ex. reste de la France). */
  context?: { code: string; geometry: Geometry }[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const markers = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<{ code: string; x: number; y: number; width: number } | null>(
    null,
  );
  const theme = useResolvedTheme();
  const t = useTranslations("MapControls");
  // Textes des contrôles MapLibre (anglais par défaut), lus à la création de la carte.
  const locale = useMemo(
    () => ({
      "NavigationControl.ZoomIn": t("zoomIn"),
      "NavigationControl.ZoomOut": t("zoomOut"),
      "CooperativeGesturesHandler.WindowsHelpText": t("ctrlScroll"),
      "CooperativeGesturesHandler.MacHelpText": t("cmdScroll"),
      "CooperativeGesturesHandler.MobileHelpText": t("twoFingers"),
    }),
    [t],
  );
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Création de la carte (une fois).
  useEffect(() => {
    if (!container.current) return;
    const m = new MapLibre({
      container: container.current,
      style: {
        version: 8,
        sources: {},
        layers: [{ id: "bg", type: "background", paint: { "background-color": SURFACE.light } }],
      },
      center: [2.5, 46.6],
      zoom: 4.6,
      attributionControl: false,
      dragRotate: false,
      // La molette fait défiler la page ; Ctrl + molette (ou deux doigts) zoome sur la carte.
      cooperativeGestures: true,
      locale,
      pitchWithRotate: false,
    });
    m.touchZoomRotate.disableRotation();
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");
    m.on("load", () => {
      const empty = collection([]);
      m.addSource("context", { type: "geojson", data: empty });
      m.addLayer({ id: "context-fill", type: "fill", source: "context" });
      m.addLayer({
        id: "context-line",
        type: "line",
        source: "context",
        paint: { "line-width": 0.4 },
      });
      m.addSource("zones", { type: "geojson", data: empty, promoteId: "code" });
      m.addSource("outlines", { type: "geojson", data: empty });
      m.addSource("points", { type: "geojson", data: empty });
      m.addLayer({
        id: "zone-fill",
        type: "fill",
        source: "zones",
        paint: {
          "fill-color": ["get", "fill"],
          "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0.88],
        },
      });
      m.addLayer({ id: "zone-line", type: "line", source: "zones", paint: { "line-width": 0.6 } });
      m.addLayer({
        id: "zone-emphasis",
        type: "line",
        source: "zones",
        filter: ["==", ["get", "emphasis"], true],
        paint: { "line-width": 2.5 },
      });
      m.addLayer({ id: "outline", type: "line", source: "outlines", paint: { "line-width": 2 } });
      m.addLayer({
        id: "points",
        type: "circle",
        source: "points",
        paint: { "circle-radius": 4.5, "circle-stroke-width": 2 },
      });
      setReady(true);
    });

    let hovered: string | null = null;
    const setHoverState = (code: string | null) => {
      if (hovered) m.setFeatureState({ source: "zones", id: hovered }, { hover: false });
      hovered = code;
      if (code) m.setFeatureState({ source: "zones", id: code }, { hover: true });
    };
    m.on("mousemove", "zone-fill", (e: MapLayerMouseEvent) => {
      const code = e.features?.[0]?.properties?.code as string | undefined;
      if (!code) return;
      m.getCanvas().style.cursor = onSelectRef.current ? "pointer" : "";
      setHoverState(code);
      setHover({ code, x: e.point.x, y: e.point.y, width: m.getCanvas().clientWidth });
    });
    m.on("mouseleave", "zone-fill", () => {
      m.getCanvas().style.cursor = "";
      setHoverState(null);
      setHover(null);
    });
    m.on("click", (e: MapMouseEvent) => {
      const hit = m.queryRenderedFeatures(e.point, { layers: ["zone-fill"] })[0];
      onSelectRef.current?.((hit?.properties?.code as string | undefined) ?? null);
    });

    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      // Une carte recréée (rechargement à chaud, double montage en développement)
      // n'a ses sources qu'après son propre « load ».
      setReady(false);
    };
    // Carte créée une seule fois : les textes sont ceux de la langue au chargement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Données.
  useEffect(() => {
    const m = map.current;
    const source = (id: string) => m?.getSource(id) as GeoJSONSource | undefined;
    if (!m || !ready || !source("zones")) return;
    source("context")?.setData(
      collection(
        context.map((z) => ({ type: "Feature" as const, geometry: z.geometry, properties: {} })),
      ),
    );
    (m.getSource("zones") as GeoJSONSource).setData(
      collection(
        zones.map((z) => ({
          type: "Feature" as const,
          geometry: z.geometry,
          properties: { code: z.code, fill: z.fill, emphasis: !!z.emphasis || z.code === selected },
        })),
      ),
    );
    (m.getSource("outlines") as GeoJSONSource).setData(
      collection(
        outlines.map((o) => ({ type: "Feature" as const, geometry: o.geometry, properties: {} })),
      ),
    );
    (m.getSource("points") as GeoJSONSource).setData(
      collection(
        points.map((p) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
          properties: { id: p.id },
        })),
      ),
    );
  }, [ready, zones, outlines, points, selected, context]);

  // Cadrage : sur la sélection demandée, sinon sur toutes les zones (quand leur liste change).
  const zoneKey = zones.map((z) => z.code).join();
  const focusKey = focus?.key ?? "";
  useEffect(() => {
    const m = map.current;
    const b = bounds(focus?.zones.length ? focus.zones : zones);
    if (!m || !ready || !b) return;
    m.fitBounds(b, { padding: 32, duration: focusKey ? 600 : 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, zoneKey, focusKey]);

  // Couleurs dépendant du thème.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    if (!m.getLayer("zone-line")) return;
    m.setPaintProperty("bg", "background-color", SURFACE[theme]);
    m.setPaintProperty("context-fill", "fill-color", CONTEXT[theme]);
    m.setPaintProperty("context-line", "line-color", CONTEXT_BORDER[theme]);
    m.setPaintProperty("zone-line", "line-color", BORDER[theme]);
    m.setPaintProperty("zone-emphasis", "line-color", INK[theme]);
    m.setPaintProperty("outline", "line-color", INK[theme]);
    m.setPaintProperty("points", "circle-color", INK[theme]);
    m.setPaintProperty("points", "circle-stroke-color", SURFACE[theme]);
  }, [ready, theme]);

  // Étiquettes HTML (peu nombreuses : codes de secteur ou d'UGA).
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current = labels.map((l) => {
      const el = document.createElement("div");
      el.textContent = l.text;
      el.className =
        "pointer-events-none rounded bg-surface/90 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground shadow-sm";
      // Ancrée par le bas, au-dessus de la zone : l'étiquette ne masque ni la zone ni ses cibles.
      return new Marker({ element: el, anchor: "bottom", offset: [0, -6] })
        .setLngLat([l.lng, l.lat])
        .addTo(m);
    });
  }, [ready, labels]);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border bg-surface border-black/10 dark:border-white/10"
      style={{ height }}
    >
      {/* Hauteur explicite : la feuille de style de MapLibre impose position: relative au conteneur. */}
      <div ref={container} className="h-full w-full" role="region" aria-label={ariaLabel} />
      {hover && tooltip && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 w-56 rounded-lg border border-black/10 bg-surface p-3 text-xs shadow-lg dark:border-white/15"
          style={{
            left: Math.max(0, Math.min(hover.x + 14, hover.width - 236)),
            top: hover.y + 14,
          }}
        >
          {tooltip(hover.code)}
        </div>
      )}
    </div>
  );
}
