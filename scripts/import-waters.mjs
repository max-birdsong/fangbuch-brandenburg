// Builds public/waters.json from OpenStreetMap (via the Overpass API) for all of Brandenburg.
//
//   npm run import:waters                       # lakes >= 5 ha, rivers/canals in ~10 km sections
//   npm run import:waters -- --min-ha=2 --section-km=8
//   npm run import:waters -- --from=overpass.json   # process a saved Overpass response instead
//
// Output per water: id, name, type (lake/river/canal), region (Landkreis), centroid lat/lon and a
// simplified geometry used on the phone to find the nearest water (point-in/near-polygon for lakes,
// distance to line for rivers). Long rivers are split into sections named after the nearest town,
// e.g. "Oder bei Schwedt/Oder". Review the result before a release: the sectioning is a starting
// point, IFB's own spatial units (e.g. lease areas or river km) may replace it later.
//
// Data © OpenStreetMap contributors, ODbL. Keep the attribution in the app.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const MIN_HA = Number(args['min-ha'] ?? 5);
const SECTION_KM = Number(args['section-km'] ?? 10);
const SIMPLIFY_M = Number(args['simplify-m'] ?? 25);
const ENDPOINT = args.endpoint ?? 'https://overpass-api.de/api/interpreter';

const QUERY = `
[out:json][timeout:300];
area["ISO3166-2"="DE-BB"][admin_level=4]->.bb;
(
  way["natural"="water"]["name"](area.bb);
  relation["natural"="water"]["name"](area.bb);
  way["waterway"~"^(river|canal)$"]["name"](area.bb);
  // Border rivers lie on the state boundary, so the area filter misses them: add them by bounding box.
  way["waterway"="river"]["name"~"Oder|Odra|Neiße|Nysa"](51.25,14.0,53.33,14.95);
  way["waterway"="river"]["name"~"Elbe|Łaba"](52.85,11.2,53.35,12.0);
  way["waterway"="river"]["name"~"Elbe"](51.35,13.05,51.55,13.35);
  node["place"~"^(city|town|village)$"]["name"](area.bb);
  relation["boundary"="administrative"]["admin_level"="6"](area.bb);
);
out geom;
`;

// ------------------------------------------------------------------ geometry helpers
const toXY = (lat0) => {
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110540;
  return ([lon, lat]) => [lon * kx, lat * ky];
};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function segDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

// Douglas-Peucker on [lon,lat] points, tolerance in metres.
function simplify(coords, tolM) {
  if (coords.length < 3) return coords;
  const xy = coords.map(toXY(coords[0][1]));
  const keep = new Uint8Array(coords.length);
  keep[0] = keep[coords.length - 1] = 1;
  const stack = [[0, coords.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = segDist(xy[i], xy[s], xy[e]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tolM && idx > 0) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  return coords.filter((_, i) => keep[i]);
}

const round = (c) => c.map(([lon, lat]) => [+lon.toFixed(5), +lat.toFixed(5)]);

function ringAreaHa(ring) {
  const xy = ring.map(toXY(ring[0][1]));
  let a = 0;
  for (let i = 0, j = xy.length - 1; i < xy.length; j = i++) a += (xy[j][0] + xy[i][0]) * (xy[j][1] - xy[i][1]);
  return Math.abs(a / 2) / 10000;
}

function centroid(coords) {
  let x = 0, y = 0;
  for (const [lon, lat] of coords) { x += lon; y += lat; }
  return [x / coords.length, y / coords.length];
}

function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Joins way pieces (arrays of [lon,lat]) that share endpoints into longer chains.
function joinChains(pieces) {
  const key = ([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`;
  const chains = pieces.map((p) => p.slice());
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < chains.length; i++) {
      for (let j = i + 1; j < chains.length; j++) {
        const a = chains[i], b = chains[j];
        const a0 = key(a[0]), a1 = key(a[a.length - 1]), b0 = key(b[0]), b1 = key(b[b.length - 1]);
        let c = null;
        if (a1 === b0) c = a.concat(b.slice(1));
        else if (a1 === b1) c = a.concat(b.slice(0, -1).reverse());
        else if (a0 === b1) c = b.concat(a.slice(1));
        else if (a0 === b0) c = b.slice().reverse().concat(a.slice(1));
        if (c) { chains[i] = c; chains.splice(j, 1); merged = true; break outer; }
      }
    }
  }
  return chains;
}

const geomOf = (g) => (g ?? []).map((p) => [p.lon, p.lat]);
const slug = (s) => s.toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ------------------------------------------------------------------ main processing
// Prefer the German name; map bilingual / Polish names of the border rivers to the German one.
export function waterName(tags) {
  const raw = (tags?.['name:de'] || tags?.name || '').trim();
  if (!raw) return '';
  if (/^(Oder|Odra)(\s*[-/–]\s*(Oder|Odra))?$/i.test(raw)) return 'Oder';
  if (/^((Lausitzer\s+)?Neiße|Nysa\s+Łużycka)(\s*[-/–]\s*.*)?$/i.test(raw)) return 'Neiße';
  if (/^(Elbe|Łaba|Labe)(\s*[-/–]\s*.*)?$/i.test(raw)) return 'Elbe';
  return raw;
}

// Region label: German name of the Landkreis without the Sorbian part ("Cottbus - Chóśebuz" -> "Cottbus").
const regionName = (tags) => (tags?.['name:de'] || tags?.name || '').split(/\s+-\s+/)[0].trim();

export function buildWaters(osm) {
  const els = osm.elements ?? [];

  // Counties (Landkreise / kreisfreie Städte) as regions.
  const counties = els
    .filter((e) => e.type === 'relation' && e.tags?.boundary === 'administrative' && e.tags?.admin_level === '6')
    .map((r) => {
      const rings = joinChains((r.members ?? []).filter((m) => m.role === 'outer' && m.geometry).map((m) => geomOf(m.geometry)))
        .filter((c) => c.length > 3);
      return { name: regionName(r.tags), rings, c: rings.length ? centroid(rings.flat()) : null };
    })
    .filter((c) => c.name && c.rings.length);
  // Inside a county, else the nearest county (border rivers lie on the state boundary).
  const regionOf = (pt) => {
    const hit = counties.find((c) => c.rings.some((ring) => pointInRing(pt, ring)));
    if (hit) return hit.name;
    const f = toXY(pt[1]);
    let best = 'Brandenburg', bestD = Infinity;
    for (const c of counties) {
      for (const ring of c.rings) {
        for (let i = 0; i < ring.length; i += 5) {
          const d = dist(f(pt), f(ring[i]));
          if (d < bestD) { bestD = d; best = c.name; }
        }
      }
    }
    return best;
  };

  const places = els
    .filter((e) => e.type === 'node' && e.tags?.place && e.tags?.name)
    .map((n) => ({ name: n.tags.name, rank: { city: 3, town: 2, village: 1 }[n.tags.place] ?? 0, xy: [n.lon, n.lat] }));
  const nearestPlace = (pt, minRank = 1, exclude = new Set()) => {
    const f = toXY(pt[1]);
    const p = f(pt);
    let best = null, bestD = Infinity;
    for (const pl of places) {
      if (pl.rank < minRank || exclude.has(pl.name)) continue;
      // Prefer bigger places: towns count as a bit closer than villages.
      const d = dist(p, f(pl.xy)) / (1 + 0.5 * (pl.rank - 1));
      if (d < bestD) { bestD = d; best = pl; }
    }
    return best?.name;
  };
  const metres = (a, b) => { const f = toXY(a[1]); return dist(f(a), f(b)); };

  // Rivers and canals: group ways by (type, name).
  const byName = new Map();
  for (const e of els) {
    if (e.type !== 'way' || !['river', 'canal'].includes(e.tags?.waterway)) continue;
    const name = waterName(e.tags);
    if (!name) continue;
    const k = `${e.tags.waterway}|${name}`;
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(geomOf(e.geometry));
  }
  const lineNames = new Set([...byName.keys()].map((k) => k.split('|')[1]));

  const out = [];

  // Lakes: ways and multipolygon relations tagged natural=water.
  const lakes = [];
  for (const e of els) {
    if (e.tags?.natural !== 'water' || (e.type !== 'way' && e.type !== 'relation')) continue;
    const name = waterName(e.tags);
    if (!name) continue;
    const wt = e.tags.water;
    if (wt && !['lake', 'reservoir', 'pond', 'oxbow', 'lagoon', 'basin'].includes(wt)) continue; // river areas etc.
    if (!wt && lineNames.has(name)) continue; // untagged area of a river/canal that is already a line
    let rings;
    if (e.type === 'way') rings = [geomOf(e.geometry)];
    else rings = joinChains((e.members ?? []).filter((m) => m.role === 'outer' && m.geometry).map((m) => geomOf(m.geometry)));
    rings = rings.filter((r) => r.length > 3);
    if (!rings.length) continue;
    const ha = rings.reduce((s, r) => s + ringAreaHa(r), 0);
    if (ha < MIN_HA) continue;
    const main = rings.slice().sort((a, b) => ringAreaHa(b) - ringAreaHa(a))[0];
    lakes.push({ name, wt, rings, ha, c: centroid(main), rel: e.type === 'relation' });
  }
  // The same lake mapped twice (a way and a relation): same name, centres < 1 km apart -> keep the larger.
  lakes.sort((a, b) => b.ha - a.ha || Number(b.rel) - Number(a.rel));
  const keptLakes = [];
  for (const l of lakes) {
    if (keptLakes.some((k) => k.name === l.name && metres(k.c, l.c) < 1000)) continue;
    keptLakes.push(l);
  }
  for (const l of keptLakes) {
    const [lon, lat] = l.c;
    out.push({
      name: l.name,
      type: l.wt === 'oxbow' ? 'oxbow' : 'lake',
      region: regionOf([lon, lat]),
      lat: +lat.toFixed(5), lon: +lon.toFixed(5),
      ha: Math.round(l.ha),
      geom: { t: 'poly', c: l.rings.map((r) => round(simplify(r, SIMPLIFY_M))) }
    });
  }

  // Rivers and canals: chain the ways, cut into ~SECTION_KM pieces named by nearest town.
  for (const [k, pieces] of byName) {
    const [type, name] = k.split('|');
    const sections = [];
    for (const chain of joinChains(pieces)) {
      const f = toXY(chain[0][1]);
      let cur = [chain[0]], len = 0;
      for (let i = 1; i < chain.length; i++) {
        len += dist(f(chain[i - 1]), f(chain[i]));
        cur.push(chain[i]);
        if (len >= SECTION_KM * 1000 && i < chain.length - 1) {
          sections.push(cur);
          cur = [chain[i]];
          len = 0;
        }
      }
      if (cur.length > 1) sections.push(cur);
    }
    // Label each section; merge sections that end up with the same label.
    const labelled = sections.map((s) => ({ place: sections.length > 1 ? nearestPlace(centroid(s), 1) : null, lines: [s] }));
    const merged = [];
    for (const s of labelled) {
      const m = merged.find((x) => x.place === s.place);
      if (m) m.lines.push(...s.lines); else merged.push(s);
    }
    for (const s of merged) {
      const [lon, lat] = centroid(s.lines.flat());
      out.push({
        name: s.place ? `${name} bei ${s.place}` : name,
        type,
        region: regionOf([lon, lat]),
        lat: +lat.toFixed(5), lon: +lon.toFixed(5),
        geom: { t: 'line', c: s.lines.map((l) => round(simplify(l, SIMPLIFY_M))) }
      });
    }
  }

  // Different waters with the same name: add the nearest town, then the type, then the region.
  const groups = new Map();
  for (const w of out) groups.set(w.name, [...(groups.get(w.name) ?? []), w]);
  for (const [name, ws] of groups) {
    if (ws.length < 2) continue;
    for (const w of ws) {
      if (w.type === 'lake' || w.type === 'oxbow') {
        const town = nearestPlace([w.lon, w.lat], 1);
        if (town && !name.includes(town)) w.name = `${name} bei ${town}`;
      } else if (w.type === 'canal' && ws.some((x) => x.type === 'river')) {
        w.name = `${name} (Kanal)`;
      }
    }
  }
  const counts = new Map();
  for (const w of out) counts.set(w.name, (counts.get(w.name) ?? 0) + 1);
  for (const w of out) if (counts.get(w.name) > 1) w.name = `${w.name} (${w.region})`;

  // Stable ids from the final names.
  const usedIds = new Set();
  out.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  for (const w of out) {
    const base = slug(w.name);
    let id = base, n = 2;
    while (usedIds.has(id)) id = `${base}-${n++}`;
    usedIds.add(id);
    w.id = id;
  }
  const waters = out.map(({ id, ...rest }) => ({ id, ...rest }));
  const regions = [...new Set(waters.map((w) => w.region))].sort((a, b) => a.localeCompare(b, 'de'));
  return {
    version: 2,
    source: 'OpenStreetMap contributors (ODbL), via Overpass API',
    generated: new Date().toISOString().slice(0, 10),
    regions,
    waters
  };
}

async function main() {
  let osm;
  if (args.from) {
    osm = JSON.parse(await readFile(args.from, 'utf8'));
  } else {
    console.log(`Querying Overpass (${ENDPOINT}) for Brandenburg waters, this can take a few minutes...`);
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'fangbuch-brandenburg-import' },
      body: 'data=' + encodeURIComponent(QUERY)
    });
    if (!res.ok) throw new Error(`Overpass error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    osm = await res.json();
    if (args.save) await writeFile(args.save, JSON.stringify(osm));
  }
  const result = buildWaters(osm);
  const json = JSON.stringify(result);
  await writeFile(new URL('../public/waters.json', import.meta.url), json + '\n');
  const counts = result.waters.reduce((m, w) => ((m[w.type] = (m[w.type] ?? 0) + 1), m), {});
  console.log(`Wrote ${result.waters.length} waters (${JSON.stringify(counts)}), ${(json.length / 1024 / 1024).toFixed(1)} MB`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
