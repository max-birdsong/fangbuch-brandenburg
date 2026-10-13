// Water bodies: loaded from /waters.json (cached by the service worker, so it works offline).
// Nearest-water matching runs entirely on the phone; coordinates never leave the device.

export interface Water {
  id: string;
  name: string;
  type: 'lake' | 'river' | 'canal' | 'oxbow' | string;
  region: string;
  lat: number;
  lon: number;
  ha?: number;
  geom?: { t: 'poly' | 'line'; c: number[][][] }; // [lon, lat] coordinates
}
export interface WatersFile {
  version: number;
  source: string;
  regions: string[];
  waters: Water[];
}

let cache: Promise<WatersFile> | null = null;
export function loadWaters(): Promise<WatersFile> {
  if (!cache) {
    cache = fetch(`${import.meta.env.BASE_URL}waters.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`waters.json ${r.status}`);
        return r.json() as Promise<WatersFile>;
      })
      .catch((e) => {
        cache = null;
        throw e;
      });
  }
  return cache;
}

// Local metric projection around a reference latitude; accurate enough at Brandenburg scale.
const proj = (lat0: number) => {
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110540;
  return (lon: number, lat: number): [number, number] => [lon * kx, lat * ky];
};

function segDist(p: [number, number], a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function inRing(x: number, y: number, ring: [number, number][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Distance in metres from a point to a water body (0 if inside a lake). */
export function distanceTo(w: Water, lat: number, lon: number): number {
  const f = proj(lat);
  const p = f(lon, lat);
  if (!w.geom) {
    const q = f(w.lon, w.lat);
    return Math.hypot(p[0] - q[0], p[1] - q[1]);
  }
  let best = Infinity;
  for (const part of w.geom.c) {
    const pts = part.map(([x, y]) => f(x, y));
    if (w.geom.t === 'poly' && inRing(p[0], p[1], pts)) return 0;
    for (let i = 1; i < pts.length; i++) best = Math.min(best, segDist(p, pts[i - 1], pts[i]));
  }
  return best;
}

/** Waters near a position, nearest first. */
export function nearestWaters(file: WatersFile, lat: number, lon: number, maxM = 10_000, limit = 5) {
  // Quick prefilter on the reference point (rivers sections are long, so be generous).
  const f = proj(lat);
  const p = f(lon, lat);
  return file.waters
    .filter((w) => {
      const q = f(w.lon, w.lat);
      return Math.hypot(p[0] - q[0], p[1] - q[1]) < maxM + 40_000;
    })
    .map((w) => ({ water: w, distanceM: Math.round(distanceTo(w, lat, lon)) }))
    .filter((x) => x.distanceM <= maxM)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
}

/** How close the nearest water must be to be preselected automatically. */
export const autoSelectRadius = (file: WatersFile) =>
  file.waters.some((w) => w.geom) ? 300 : 3000; // starter list only has rough points

const norm = (s: string) =>
  s.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9 ]+/g, ' ');

/** Simple word search: every typed word must appear in the name or region. */
export function searchWaters(file: WatersFile, q: string, limit = 8): Water[] {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return file.waters
    .map((w) => {
      const hay = norm(`${w.name} ${w.region}`);
      if (!words.every((x) => hay.includes(x))) return null;
      const score = norm(w.name).startsWith(words[0]) ? 0 : 1;
      return { w, score };
    })
    .filter((x): x is { w: Water; score: number } => !!x)
    .sort((a, b) => a.score - b.score || a.w.name.localeCompare(b.w.name, 'de'))
    .slice(0, limit)
    .map((x) => x.w);
}

export function getPosition(timeoutMs = 12_000): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('no geolocation'));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: 60_000
    });
  });
}

/** 'granted' | 'denied' | 'prompt' | 'unknown' without triggering a prompt. */
export async function locationPermission(): Promise<string> {
  try {
    const s = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    return s.state;
  } catch {
    return 'unknown';
  }
}
