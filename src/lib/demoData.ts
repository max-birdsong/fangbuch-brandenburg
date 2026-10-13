// Made-up pilot data for previewing the dashboard. Generated in memory, never stored or synced.
import type { AdminData, ACatch, ASurvey, ATrip } from './admin';
import { allItems } from '../data/survey';

export function exampleData(): AdminData {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  // [water id, name, typical fish per hour]
  const waters: [string, string, number][] = [
    ['oder-bei-frankfurt-oder', 'Oder bei Frankfurt (Oder)', 0.9], ['oder-bei-schwedt', 'Oder bei Schwedt', 0.7],
    ['sacrower-see', 'Sacrower See', 0.5], ['scharmuetzelsee', 'Scharmützelsee', 0.35], ['havel-bei-potsdam', 'Havel bei Potsdam', 0.6],
    ['werbellinsee', 'Werbellinsee', 0.3], ['spree-bei-cottbus', 'Spree bei Cottbus', 0.45], ['parsteiner-see', 'Parsteiner See', 0.25]
  ];
  const species = ['zander', 'pike', 'perch', 'perch', 'roach', 'bream', 'asp', 'eel', 'wels', 'ide', 'tench', 'round_goby'];
  const anglers = Array.from({ length: 24 }, (_, i) => `example-${i + 1}`);
  const trips: ATrip[] = [];
  const catches: ACatch[] = [];
  const now = Date.now();
  for (let i = 0; i < 180; i++) {
    const [waterId, waterName, rate] = pick(waters);
    const start = new Date(now - Math.floor(rnd() * 150) * 86_400_000);
    start.setHours(5 + Math.floor(rnd() * 12), 0, 0, 0);
    const hours = 1.5 + rnd() * 5;
    const id = `example-trip-${i}`;
    trips.push({
      id, userId: pick(anglers), waterId, waterName, startedAt: start.toISOString(),
      endedAt: new Date(start.getTime() + hours * 3_600_000).toISOString(),
      method: pick(['spin', 'bottom', 'float', 'feeder']), platform: pick(['shore', 'shore', 'boat']),
      satisfaction: 1 + Math.floor(rnd() * 5), loggedLive: rnd() < 0.8
    });
    const n = Math.floor(rnd() * rate * hours * 1.6);
    for (let j = 0; j < n; j++) {
      catches.push({ tripId: id, species: pick(species), count: rnd() < 0.15 ? 2 + Math.floor(rnd() * 6) : 1, lengthCm: 20 + Math.floor(rnd() * 50), kept: rnd() < 0.3 });
    }
  }
  const items = allItems();
  const surveys: ASurvey[] = anglers.slice(0, 15).map((userId) => {
    const answers: Record<string, number | string> = {};
    for (const it of items) {
      if (it.type === 'likert') answers[it.id] = Math.max(1, Math.min(5, Math.round(3 + (rnd() - 0.4) * 3)));
      else if (it.type === 'single') answers[it.id] = pick(it.options).code;
      else if (it.type === 'year') answers[it.id] = 1950 + Math.floor(rnd() * 55);
      else answers[it.id] = Math.floor(rnd() * 80);
    }
    return { userId, answers, completedAt: new Date().toISOString() };
  });
  return {
    source: 'example',
    trips,
    catches,
    surveys,
    profiles: anglers.map((userId) => ({ userId, homeCountry: 'DE', homePostcode: null, clubStatus: pick(['active', 'passive', 'none']), yearsFishing: Math.floor(rnd() * 40) })),
    loadedAt: new Date()
  };
}
