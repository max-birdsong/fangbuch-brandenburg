// Local, offline-first storage (IndexedDB via Dexie). Everything is written here first and
// synced to Supabase in the background (see sync.ts). `dirty = 1` marks rows not yet uploaded.
import Dexie, { type Table } from 'dexie';
import type { Lang } from '../data/catalog';

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
  lotteryOptIn: boolean;
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
