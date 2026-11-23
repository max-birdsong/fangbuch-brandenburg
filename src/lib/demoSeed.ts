// Example days for the "try without an account" demo, so the statistics have something to show.
// Only ever written to the separate demo database (see demo.ts).
import { CONSENT_VERSION, db, getKV, setKV } from './db';
import { uuid } from './util';

const WATERS: [string, string, number][] = [
  ['oder-bei-frankfurt-oder', 'Oder bei Frankfurt (Oder)', 0.9],
  ['oder-bei-schwedt', 'Oder bei Schwedt', 0.7],
  ['parsteiner-see', 'Parsteiner See', 0.4]
];
const SPECIES: [string, number, number][] = [
  // code, typical min cm, typical max cm
  ['zander', 38, 72], ['perch', 14, 34], ['pike', 45, 88], ['asp', 40, 68], ['bream', 25, 50], ['roach', 12, 26], ['ide', 30, 50], ['burbot', 35, 55]
];

export async function seedDemo() {
  if (await getKV<boolean>('demoSeeded', false)) return;
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const now = Date.now();
  const lang = await getKV<string>('lang', 'de');
  await setKV('profile', {
    yearsFishing: 12, homeCountry: lang === 'pl' ? 'PL' : 'DE', homePostcode: '', clubStatus: 'active', clubName: '',
    hasFishingExam: true, licenses: [], licensesOther: '', contactOptIns: [], consentVersion: CONSENT_VERSION,
    consentAt: new Date().toISOString(), dirty: 0, updatedAt: now
  });
  for (let i = 0; i < 16; i++) {
    const [waterId, waterName, rate] = WATERS[Math.floor(rnd() * (i < 10 ? 2 : 3))];
    const start = new Date(now - (2 + Math.floor(i * 4.5 + rnd() * 3)) * 86_400_000);
    start.setHours(rnd() < 0.6 ? 5 + Math.floor(rnd() * 3) : 16 + Math.floor(rnd() * 3), 0, 0, 0);
    const hours = 2 + Math.round(rnd() * 6) / 2;
    const id = uuid();
    await db.trips.put({
      id, waterId, waterName, waterOther: null, waterChoice: 'recent', waterGpsDistanceM: null, loggedLive: true,
      startedAt: start.toISOString(), endedAt: new Date(start.getTime() + hours * 3_600_000).toISOString(),
      method: rnd() < 0.7 ? 'spin' : 'feeder', platform: rnd() < 0.8 ? 'shore' : 'boat', targets: ['zander'],
      satisfaction: 2 + Math.floor(rnd() * 4), deleted: false, dirty: 0, updatedAt: now
    });
    const n = rnd() < 0.25 ? 0 : Math.round(rate * hours * (0.4 + rnd()));
    for (let k = 0; k < n; k++) {
      const [species, lo, hi] = SPECIES[Math.floor(rnd() * Math.min(SPECIES.length, 3 + i / 2))];
      await db.catches.put({
        id: uuid(), tripId: id, species, count: 1, lengthCm: rnd() < 0.85 ? Math.round(lo + rnd() * (hi - lo)) : null,
        kept: rnd() < 0.3, caughtAt: null, deleted: false, dirty: 0, updatedAt: now + k
      });
    }
  }
  await setKV('demoSeeded', true);
}
