// Copie le worker de MapLibre dans public/ : Turbopack ne sait pas servir le fichier que
// MapLibre charge à côté de son module (import.meta.url), la carte reste sinon vide.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/vendor", { recursive: true });
copyFileSync(
  "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs",
  "public/vendor/maplibre-gl-worker.mjs",
);
