// Personal statistics for the angler's own dashboard (the "Statistik" tab). Everything is computed
// on the phone from the angler's own entries, so it works offline. Community numbers come from the
// server (community_stats in supabase/schema.sql) and are only shown when enough anglers took part.
import type { Catch, Trip } from './db';

export const hoursOf = (t: Trip) =>
  t.endedAt ? Math.max(0, (new Date(t.endedAt).getTime() - new Date(t.startedAt).getTime()) / 3_600_000) : 0;

export const yearOf = (t: Trip) => new Date(t.startedAt).getFullYear();

/** Years the angler has entries for, newest first (always includes the current year). */
export function seasons(trips: Trip[]): number[] {
  const ys = new Set(trips.map(yearOf));
  ys.add(new Date().getFullYear());
  return [...ys].sort((a, b) => b - a);
}

export interface Best {
  species: string;
  cm: number;
  date: string;
  water: string;
  isNew: boolean; // set in the last 30 days
}

export interface PersonalStats {
  days: number;
  hours: number;
  fish: number;
  zeroDays: number;
  perHour: number | null;
  releasedPct: number | null;
  speciesCount: number;
  bySpecies: { species: string; n: number; kept: number }[];
  bests: Best[]; // biggest measured fish per species (all years)
  byMonth: { month: number; days: number; hours: number; fish: number }[]; // 0..11, months with days only
  byWater: { water: string; days: number; hours: number; fish: number; perHour: number }[];
  byTimeOfDay: { slot: 'morning' | 'day' | 'evening' | 'night'; days: number; hours: number; fish: number; perHour: number | null }[];
}

const slotOf = (iso: string): 'morning' | 'day' | 'evening' | 'night' => {
  const h = new Date(iso).getHours();
  if (h >= 4 && h < 10) return 'morning';
  if (h >= 10 && h < 16) return 'day';
  if (h >= 16 && h < 22) return 'evening';
  return 'night';
};

export const tripWater = (t: Trip) => (t.waterOther || t.waterName || '').trim();

/**
 * season: a year, or 'all'. Personal bests always look at all years (a record is a record).
 */
export function personalStats(allTrips: Trip[], allCatches: Catch[], season: number | 'all', now = Date.now()): PersonalStats {
  const trips = allTrips.filter((t) => !t.deleted && (season === 'all' || yearOf(t) === season));
  const ids = new Set(trips.map((t) => t.id));
  const byTrip = new Map<string, Catch[]>();
  for (const c of allCatches) if (!c.deleted) byTrip.set(c.tripId, [...(byTrip.get(c.tripId) ?? []), c]);
  const fishOf = (t: Trip) => (byTrip.get(t.id) ?? []).reduce((s, c) => s + c.count, 0);

  const cs = allCatches.filter((c) => !c.deleted && ids.has(c.tripId));
  const fish = cs.reduce((s, c) => s + c.count, 0);
  const kept = cs.filter((c) => c.kept).reduce((s, c) => s + c.count, 0);
  const finished = trips.filter((t) => t.endedAt);
  const hours = finished.reduce((s, t) => s + hoursOf(t), 0);
  const fishFinished = finished.reduce((s, t) => s + fishOf(t), 0);

  const sp = new Map<string, { n: number; kept: number }>();
  for (const c of cs) {
    const x = sp.get(c.species) ?? { n: 0, kept: 0 };
    x.n += c.count;
    if (c.kept) x.kept += c.count;
    sp.set(c.species, x);
  }

  // Personal bests over all years, single measured fish only.
  const tripById = new Map(allTrips.filter((t) => !t.deleted).map((t) => [t.id, t]));
  const best = new Map<string, Best>();
  for (const c of allCatches) {
    if (c.deleted || c.lengthCm === null || c.count !== 1) continue;
    const t = tripById.get(c.tripId);
    if (!t) continue;
    const cur = best.get(c.species);
    if (!cur || c.lengthCm > cur.cm) {
      best.set(c.species, { species: c.species, cm: c.lengthCm, date: t.startedAt, water: tripWater(t), isNew: now - new Date(t.startedAt).getTime() < 30 * 86_400_000 });
    }
  }

  const months = new Map<number, { days: number; hours: number; fish: number }>();
  for (const t of trips) {
    const m = new Date(t.startedAt).getMonth();
    const x = months.get(m) ?? { days: 0, hours: 0, fish: 0 };
    x.days += 1;
    x.hours += hoursOf(t);
    x.fish += fishOf(t);
    months.set(m, x);
  }

  const waters = new Map<string, { days: number; hours: number; fish: number }>();
  for (const t of finished) {
    const w = tripWater(t);
    if (!w) continue;
    const x = waters.get(w) ?? { days: 0, hours: 0, fish: 0 };
    x.days += 1;
    x.hours += hoursOf(t);
    x.fish += fishOf(t);
    waters.set(w, x);
  }

  const slots = new Map<string, { days: number; hours: number; fish: number }>();
  for (const t of finished) {
    const s = slotOf(t.startedAt);
    const x = slots.get(s) ?? { days: 0, hours: 0, fish: 0 };
    x.days += 1;
    x.hours += hoursOf(t);
    x.fish += fishOf(t);
    slots.set(s, x);
  }

  return {
    days: trips.length,
    hours,
    fish,
    zeroDays: trips.filter((t) => fishOf(t) === 0).length,
    perHour: hours > 0 ? fishFinished / hours : null,
    releasedPct: fish ? Math.round(((fish - kept) / fish) * 100) : null,
    speciesCount: sp.size,
    bySpecies: [...sp.entries()].map(([species, x]) => ({ species, ...x })).sort((a, b) => b.n - a.n),
    bests: [...best.values()].sort((a, b) => b.cm - a.cm),
    byMonth: [...months.entries()].map(([month, x]) => ({ month, ...x })).sort((a, b) => a.month - b.month),
    byWater: [...waters.entries()]
      .map(([water, x]) => ({ water, ...x, perHour: x.hours > 0 ? x.fish / x.hours : 0 }))
      .sort((a, b) => b.days - a.days || b.perHour - a.perHour),
    byTimeOfDay: (['morning', 'day', 'evening', 'night'] as const)
      .map((slot) => {
        const x = slots.get(slot) ?? { days: 0, hours: 0, fish: 0 };
        return { slot, ...x, perHour: x.hours > 0 ? x.fish / x.hours : null };
      })
      .filter((x) => x.days > 0)
  };
}

/** Aggregated numbers for all participants, from the server. `enough` is false below the privacy threshold. */
export interface CommunityStats {
  enough: boolean;
  anglers: number;
  days?: number;
  hours?: number;
  fish?: number;
  zeroDays?: number;
  species?: Record<string, number>; // whole season
  recentSpecies?: Record<string, number>; // last 30 days
  fetchedAt?: number;
}

/** Species that count for the collection: every listed species except "other". */
export const collectableSpecies = (codes: string[]) => codes.filter((c) => c !== 'other');

/** The angler's species collection over all years: each species with the day it was first caught. */
export function speciesCollection(allTrips: Trip[], allCatches: Catch[], codes: string[]) {
  const valid = new Set(collectableSpecies(codes));
  const tripById = new Map(allTrips.filter((t) => !t.deleted).map((t) => [t.id, t]));
  const first = new Map<string, string>();
  for (const c of allCatches) {
    if (c.deleted || !valid.has(c.species)) continue;
    const t = tripById.get(c.tripId);
    if (!t) continue;
    const cur = first.get(c.species);
    if (!cur || t.startedAt < cur) first.set(c.species, t.startedAt);
  }
  const caught = [...first.entries()].map(([species, date]) => ({ species, date })).sort((a, b) => a.date.localeCompare(b.date));
  return { caught, total: valid.size, missing: collectableSpecies(codes).filter((c) => !first.has(c)) };
}

/**
 * What one saved fishing day added: its number in the season, species new to the collection and new
 * personal records (compared with all other days).
 */
export function dayHighlights(allTrips: Trip[], allCatches: Catch[], tripId: string, codes: string[]) {
  const trip = allTrips.find((t) => t.id === tripId && !t.deleted);
  if (!trip) return null;
  const others = allTrips.filter((t) => !t.deleted && t.id !== tripId);
  const otherIds = new Set(others.map((t) => t.id));
  const mine = allCatches.filter((c) => !c.deleted && c.tripId === tripId);
  const before = allCatches.filter((c) => !c.deleted && otherIds.has(c.tripId));
  const valid = new Set(collectableSpecies(codes));
  const seen = new Set(before.map((c) => c.species));
  const newSpecies = [...new Set(mine.map((c) => c.species))].filter((s) => valid.has(s) && !seen.has(s));
  const bestBefore = new Map<string, number>();
  for (const c of before) if (c.lengthCm !== null && c.count === 1) bestBefore.set(c.species, Math.max(bestBefore.get(c.species) ?? 0, c.lengthCm));
  const recs = new Map<string, number>();
  for (const c of mine) {
    if (c.lengthCm === null || c.count !== 1) continue;
    const prev = bestBefore.get(c.species);
    if (prev !== undefined && c.lengthCm > prev && c.lengthCm > (recs.get(c.species) ?? 0)) recs.set(c.species, c.lengthCm);
  }
  const year = yearOf(trip);
  const dayNo = allTrips.filter((t) => !t.deleted && yearOf(t) === year && t.startedAt <= trip.startedAt).length;
  const fish = mine.reduce((s, c) => s + c.count, 0);
  return {
    trip, year, dayNo, fish, hours: hoursOf(trip),
    newSpecies,
    records: [...recs.entries()].map(([species, cm]) => ({ species, cm, previous: bestBefore.get(species)! })),
    collectionSize: new Set([...seen, ...mine.map((c) => c.species)].filter((s) => valid.has(s))).size,
    collectionTotal: valid.size
  };
}
