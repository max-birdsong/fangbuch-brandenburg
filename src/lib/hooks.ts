import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getKV, surveyKey, type Catch, type Profile, type SurveyResponse, type Trip } from './db';
import { SURVEY } from '../data/survey';
import { subscribeSync, type SyncState } from './sync';
import { loadWaters, type WatersFile } from './waters';

export const useTrips = () =>
  useLiveQuery(async () => (await db.trips.orderBy('startedAt').reverse().toArray()).filter((t) => !t.deleted), [], undefined as Trip[] | undefined);

export const useTrip = (id: string | undefined) =>
  useLiveQuery(async () => (id ? (await db.trips.get(id)) ?? null : null), [id], undefined as Trip | null | undefined);

export const useCatches = (tripId?: string) =>
  useLiveQuery(
    async () => {
      const rows = tripId ? await db.catches.where('tripId').equals(tripId).toArray() : await db.catches.toArray();
      return rows.filter((c) => !c.deleted).sort((a, b) => (a.caughtAt ?? '').localeCompare(b.caughtAt ?? ''));
    },
    [tripId],
    undefined as Catch[] | undefined
  );

export const useProfile = () => useLiveQuery(() => getKV<Profile | null>('profile', null), [], undefined as Profile | null | undefined);

export const useKV = <T,>(key: string, fallback: T) => useLiveQuery(() => getKV<T>(key, fallback), [key], fallback);

export const usePending = () =>
  useLiveQuery(async () => {
    const [t, c, p, s] = await Promise.all([
      db.trips.where('dirty').equals(1).count(),
      db.catches.where('dirty').equals(1).count(),
      getKV<Profile | null>('profile', null),
      getKV<SurveyResponse | null>(surveyKey(SURVEY.id), null)
    ]);
    return t + c + (p?.dirty ? 1 : 0) + (s?.dirty ? 1 : 0);
  }, [], 0);

export const useSurvey = () =>
  useLiveQuery(() => getKV<SurveyResponse | null>(surveyKey(SURVEY.id), null), [], undefined as SurveyResponse | null | undefined);

export function useSyncState() {
  const [s, setS] = useState<SyncState>({ running: false, lastOk: null, lastError: null });
  useEffect(() => {
    const unsub = subscribeSync(setS);
    return () => {
      unsub();
    };
  }, []);
  return s;
}

export function useWaters() {
  const [file, setFile] = useState<WatersFile | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    loadWaters().then(setFile, () => setError(true));
  }, []);
  return { file, error };
}

export function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false);
    window.addEventListener('online', a);
    window.addEventListener('offline', b);
    return () => {
      window.removeEventListener('online', a);
      window.removeEventListener('offline', b);
    };
  }, []);
  return on;
}

/** Aggregates for a list of trips + catches. Counts use the catch `count` field. */
export function summarize(trips: Trip[], catches: Catch[]) {
  const ids = new Set(trips.map((t) => t.id));
  const cs = catches.filter((c) => ids.has(c.tripId));
  const fish = cs.reduce((s, c) => s + c.count, 0);
  const released = cs.filter((c) => !c.kept).reduce((s, c) => s + c.count, 0);
  return {
    days: trips.length,
    fish,
    species: new Set(cs.map((c) => c.species)).size,
    releasedPct: fish ? Math.round((released / fish) * 100) : null
  };
}
