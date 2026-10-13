// Background sync between the local database and Supabase.
// Push: upload rows with dirty = 1 (profile, then trips, then catches, because catches reference trips).
// Pull: after signing in on a new device, download the angler's existing entries.
import { db, getKV, setKV, surveyKey, wipeLocal, type Catch, type Profile, type SurveyResponse, type Trip } from './db';
import { SURVEY } from '../data/survey';
import { supabase } from './supabase';

type Listener = (s: SyncState) => void;
export type SyncState = { running: boolean; lastOk: number | null; lastError: string | null };

let state: SyncState = { running: false, lastOk: null, lastError: null };
const listeners = new Set<Listener>();
const emit = (patch: Partial<SyncState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
};
export const subscribeSync = (l: Listener) => {
  listeners.add(l);
  l(state);
  return () => listeners.delete(l);
};

const tripToRow = (t: Trip, userId: string) => ({
  id: t.id,
  user_id: userId,
  water_id: t.waterId,
  water_name: t.waterName,
  water_other: t.waterOther,
  water_choice: t.waterChoice,
  water_gps_distance_m: t.waterGpsDistanceM,
  logged_live: t.loggedLive,
  started_at: t.startedAt,
  ended_at: t.endedAt,
  method: t.method,
  platform: t.platform,
  targets: t.targets,
  satisfaction: t.satisfaction,
  deleted: t.deleted
});

const catchToRow = (c: Catch, userId: string) => ({
  id: c.id,
  trip_id: c.tripId,
  user_id: userId,
  species: c.species,
  count: c.count,
  length_cm: c.lengthCm,
  kept: c.kept,
  caught_at: c.caughtAt,
  deleted: c.deleted
});

const profileToRow = (p: Profile, userId: string, lang: string) => ({
  id: userId,
  lang,
  years_fishing: p.yearsFishing,
  home_country: p.homeCountry,
  home_postcode: p.homePostcode || null,
  club_status: p.clubStatus,
  club_name: p.clubName || null,
  has_fishing_exam: p.hasFishingExam,
  licenses: p.licenses,
  licenses_other: p.licensesOther || null,
  consent_version: p.consentVersion,
  consent_at: p.consentAt
});

/** Marks rows clean, but only if they were not edited again while the upload was running. */
async function markClean<T extends { id: string; updatedAt: number }>(table: 'trips' | 'catches', rows: T[]) {
  await db.transaction('rw', db[table], async () => {
    for (const r of rows) {
      const cur = await db[table].get(r.id);
      if (cur && cur.updatedAt === r.updatedAt) await db[table].update(r.id, { dirty: 0 });
    }
  });
}

export async function pendingCount() {
  const [t, c, p, s] = await Promise.all([
    db.trips.where('dirty').equals(1).count(),
    db.catches.where('dirty').equals(1).count(),
    getKV<Profile | null>('profile', null),
    getKV<SurveyResponse | null>(surveyKey(SURVEY.id), null)
  ]);
  return t + c + (p?.dirty ? 1 : 0) + (s?.dirty ? 1 : 0);
}

export async function syncNow(): Promise<void> {
  if (!supabase || state.running || !navigator.onLine) return;
  const { data: sess } = await supabase.auth.getSession();
  let userId = sess.session?.user.id;
  if (!userId) {
    // First start happened offline: create the anonymous account now. Never do this if the
    // device already belonged to an account (signed out), so data is not attached to a new one.
    const owner = await getKV<string | null>('ownerId', null);
    const prof = await getKV<Profile | null>('profile', null);
    if (owner || !prof) return;
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) return;
    userId = data.user.id;
    await setKV('ownerId', userId);
  }
  emit({ running: true, lastError: null });
  try {
    const lang = await getKV<string>('lang', 'de');
    const profile = await getKV<Profile | null>('profile', null);
    if (profile?.dirty) {
      const { error } = await supabase.from('profiles').upsert(profileToRow(profile, userId, lang));
      if (error) throw error;
      const cur = await getKV<Profile | null>('profile', null);
      if (cur && cur.updatedAt === profile.updatedAt) await setKV('profile', { ...cur, dirty: 0 });
    }

    const trips = await db.trips.where('dirty').equals(1).toArray();
    if (trips.length) {
      const { error } = await supabase.from('trips').upsert(trips.map((t) => tripToRow(t, userId)));
      if (error) throw error;
      await markClean('trips', trips);
    }

    const catches = await db.catches.where('dirty').equals(1).toArray();
    if (catches.length) {
      const { error } = await supabase.from('catches').upsert(catches.map((c) => catchToRow(c, userId)));
      if (error) throw error;
      await markClean('catches', catches);
    }

    const survey = await getKV<SurveyResponse | null>(surveyKey(SURVEY.id), null);
    if (survey?.dirty) {
      const { error } = await supabase.from('survey_responses').upsert(
        {
          id: survey.id,
          user_id: userId,
          survey_id: survey.surveyId,
          survey_version: survey.version,
          answers: survey.answers,
          started_at: survey.startedAt,
          completed_at: survey.completedAt
        },
        { onConflict: 'user_id,survey_id' }
      );
      if (error) throw error;
      const cur = await getKV<SurveyResponse | null>(surveyKey(SURVEY.id), null);
      if (cur && cur.updatedAt === survey.updatedAt) await setKV(surveyKey(SURVEY.id), { ...cur, dirty: 0 });
    }
    emit({ running: false, lastOk: Date.now() });
  } catch (e) {
    console.warn('Sync failed', e);
    emit({ running: false, lastError: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e) });
  }
}

/** Downloads the signed-in angler's data. Used after signing in on a new device. */
export async function pullAll(): Promise<void> {
  if (!supabase) return;
  const { data: sess } = await supabase.auth.getSession();
  const userId = sess.session?.user.id;
  if (!userId) return;

  const [{ data: p }, { data: trips }, { data: catches }, { data: survey }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('trips').select('*').eq('deleted', false),
    supabase.from('catches').select('*').eq('deleted', false),
    supabase.from('survey_responses').select('*').eq('survey_id', SURVEY.id).maybeSingle()
  ]);

  if (survey) {
    const local = await getKV<SurveyResponse | null>(surveyKey(SURVEY.id), null);
    if (!local?.dirty) {
      await setKV(surveyKey(SURVEY.id), {
        id: survey.id,
        surveyId: survey.survey_id,
        version: survey.survey_version,
        answers: survey.answers ?? {},
        page: survey.completed_at ? 0 : local?.page ?? 0,
        startedAt: survey.started_at,
        completedAt: survey.completed_at,
        snoozedUntil: local?.snoozedUntil ?? null,
        dirty: 0,
        updatedAt: Date.now()
      } satisfies SurveyResponse);
    }
  }

  if (p) {
    const local = await getKV<Profile | null>('profile', null);
    if (!local?.dirty) {
      await setKV('profile', {
        yearsFishing: p.years_fishing,
        homeCountry: p.home_country,
        homePostcode: p.home_postcode ?? '',
        clubStatus: p.club_status,
        clubName: p.club_name ?? '',
        hasFishingExam: p.has_fishing_exam,
        licenses: p.licenses ?? [],
        licensesOther: p.licenses_other ?? '',
        consentVersion: p.consent_version,
        consentAt: p.consent_at,
        dirty: 0,
        updatedAt: Date.now()
      } satisfies Profile);
      if (p.lang) await setKV('lang', p.lang);
    }
  }

  await db.transaction('rw', db.trips, db.catches, async () => {
    for (const r of trips ?? []) {
      const local = await db.trips.get(r.id);
      if (local?.dirty) continue;
      await db.trips.put({
        id: r.id,
        waterId: r.water_id,
        waterName: r.water_name,
        waterOther: r.water_other,
        waterChoice: r.water_choice,
        waterGpsDistanceM: r.water_gps_distance_m,
        loggedLive: r.logged_live,
        startedAt: r.started_at,
        endedAt: r.ended_at,
        method: r.method,
        platform: r.platform,
        targets: r.targets ?? [],
        satisfaction: r.satisfaction,
        deleted: false,
        dirty: 0,
        updatedAt: Date.now()
      });
    }
    for (const r of catches ?? []) {
      const local = await db.catches.get(r.id);
      if (local?.dirty) continue;
      await db.catches.put({
        id: r.id,
        tripId: r.trip_id,
        species: r.species,
        count: r.count,
        lengthCm: r.length_cm === null ? null : Number(r.length_cm),
        kept: r.kept,
        caughtAt: r.caught_at,
        deleted: false,
        dirty: 0,
        updatedAt: Date.now()
      });
    }
  });
}

/**
 * Makes sure local data belongs to the signed-in user. If a different account signs in on this
 * device, local data from the previous account is cleared and the new account's data downloaded.
 */
export async function adoptSession(userId: string) {
  const owner = await getKV<string | null>('ownerId', null);
  if (owner && owner !== userId) await wipeLocal();
  if (owner !== userId) {
    await setKV('ownerId', userId);
    await pullAll();
  }
}

let timer: number | undefined;
/** Debounced sync, call after every local change. */
export function scheduleSync(delay = 1500) {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void syncNow(), delay);
}

export function startAutoSync() {
  window.addEventListener('online', () => scheduleSync(500));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSync(500);
  });
  window.setInterval(() => void syncNow(), 60_000);
  scheduleSync(500);
}
