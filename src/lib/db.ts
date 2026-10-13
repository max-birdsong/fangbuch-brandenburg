// Local, offline-first storage (IndexedDB via Dexie). Everything is written here first and
// synced to Supabase in the background (see sync.ts). `dirty = 1` marks rows not yet uploaded.
import Dexie, { type Table } from 'dexie';
import type { Lang } from '../data/catalog';
import { uuid } from './util';

export type WaterChoice = 'gps' | 'recent' | 'search' | 'manual' | 'other';

export interface Trip {
  id: string;
  waterId: string | null;
  waterName: string;
  waterOther: string | null;
  waterChoice: WaterChoice;
  waterGpsDistanceM: number | null;
  loggedLive: boolean;
  startedAt: string; // ISO
  endedAt: string | null;
  method: string | null;
  platform: string | null;
  targets: string[];
  satisfaction: number | null;
  deleted: boolean;
  dirty: 0 | 1;
  updatedAt: number;
}

export interface Catch {
  id: string;
  tripId: string;
  species: string;
  count: number;
  lengthCm: number | null;
  kept: boolean;
  caughtAt: string | null;
  deleted: boolean;
  dirty: 0 | 1;
  updatedAt: number;
}

export interface Profile {
  yearsFishing: number | null;
  homeCountry: 'DE' | 'PL' | 'other' | null;
  homePostcode: string;
  clubStatus: 'active' | 'passive' | 'none' | null;
  clubName: string;
  hasFishingExam: boolean | null;
  licenses: string[];
  licensesOther: string;
  consentVersion: string;
  consentAt: string;
  dirty: 0 | 1;
  updatedAt: number;
}

export interface KV {
  key: string;
  value: unknown;
}

class FangbuchDB extends Dexie {
  trips!: Table<Trip, string>;
  catches!: Table<Catch, string>;
  kv!: Table<KV, string>;
  constructor() {
    super('fangbuch');
    this.version(1).stores({
      trips: 'id, startedAt, dirty',
      catches: 'id, tripId, dirty',
      kv: 'key'
    });
  }
}

export const db = new FangbuchDB();

export const CONSENT_VERSION = '2026-10-pilot';

export async function getKV<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key);
  return row ? (row.value as T) : fallback;
}
export const setKV = (key: string, value: unknown) => db.kv.put({ key, value });

export const getProfile = () => getKV<Profile | null>('profile', null);
export const saveProfile = (p: Omit<Profile, 'dirty' | 'updatedAt'>) =>
  setKV('profile', { ...p, dirty: 1, updatedAt: Date.now() });

export const getLang = () => getKV<Lang>('lang', 'de');

export async function saveTrip(t: Omit<Trip, 'dirty' | 'updatedAt'>) {
  await db.trips.put({ ...t, dirty: 1, updatedAt: Date.now() });
}
export async function updateTrip(id: string, patch: Partial<Trip>) {
  await db.trips.update(id, { ...patch, dirty: 1, updatedAt: Date.now() });
}
export async function saveCatch(c: Omit<Catch, 'dirty' | 'updatedAt'>) {
  await db.catches.put({ ...c, dirty: 1, updatedAt: Date.now() });
}
export async function deleteCatch(id: string) {
  await db.catches.update(id, { deleted: true, dirty: 1, updatedAt: Date.now() });
}
export async function deleteTrip(id: string) {
  await db.transaction('rw', db.trips, db.catches, async () => {
    const now = Date.now();
    await db.trips.update(id, { deleted: true, dirty: 1, updatedAt: now });
    await db.catches.where('tripId').equals(id).modify({ deleted: true, dirty: 1, updatedAt: now });
  });
}

export async function rememberWater(id: string) {
  const recent = await getKV<string[]>('recentWaters', []);
  await setKV('recentWaters', [id, ...recent.filter((x) => x !== id)].slice(0, 6));
}

export async function wipeLocal() {
  await db.transaction('rw', db.trips, db.catches, db.kv, async () => {
    const lang = await db.kv.get('lang');
    await db.trips.clear();
    await db.catches.clear();
    await db.kv.clear();
    if (lang) await db.kv.put(lang);
  });
}

// ---------------------------------------------------------------- survey
export type SurveyAnswer = number | string;
export interface SurveyResponse {
  id: string;
  surveyId: string;
  version: number;
  answers: Record<string, SurveyAnswer>;
  page: number; // where to resume
  startedAt: string;
  completedAt: string | null;
  snoozedUntil: number | null; // "Später" on the home card (local only)
  dirty: 0 | 1;
  updatedAt: number;
}

export const surveyKey = (surveyId: string) => `survey:${surveyId}`;
export const getSurvey = (surveyId: string) => getKV<SurveyResponse | null>(surveyKey(surveyId), null);
export async function saveSurvey(r: SurveyResponse, localOnly = false) {
  await setKV(surveyKey(r.surveyId), { ...r, dirty: localOnly ? r.dirty : 1, updatedAt: Date.now() });
}

/** Atomic read-modify-write, so quick successive answers never overwrite each other. */
export async function patchSurvey(surveyId: string, fn: (r: SurveyResponse) => SurveyResponse) {
  await db.transaction('rw', db.kv, async () => {
    const cur = await db.kv.get(surveyKey(surveyId));
    if (!cur) return;
    const next = fn(cur.value as SurveyResponse);
    await db.kv.put({ key: surveyKey(surveyId), value: { ...next, dirty: 1, updatedAt: Date.now() } });
  });
}

/**
 * End-of-trip report: set the number of fish per species x kept/released for a trip.
 * Existing entries are kept where possible: extra fish become a new entry without length;
 * fewer fish are taken from entries without a length first, so measured fish survive.
 */
export async function applyReport(
  tripId: string,
  target: { species: string; kept: boolean; count: number }[],
  caughtAt: string | null,
  lengths: { species: string; kept: boolean; lengthCm: number }[] = []
) {
  await db.transaction('rw', db.catches, async () => {
    const now = Date.now();
    // 1) Measured fish: keep existing measurements that are still listed, drop the others,
    //    and give new lengths to unmeasured fish of the same species and fate (or add fish).
    const all = (await db.catches.where('tripId').equals(tripId).toArray()).filter((c) => !c.deleted);
    const lkey = (sp: string, kept: boolean) => `${sp}|${kept ? 1 : 0}`;
    const wanted = new Map<string, number[]>();
    for (const l of lengths) wanted.set(lkey(l.species, l.kept), [...(wanted.get(lkey(l.species, l.kept)) ?? []), l.lengthCm]);
    const groupKeys = new Set([...wanted.keys(), ...all.filter((c) => c.lengthCm !== null).map((c) => lkey(c.species, c.kept))]);
    for (const k of groupKeys) {
      const [species, keptFlag] = k.split('|');
      const kept = keptFlag === '1';
      const D = [...(wanted.get(k) ?? [])];
      const group = all.filter((c) => lkey(c.species, c.kept) === k);
      for (const r of group.filter((c) => c.lengthCm !== null)) {
        let keep = 0;
        for (let i = 0; i < r.count; i++) {
          const j = D.indexOf(r.lengthCm!);
          if (j < 0) break;
          D.splice(j, 1);
          keep++;
        }
        if (keep === 0) await db.catches.update(r.id, { deleted: true, dirty: 1, updatedAt: now });
        else if (keep < r.count) await db.catches.update(r.id, { count: keep, dirty: 1, updatedAt: now });
      }
      const unmeasured = group.filter((c) => c.lengthCm === null).map((c) => ({ ...c }));
      for (const L of D) {
        const u = unmeasured.find((c) => c.count > 0);
        if (u && u.count === 1) {
          await db.catches.update(u.id, { lengthCm: L, dirty: 1, updatedAt: now });
          u.count = 0;
        } else {
          if (u) {
            u.count -= 1;
            await db.catches.update(u.id, { count: u.count, dirty: 1, updatedAt: now });
          }
          await db.catches.put({ id: uuid(), tripId, species, count: 1, lengthCm: L, kept, caughtAt: u?.caughtAt ?? caughtAt, deleted: false, dirty: 1, updatedAt: now });
        }
      }
    }
    // 2) Counts per species x fate.
    const rows = (await db.catches.where('tripId').equals(tripId).toArray()).filter((c) => !c.deleted);
    const key = (sp: string, kept: boolean) => `${sp}|${kept ? 1 : 0}`;
    const want = new Map(target.map((t) => [key(t.species, t.kept), t.count]));
    const groups = new Map<string, Catch[]>();
    for (const r of rows) groups.set(key(r.species, r.kept), [...(groups.get(key(r.species, r.kept)) ?? []), r]);
    for (const k of new Set([...want.keys(), ...groups.keys()])) {
      const [species, keptFlag] = k.split('|');
      const kept = keptFlag === '1';
      const have = groups.get(k) ?? [];
      let diff = (want.get(k) ?? 0) - have.reduce((s, r) => s + r.count, 0);
      if (diff > 0) {
        await db.catches.put({ id: uuid(), tripId, species, count: diff, lengthCm: null, kept, caughtAt, deleted: false, dirty: 1, updatedAt: now });
      } else if (diff < 0) {
        const order = [...have].sort(
          (a, b) => Number(a.lengthCm !== null) - Number(b.lengthCm !== null) || (b.caughtAt ?? '').localeCompare(a.caughtAt ?? '')
        );
        for (const r of order) {
          if (diff === 0) break;
          const take = Math.min(r.count, -diff);
          diff += take;
          if (take === r.count) await db.catches.update(r.id, { deleted: true, dirty: 1, updatedAt: now });
          else await db.catches.update(r.id, { count: r.count - take, dirty: 1, updatedAt: now });
        }
      }
    }
  });
}
