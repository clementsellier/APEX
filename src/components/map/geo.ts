import type { Geometry, Position } from "geojson";

/** Centre (barycentre) du plus grand polygone d'une géométrie : position des étiquettes. */
export function labelPoint(geometry: Geometry): [number, number] | null {
  const rings: Position[][] =
    geometry.type === "Polygon"
      ? [geometry.coordinates[0]]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates.map((p) => p[0])
        : [];
  let best: { area: number; x: number; y: number } | null = null;
  for (const ring of rings) {
    let a = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      a += f;
      cx += (ring[j][0] + ring[i][0]) * f;
      cy += (ring[j][1] + ring[i][1]) * f;
    }
    if (a === 0) continue;
    const area = Math.abs(a / 2);
    if (!best || area > best.area) best = { area, x: cx / (3 * a), y: cy / (3 * a) };
  }
  return best ? [best.x, best.y] : null;
}
