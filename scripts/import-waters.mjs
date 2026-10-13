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

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const MIN_HA = Number(args['min-ha'] ?? 5);
const SECTION_KM = Number(args['section-km'] ?? 10);
const SIMPLIFY_M = Number(args['simplify-m'] ?? 25);
const ENDPOINT = args.endpoint ?? 'https://overpass-api.de/api/interpreter';

// Split into several smaller requests: one huge request tends to time out on the public servers.
const AREA = 'area["ISO3166-2"="DE-BB"][admin_level=4]->.bb;';
const QUERIES = {
  lakes: `[out:json][timeout:300];${AREA}(way["natural"="water"]["name"](area.bb);relation["natural"="water"]["name"](area.bb););out geom;`,
  rivers: `[out:json][timeout:300];${AREA}way["waterway"~"^(river|canal)$"]["name"](area.bb);out geom;`,
  places: `[out:json][timeout:120];${AREA}node["place"~"^(city|town|village)$"]["name"](area.bb);out;`
};
// Counties: county outlines are too heavy to download, so instead ask per county which waters lie in it.
const COUNTY_LIST = `[out:json][timeout:120];${AREA}relation["boundary"="administrative"]["admin_level"="6"](area.bb);out tags;`;
const countyMembersQuery = (relId) =>
  `[out:json][timeout:240];area(${3600000000 + relId})->.c;(way["natural"="water"]["name"](area.c);relation["natural"="water"]["name"](area.c);way["waterway"~"^(river|canal)$"]["name"](area.c););out ids;`;
const ENDPOINTS = [ENDPOINT, 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];

async function overpass(name, query, allowEmpty = false) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = ENDPOINTS[attempt % ENDPOINTS.length];
    const t0 = Date.now();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'fangbuch-brandenburg-import (IfB Potsdam-Sacrow)' },
        body: 'data=' + encodeURIComponent(query)
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200).replace(/\s+/g, ' ')}`);
      const json = JSON.parse(text);
      if (json.remark && /error|timed out|runtime/i.test(json.remark)) throw new Error(`Overpass remark: ${json.remark}`);
      if (!allowEmpty && !json.elements?.length) throw new Error(`empty result${json.remark ? ` (${json.remark})` : ''}`);
      console.log(`  ${name}: ${json.elements.length} elements from ${url} in ${((Date.now() - t0) / 1000).toFixed(0)} s (${(text.length / 1e6).toFixed(1)} MB)`);
      return json.elements;
    } catch (e) {
      console.log(`  ${name}: attempt ${attempt + 1} at ${url} failed: ${e.message}`);
      await new Promise((r) => setTimeout(r, 20_000 * (attempt + 1)));
    }
  }
  throw new Error(`Giving up on ${name}`);
}

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
// Prefer the German name (OSM often has bilingual names like "Oder/Odra" or "Cottbus - Chóśebuz").
const nameOf = (tags) => {
  if (tags['name:de']) return tags['name:de'].trim();
  const n = (tags.name || '').trim();
  // "Oder/Odra", "Lausitzer Neiße / Nysa Łużycka": keep the German part when a Polish name exists.
  if (tags['name:pl'] && n.includes('/')) return n.split('/')[0].trim();
  return n;
};
const slug = (s) => s.toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ------------------------------------------------------------------ main processing
export function buildWaters(osm) {
  const els = osm.elements ?? [];

  // Regions = counties, from per-county membership lookups (see main()).
  const countyOf = osm.countyOf ?? {};
  console.log(`  county lookup covers ${Object.keys(countyOf).length} elements`);
  const places = els
    .filter((e) => e.type === 'node' && e.tags?.place)
    .map((n) => ({ name: nameOf(n.tags), rank: { city: 3, town: 2, village: 1 }[n.tags.place] ?? 0, xy: [n.lon, n.lat] }));
  const nearestPlace = (pt, minRank = 1) => {
    const f = toXY(pt[1]);
    const p = f(pt);
    let best = null, bestD = Infinity;
    for (const pl of places) {
      if (pl.rank < minRank) continue;
      // Prefer bigger places: towns count as a bit closer than villages.
      const d = dist(p, f(pl.xy)) / (1 + 0.5 * (pl.rank - 1));
      if (d < bestD) { bestD = d; best = pl; }
    }
    return best?.name;
  };

  const out = [];
  const usedIds = new Set();
  const uniqueId = (base) => {
    let id = base, n = 2;
    while (usedIds.has(id)) id = `${base}-${n++}`;
    usedIds.add(id);
    return id;
  };

  // Lakes: ways and multipolygon relations tagged natural=water.
  const lakeEls = els.filter((e) => e.tags?.natural === 'water' && e.tags?.name && (e.type === 'way' || e.type === 'relation'));
  for (const e of lakeEls) {
    const wt = e.tags.water;
    if (wt && !['lake', 'reservoir', 'pond', 'oxbow', 'lagoon', 'basin'].includes(wt)) continue; // skip river areas etc.
    let rings;
    if (e.type === 'way') rings = [geomOf(e.geometry)];
    else rings = joinChains((e.members ?? []).filter((m) => m.role === 'outer' && m.geometry).map((m) => geomOf(m.geometry)));
    rings = rings.filter((r) => r.length > 3);
    if (!rings.length) continue;
    const ha = rings.reduce((s, r) => s + ringAreaHa(r), 0);
    if (ha < MIN_HA) continue;
    const main = rings.slice().sort((a, b) => ringAreaHa(b) - ringAreaHa(a))[0];
    const [lon, lat] = centroid(main);
    out.push({
      id: uniqueId(slug(nameOf(e.tags))),
      name: nameOf(e.tags),
      type: wt === 'oxbow' ? 'oxbow' : 'lake',
      region: countyOf[`${e.type}/${e.id}`] ?? 'Brandenburg',
      lat: +lat.toFixed(5), lon: +lon.toFixed(5),
      ha: Math.round(ha),
      geom: { t: 'poly', c: rings.map((r) => round(simplify(r, SIMPLIFY_M))) }
    });
  }

  // Rivers and canals: group ways by name, chain them, cut into ~SECTION_KM pieces named by nearest town.
  const byName = new Map();
  const wayCounties = [];
  for (const e of els) {
    if (e.type !== 'way' || !['river', 'canal'].includes(e.tags?.waterway) || !e.tags?.name) continue;
    const k = `${e.tags.waterway}|${nameOf(e.tags)}`;
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(geomOf(e.geometry));
    const g = geomOf(e.geometry);
    if (countyOf[`way/${e.id}`] && g.length) wayCounties.push({ c: centroid(g), county: countyOf[`way/${e.id}`] });
  }
  const regionNear = (pt) => {
    const f = toXY(pt[1]);
    let best = 'Brandenburg', bestD = Infinity;
    for (const w of wayCounties) {
      const d = dist(f(pt), f(w.c));
      if (d < bestD) { bestD = d; best = w.county; }
    }
    return best;
  };
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
    // Label each section; merge neighbours that end up with the same label.
    const labelled = sections.map((s) => {
      const c = centroid(s);
      return { place: sections.length > 1 ? nearestPlace(c, 1) : null, lines: [s] };
    });
    const merged = [];
    for (const s of labelled) {
      const m = merged.find((x) => x.place === s.place);
      if (m) m.lines.push(...s.lines); else merged.push(s);
    }
    for (const s of merged) {
      const all = s.lines.flat();
      const [lon, lat] = centroid(all);
      const label = s.place ? `${name} bei ${s.place}` : name;
      out.push({
        id: uniqueId(slug(label)),
        name: label,
        type,
        region: regionNear([lon, lat]),
        lat: +lat.toFixed(5), lon: +lon.toFixed(5),
        geom: { t: 'line', c: s.lines.map((l) => round(simplify(l, SIMPLIFY_M))) }
      });
    }
  }

  // Drop duplicates (same water mapped twice, e.g. as a way and as a relation).
  const deduped = [];
  for (const w of out.sort((a, b) => (b.ha ?? 0) - (a.ha ?? 0))) {
    const f = toXY(w.lat);
    const dup = deduped.find((d) => d.name === w.name && d.type === w.type && dist(f([d.lon, d.lat]), f([w.lon, w.lat])) < 2000);
    if (!dup) deduped.push(w);
  }
  console.log(`  removed ${out.length - deduped.length} duplicates`);
  out.length = 0;
  out.push(...deduped);
  // Same name, different place: add the county (or size) so people can tell them apart.
  const counts = out.reduce((m, w) => ((m[w.name] = (m[w.name] ?? 0) + 1), m), {});
  for (const w of out) if (counts[w.name] > 1) w.label = w.region !== 'Brandenburg' ? `${w.name} (${w.region.replace(/^Landkreis /, '')})` : w.ha ? `${w.name} (${w.ha} ha)` : w.name;
  for (const w of out) if (w.label) { w.name = w.label; delete w.label; }
  out.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const regions = [...new Set(out.map((w) => w.region))].sort((a, b) => a.localeCompare(b, 'de'));
  return {
    version: 2,
    source: 'OpenStreetMap contributors (ODbL), via Overpass API',
    generated: new Date().toISOString().slice(0, 10),
    regions,
    waters: out
  };
}

async function main() {
  let osm;
  if (args.from) {
    osm = JSON.parse(await readFile(args.from, 'utf8'));
  } else {
    console.log('Querying Overpass for Brandenburg waters (4 requests, can take several minutes)...');
    const elements = [];
    for (const [name, q] of Object.entries(QUERIES)) elements.push(...(await overpass(name, q)));
    const countyOf = {};
    const list = (await overpass('county list', COUNTY_LIST)).filter((c) =>
      /^12/.test(c.tags?.['de:regionalschluessel'] ?? c.tags?.['de:amtlicher_gemeindeschluessel'] ?? ''));
    console.log(`  ${list.length} Brandenburg counties`);
    for (const c of list) {
      const cname = nameOf(c.tags).replace(/^Landkreis /, '');
      const members = await overpass(`county ${cname}`, countyMembersQuery(c.id), true);
      for (const m of members) countyOf[`${m.type}/${m.id}`] ??= cname;
    }
    osm = { elements, countyOf };
    if (args.save) await writeFile(args.save, JSON.stringify(osm));
  }
  const result = buildWaters(osm);
  const json = JSON.stringify(result);
  await writeFile(new URL('../public/waters.json', import.meta.url), json + '\n');
  const counts = result.waters.reduce((m, w) => ((m[w.type] = (m[w.type] ?? 0) + 1), m), {});
  console.log(`Wrote ${result.waters.length} waters (${JSON.stringify(counts)}), ${(json.length / 1024 / 1024).toFixed(1)} MB`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
