// Builds public/waters.json from OpenStreetMap (via the Overpass API) for all of Brandenburg and
// the neighbouring Polish voivodeships Zachodniopomorskie and Lubuskie.
//
//   npm run import:waters                       # lakes >= 5 ha, rivers/canals in ~10 km sections
//   npm run import:waters -- --min-ha=2 --section-km=8
//   npm run import:waters -- --from=bb.json --from-pl=pl.json   # process saved Overpass responses instead
//   npm run import:waters -- --no-pl                             # Brandenburg only
//
// Brandenburg and Poland are queried and processed separately, so adding Poland never changes the
// ids of Brandenburg waters. Polish waters keep their Polish name (German name, if OSM has one, as
// "alt" for search), get ids starting with "pl-" and cc "PL". Border rivers (Oder, Neiße) stay in
// the Brandenburg part; the Polish part only adds the stretches that run entirely through Poland.
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
const ENDPOINTS = args.endpoint ? [args.endpoint] : [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];

const QUERY_BB = `
[out:json][timeout:300];
area["ISO3166-2"="DE-BB"][admin_level=4]->.bb;
(
  way["natural"="water"]["name"](area.bb);
  relation["natural"="water"]["name"](area.bb);
  way["waterway"~"^(river|canal)$"]["name"](area.bb);
  // Border rivers lie on the state boundary, so the area filter misses them: add them by bounding box.
  way["waterway"="river"]["name"~"Oder|Odra"](52.05,14.0,53.33,14.95);
  way["waterway"="river"]["name"~"Neiße|Nysa"](51.25,14.4,52.1,14.95);
  way["waterway"="river"]["name"~"Elbe|Łaba"](52.85,11.2,53.35,12.0);
  way["waterway"="river"]["name"~"Elbe"](51.35,13.05,51.55,13.35);
  node["place"~"^(city|town|village)$"]["name"](area.bb);
  relation["boundary"="administrative"]["admin_level"="6"](area.bb);
);
out geom;
`;

// Polish part: one query per voivodeship (old letter or new number ISO code). Public Overpass servers
// rate-limit by IP after a big query, so main() pauses between queries.
const QUERY_PL = (code) => `
[out:json][timeout:600][maxsize:1073741824];
area["ISO3166-2"~"^PL-(${code})$"][admin_level=4]->.pl;
(
  way["natural"="water"]["name"](area.pl);
  relation["natural"="water"]["name"](area.pl);
  way["waterway"~"^(river|canal)$"]["name"](area.pl);
  node["place"~"^(city|town|village)$"]["name"](area.pl);
  relation["boundary"="administrative"]["admin_level"="6"](area.pl);
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
// Polish letters to ASCII for ids ("Łęknica" -> "leknica"). Only used for the Polish part.
const translit = (s) => s.replace(/ł/g, 'l').replace(/Ł/g, 'L').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// ------------------------------------------------------------------ main processing
// Prefer the German name; map bilingual / Polish names of the border rivers to the German one.
export function waterName(tags, pl = false) {
  const raw = (pl ? tags?.name || tags?.['name:pl'] : tags?.['name:de'] || tags?.name || '')?.trim() ?? '';
  if (!raw) return '';
  if (/^(Oder|Odra)(\s*[-/–]\s*(Oder|Odra))?$/i.test(raw)) return 'Oder';
  if (/^((Lausitzer\s+)?Neiße|Nysa\s+Łużycka)(\s*[-/–]\s*.*)?$/i.test(raw)) return 'Neiße';
  if (/^(Elbe|Łaba|Labe)(\s*[-/–]\s*.*)?$/i.test(raw)) return 'Elbe';
  // Waters on the Polish side picked up by the border-river boxes have only Polish names: skip them.
  if (!pl && !tags?.['name:de'] && /[łśżźćńąę]/i.test(raw) && !/[äöüß]/i.test(raw)) return '';
  return raw;
}

// Region label: German name of the Landkreis without the Sorbian part ("Cottbus - Chóśebuz" -> "Cottbus").
const regionName = (tags) => (tags?.['name:de'] || tags?.name || '').split(/\s+-\s+/)[0].trim();
// Polish powiat label: "powiat gryfiński" -> "Powiat gryfiński (PL)", "Szczecin" -> "Szczecin (PL)".
const regionNamePL = (tags) => {
  const n = (tags?.name || '').trim();
  return n ? `${n[0].toUpperCase()}${n.slice(1)} (PL)` : '';
};

/**
 * opts.pl: build the Polish part (Polish names, "pl-" ids, rivers clipped to the Polish powiats).
 * opts.skipNear: a point test; Polish river points near Brandenburg are dropped (the Brandenburg part has them).
 * Returns the waters file plus `near`, the "in or within 1 km of this area" test for the next pass.
 */
export function buildWaters(osm, opts = {}) {
  const pl = !!opts.pl;
  const els = osm.elements ?? [];

  // Counties (Landkreise / kreisfreie Städte) as regions.
  const counties = els
    .filter((e) => e.type === 'relation' && e.tags?.boundary === 'administrative' && e.tags?.admin_level === '6')
    .map((r) => {
      const rings = joinChains((r.members ?? []).filter((m) => m.role === 'outer' && m.geometry).map((m) => geomOf(m.geometry)))
        .filter((c) => c.length > 3);
      return { name: pl ? regionNamePL(r.tags) : regionName(r.tags), rings, c: rings.length ? centroid(rings.flat()) : null };
    })
    .filter((c) => c.name && c.rings.length);
  // Simplified rings with bounding boxes for fast point-in-area tests (rivers have many points).
  const fastRings = counties.flatMap((c) => c.rings.map((r) => {
    const ring = simplify(r, 100);
    const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
    return { ring, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }));
  const inArea = (pt) => fastRings.some((f) => pt[0] >= f.x0 && pt[0] <= f.x1 && pt[1] >= f.y0 && pt[1] <= f.y1 && pointInRing(pt, f.ring));
  const bbox = fastRings.reduce((b, f) => [Math.min(b[0], f.x0), Math.max(b[1], f.x1), Math.min(b[2], f.y0), Math.max(b[3], f.y1)], [180, -180, 90, -90]);
  // Inside a county, else the nearest county (border rivers lie on the state boundary).
  const regionOf = (pt) => {
    const hit = counties.find((c) => c.rings.some((ring) => pointInRing(pt, ring)));
    if (hit) return hit.name;
    const f = toXY(pt[1]);
    let best = pl ? 'Polen' : 'Brandenburg', bestD = Infinity;
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
    .map((n) => ({ name: pl ? n.tags.name.trim() : regionName(n.tags), rank: { city: 3, town: 2, village: 1 }[n.tags.place] ?? 0, xy: [n.lon, n.lat] }));
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

  // Is a point in Brandenburg or within ~1 km of it? Used to clip border rivers to the Brandenburg side.
  const vertices = counties.flatMap((c) => c.rings.flatMap((r) => r.filter((_, i) => i % 3 === 0)));
  const nearBB = (pt) => {
    if (pt[0] < bbox[0] - 0.03 || pt[0] > bbox[1] + 0.03 || pt[1] < bbox[2] - 0.02 || pt[1] > bbox[3] + 0.02) return false;
    if (inArea(pt)) return true;
    const f = toXY(pt[1]);
    const p = f(pt);
    for (const v of vertices) {
      if (Math.abs(v[1] - pt[1]) > 0.02 || Math.abs(v[0] - pt[0]) > 0.03) continue;
      if (dist(p, f(v)) < 1000) return true;
    }
    return false;
  };
  const BORDER = new Set(['Oder', 'Neiße', 'Elbe']);
  // Polish part: keep river points inside the selected powiats and not next to Brandenburg.
  const keepPL = (pt) => inArea(pt) && !(opts.skipNear && opts.skipNear(pt));

  // Rivers and canals: group ways by (type, name).
  const byName = new Map();
  const riverAlt = new Map(); // Polish part: German name of a river, e.g. Warta -> Warthe
  for (const e of els) {
    if (e.type !== 'way' || !['river', 'canal'].includes(e.tags?.waterway)) continue;
    const name = waterName(e.tags, pl);
    if (!name) continue;
    const k = `${e.tags.waterway}|${name}`;
    if (!byName.has(k)) byName.set(k, []);
    const deName = (e.tags['name:de'] || '').trim();
    if (pl && deName && deName !== name && !riverAlt.has(k)) riverAlt.set(k, deName);
    const coords = geomOf(e.geometry);
    if (pl) {
      let run = [];
      for (const pt of coords) {
        if (keepPL(pt)) run.push(pt);
        else { if (run.length > 1) byName.get(k).push(run); run = []; }
      }
      if (run.length > 1) byName.get(k).push(run);
    } else if (BORDER.has(name) && counties.length) {
      // Keep only the runs of points on the Brandenburg side.
      let run = [];
      for (const pt of coords) {
        if (nearBB(pt)) run.push(pt);
        else { if (run.length > 1) byName.get(k).push(run); run = []; }
      }
      if (run.length > 1) byName.get(k).push(run);
    } else if (coords.length > 1) {
      byName.get(k).push(coords);
    }
  }
  const lineNames = new Set([...byName.keys()].map((k) => k.split('|')[1]));

  const out = [];

  // Lakes: ways and multipolygon relations tagged natural=water.
  const lakes = [];
  for (const e of els) {
    if (e.tags?.natural !== 'water' || (e.type !== 'way' && e.type !== 'relation')) continue;
    const name = waterName(e.tags, pl);
    if (!name) continue;
    const wt = e.tags.water;
    if (wt && !['lake', 'reservoir', 'pond', 'oxbow', 'lagoon', 'basin'].includes(wt)) continue; // river areas etc.
    if (lineNames.has(name)) continue; // a widening of a river/canal (e.g. the Havel at Potsdam): the line covers it
    let rings;
    if (e.type === 'way') rings = [geomOf(e.geometry)];
    else rings = joinChains((e.members ?? []).filter((m) => m.role === 'outer' && m.geometry).map((m) => geomOf(m.geometry)));
    rings = rings.filter((r) => r.length > 3);
    if (!rings.length) continue;
    const ha = rings.reduce((s, r) => s + ringAreaHa(r), 0);
    if (ha < MIN_HA) continue;
    const main = rings.slice().sort((a, b) => ringAreaHa(b) - ringAreaHa(a))[0];
    const c = centroid(main);
    const de = (e.tags['name:de'] || '').trim();
    lakes.push({ name, wt, rings, ha, c, rel: e.type === 'relation', alt: pl && de && de !== name ? de : undefined });
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
      ...(l.alt ? { alt: l.alt } : {}),
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
    // Name sections after the nearest town (what anglers search for) if one is within 10 km, else the nearest village.
    const label = (c) => {
      const town = nearestPlace(c, 2);
      const tp = town && places.find((p) => p.name === town && p.rank >= 2);
      return tp && metres(c, tp.xy) < 10_000 ? town : nearestPlace(c, 1);
    };
    const labelled = sections.map((s) => ({ place: sections.length > 1 ? label(centroid(s)) : null, lines: [s] }));
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
        ...(riverAlt.has(k) ? { alt: riverAlt.get(k) } : {}),
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
  const seen = new Map();
  for (const w of out) {
    const n = (seen.get(w.name) ?? 0) + 1;
    seen.set(w.name, n);
    if (n > 1) w.name = `${w.name} ${n}`;
  }

  // Stable ids from the final names.
  const usedIds = new Set();
  out.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  for (const w of out) {
    const base = pl ? `pl-${slug(translit(w.name))}` : slug(w.name);
    let id = base, n = 2;
    while (usedIds.has(id)) id = `${base}-${n++}`;
    usedIds.add(id);
    w.id = id;
  }
  const waters = out.map(({ id, ...rest }) => ({ id, ...rest, ...(pl ? { cc: 'PL' } : {}) }));
  const regions = [...new Set(waters.map((w) => w.region))].sort((a, b) => a.localeCompare(b, 'de'));
  return {
    version: 2,
    source: 'OpenStreetMap contributors (ODbL), via Overpass API',
    generated: new Date().toISOString().slice(0, 10),
    regions,
    waters,
    near: nearBB
  };
}

/** Brandenburg first, then (optionally) the Polish part; one file with Brandenburg regions listed first. */
export function buildAll(osmBB, osmPL) {
  const bb = buildWaters(osmBB);
  const pl = osmPL ? buildWaters(osmPL, { pl: true, skipNear: bb.near }) : null;
  const ids = new Set(bb.waters.map((w) => w.id));
  const plWaters = (pl?.waters ?? []).filter((w) => !ids.has(w.id));
  return {
    version: 3,
    source: bb.source,
    generated: bb.generated,
    regions: [...bb.regions, ...(pl?.regions ?? [])],
    waters: [...bb.waters, ...plWaters]
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Runs a query; on failure waits for the rate limit to clear and tries again (other servers on the way). */
async function overpass(query, label) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const ep of ENDPOINTS) {
      console.log(`Querying ${ep} for ${label} ...`);
      try {
        const res = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'fangbuch-brandenburg-import' },
          body: 'data=' + encodeURIComponent(query)
        });
        if (!res.ok) throw new Error(`Overpass error ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const osm = await res.json();
        if (osm.remark && /runtime error|timed out|out of memory/i.test(osm.remark)) throw new Error(osm.remark);
        if (!osm.elements?.length) throw new Error('no elements (area not found?)');
        console.log(`  ${osm.elements?.length ?? 0} elements`);
        return osm;
      } catch (e) {
        last = e;
        console.log(`  failed: ${String(e.message).split('\n')[0]}`);
        await sleep(ep === ENDPOINTS[0] ? 120_000 : 15_000);
      }
    }
  }
  throw last;
}

const mergeOsm = (parts) => ({ elements: parts.flatMap((p) => p.elements ?? []) });

async function main() {
  const osmBB = args.from ? JSON.parse(await readFile(args.from, 'utf8')) : await overpass(QUERY_BB, 'Brandenburg');
  let osmPL = null;
  if (!('no-pl' in args)) {
    if (args['from-pl']) osmPL = JSON.parse(await readFile(args['from-pl'], 'utf8'));
    else if (!args.from) {
      const parts = [];
      for (const [code, label] of [['LB|08', 'Lubuskie'], ['ZP|32', 'Zachodniopomorskie']]) {
        await sleep(90_000); // let the rate limit from the previous query clear
        parts.push(await overpass(QUERY_PL(code), `${label} (Poland)`));
      }
      osmPL = mergeOsm(parts);
    }
  }
  const result = buildAll(osmBB, osmPL);
  const json = JSON.stringify(result);
  await writeFile(new URL('../public/waters.json', import.meta.url), json + '\n');
  const counts = result.waters.reduce((m, w) => ((m[`${w.cc ?? 'DE'} ${w.type}`] = (m[`${w.cc ?? 'DE'} ${w.type}`] ?? 0) + 1), m), {});
  console.log(`Wrote ${result.waters.length} waters (${JSON.stringify(counts)}), ${(json.length / 1024 / 1024).toFixed(1)} MB`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
