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

/** Saves a fishing day's catch list: one record per fish (old records are marked deleted). */
export async function replaceCatches(tripId: string, fish: { species: string; count: number; kept: boolean; lengthCm: number | null }[]) {
  await db.transaction('rw', db.catches, async () => {
    const now = Date.now();
    const old = (await db.catches.where('tripId').equals(tripId).toArray()).filter((c) => !c.deleted);
    for (const c of old) await db.catches.update(c.id, { deleted: true, dirty: 1, updatedAt: now });
    // updatedAt + index keeps the angler's order when the day is opened again.
    for (const [i, f] of fish.entries()) {
      await db.catches.put({ id: uuid(), tripId, species: f.species, count: f.count, lengthCm: f.count > 1 ? null : f.lengthCm, kept: f.kept, caughtAt: null, deleted: false, dirty: 1, updatedAt: now + i });
    }
  });
}
