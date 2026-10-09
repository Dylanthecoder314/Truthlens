// Projects Natural Earth coastlines (via world-atlas) for the two maps in
// ../index.html and writes the result into the MAPDATA block of that file.
//
//   cd documentary/tools && npm install && npm run build
//
// Each map gets a Mercator projection fitted to a fixed lon/lat box. The page
// re-uses the exported scale/translate to place routes, arcs and markers, so
// everything shares one projection.

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { geoMercator, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";

const require = createRequire(import.meta.url);
const land50 = require("world-atlas/land-50m.json");
const countries50 = require("world-atlas/countries-50m.json");

const MAPS = {
  // The night of 8 March: Kuala Lumpur, IGARI, the turn back, the Strait of Malacca.
  zoom: { box: [[95.3, 0.6], [108.3, 11.6]], width: 1000, decimals: 1 },
  // The southern Indian Ocean: satellite arcs, search areas, debris finds.
  wide: { box: [[18, -46], [122, 24]], width: 1000, decimals: 1 },
};

// d3-geo path context that rounds coordinates and drops repeated points.
function pathString(decimals) {
  const f = 10 ** decimals;
  const r = (v) => Math.round(v * f) / f;
  let out = "";
  let last = null;
  return {
    moveTo(x, y) {
      x = r(x); y = r(y);
      out += `M${x} ${y}`;
      last = [x, y];
    },
    lineTo(x, y) {
      x = r(x); y = r(y);
      if (last && last[0] === x && last[1] === y) return;
      out += `L${x} ${y}`;
      last = [x, y];
    },
    closePath() { out += "Z"; last = null; },
    arc() {},
    result() { return out; },
  };
}

const landGeo = feature(land50, land50.objects.land);
const borderGeo = mesh(countries50, countries50.objects.countries, (a, b) => a !== b);

const data = {};
for (const [name, cfg] of Object.entries(MAPS)) {
  const [[w0, s0], [e0, n0]] = cfg.box;
  // Clockwise ring, densified so its top and bottom edges follow parallels
  // (d3-geo joins vertices with great circles, and treats an anticlockwise
  // ring as the rest of the globe).
  const ring = [];
  for (let lat = s0; lat < n0; lat += 1) ring.push([w0, lat]);
  for (let lon = w0; lon < e0; lon += 1) ring.push([lon, n0]);
  for (let lat = n0; lat > s0; lat -= 1) ring.push([e0, lat]);
  for (let lon = e0; lon > w0; lon -= 1) ring.push([lon, s0]);
  ring.push([w0, s0]);
  const outline = { type: "Polygon", coordinates: [ring] };
  // Measure the box's aspect ratio under Mercator, then fit it exactly.
  const probe = geoMercator().fitWidth(cfg.width, outline);
  const [[, y0], [, y1]] = geoPath(probe).bounds(outline);
  const height = Math.round(y1 - y0);
  const projection = geoMercator()
    .fitExtent([[0, 0], [cfg.width, height]], outline)
    .clipExtent([[-2, -2], [cfg.width + 2, height + 2]]);

  const draw = (geo) => {
    const ctx = pathString(cfg.decimals);
    geoPath(projection, ctx)(geo);
    return ctx.result();
  };

  data[name] = {
    w: cfg.width,
    h: height,
    s: +projection.scale().toFixed(4),
    tx: +projection.translate()[0].toFixed(4),
    ty: +projection.translate()[1].toFixed(4),
    land: draw(landGeo),
    borders: name === "zoom" ? draw(borderGeo) : "",
  };
}

const target = new URL("../index.html", import.meta.url);
const html = readFileSync(target, "utf8");
const begin = "/*MAPDATA:BEGIN*/";
const end = "/*MAPDATA:END*/";
const i = html.indexOf(begin);
const j = html.indexOf(end);
if (i < 0 || j < 0) throw new Error("MAPDATA markers not found in index.html");
const block = `${begin}\nwindow.MAPDATA = ${JSON.stringify(data)};\n${end}`;
writeFileSync(target, html.slice(0, i) + block + html.slice(j + end.length));

for (const [name, m] of Object.entries(data)) {
  console.log(`${name}: ${m.w}x${m.h}, land ${(m.land.length / 1024).toFixed(1)} KB, borders ${(m.borders.length / 1024).toFixed(1)} KB`);
}
