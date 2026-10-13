// Aggregations for the research dashboard. Plain functions over the loaded rows.
import { SPECIES } from '../data/catalog';
import { SURVEY, allItems } from '../data/survey';
import type { AdminData, ATrip } from './admin';

export const hoursOf = (t: ATrip) =>
  t.endedAt ? Math.max(0, (new Date(t.endedAt).getTime() - new Date(t.startedAt).getTime()) / 3_600_000) : 0;

export function kpis(d: AdminData) {
  const days = d.trips.filter((t) => t.endedAt);
  const fishByTrip = new Map<string, number>();
  for (const c of d.catches) fishByTrip.set(c.tripId, (fishByTrip.get(c.tripId) ?? 0) + c.count);
  const fish = [...fishByTrip.values()].reduce((a, b) => a + b, 0);
  const zero = days.filter((t) => !fishByTrip.get(t.id)).length;
  const hours = days.reduce((s, t) => s + hoursOf(t), 0);
  const anglers = new Set([...d.profiles.map((p) => p.userId), ...d.trips.map((t) => t.userId)]).size;
  return {
    anglers,
    days: days.length,
    hours,
    fish,
    cpue: hours > 0 ? fish / hours : null,
    zeroPct: days.length ? Math.round((zero / days.length) * 100) : null,
    surveysDone: d.surveys.filter((s) => s.completedAt).length
  };
}

/** Monday of the week containing d, as YYYY-MM-DD (local time). */
function weekStart(iso: string) {
  const d = new Date(iso);
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Fishing days per week, gaps filled with 0, at most the last `maxWeeks` weeks. */
export function weekly(d: AdminData, maxWeeks = 26) {
  const days = d.trips.filter((t) => t.endedAt);
  if (!days.length) return [];
  const counts = new Map<string, number>();
  for (const t of days) {
    const k = ymd(weekStart(t.startedAt));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const first = weekStart(days.reduce((m, t) => (t.startedAt < m ? t.startedAt : m), days[0].startedAt));
  const last = weekStart(new Date().toISOString());
  const out: { week: string; n: number }[] = [];
  for (const w = new Date(first); w <= last; w.setDate(w.getDate() + 7)) out.push({ week: ymd(w), n: counts.get(ymd(w)) ?? 0 });
  return out.slice(-maxWeeks);
}

/** Catch per angler-hour by water, for waters with at least `minDays` fishing days. */
export function byWater(d: AdminData, minDays: number) {
  const fishByTrip = new Map<string, number>();
  for (const c of d.catches) fishByTrip.set(c.tripId, (fishByTrip.get(c.tripId) ?? 0) + c.count);
  const m = new Map<string, { water: string; days: number; hours: number; fish: number; zero: number }>();
  for (const t of d.trips) {
    const h = hoursOf(t);
    if (!t.endedAt || h <= 0) continue;
    const k = t.waterId ?? t.waterName;
    const r = m.get(k) ?? { water: t.waterName, days: 0, hours: 0, fish: 0, zero: 0 };
    const f = fishByTrip.get(t.id) ?? 0;
    r.days += 1;
    r.hours += h;
    r.fish += f;
    if (!f) r.zero += 1;
    m.set(k, r);
  }
  return [...m.values()]
    .filter((r) => r.days >= minDays)
    .map((r) => ({ ...r, rate: r.fish / r.hours }))
    .sort((a, b) => b.rate - a.rate || b.days - a.days);
}

/** Fish by species, split kept / released, biggest totals first. */
export function bySpecies(d: AdminData, lang: 'de' | 'en', limit = 10) {
  const m = new Map<string, { kept: number; released: number }>();
  for (const c of d.catches) {
    const r = m.get(c.species) ?? { kept: 0, released: 0 };
    if (c.kept) r.kept += c.count; else r.released += c.count;
    m.set(c.species, r);
  }
  const rows = [...m.entries()]
    .map(([code, r]) => ({ code, label: SPECIES.find((s) => s.code === code)?.[lang] ?? code, ...r, total: r.kept + r.released }))
    .sort((a, b) => b.total - a.total);
  if (rows.length <= limit) return rows;
  const rest = rows.slice(limit - 1);
  const other = rest.reduce((o, r) => ({ ...o, kept: o.kept + r.kept, released: o.released + r.released, total: o.total + r.total }),
    { code: 'other_grouped', label: lang === 'de' ? 'Weitere Arten' : 'Other species', kept: 0, released: 0, total: 0 });
  return [...rows.slice(0, limit - 1), other];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Per-respondent scale score = mean of answered items (reverse items flipped), then averaged over respondents. */
function scaleScores(d: AdminData, ids: string[]) {
  const items = allItems();
  const scores: number[] = [];
  for (const s of d.surveys) {
    const vals: number[] = [];
    for (const id of ids) {
      const v = s.answers[id];
      if (typeof v !== 'number') continue;
      const it = items.find((i) => i.id === id);
      vals.push(it && it.type === 'likert' && it.reverse ? 6 - v : v);
    }
    const m = mean(vals);
    if (m !== null) scores.push(m);
  }
  return { mean: mean(scores), n: scores.length };
}

export function surveyScales(d: AdminData, lang: 'de' | 'en') {
  const L = (de: string, en: string) => (lang === 'de' ? de : en);
  return [
    { key: 'centrality', label: L('Zentralität im Leben', 'Centrality to lifestyle'), ...scaleScores(d, ['cent_1', 'cent_2', 'cent_3']) },
    { key: 'attraction', label: L('Attraktion', 'Attraction'), ...scaleScores(d, ['attr_1', 'attr_2', 'attr_3']) },
    { key: 'co_some', label: L('Fangen: überhaupt etwas', 'Catch: catching something'), ...scaleScores(d, ['co_some_1', 'co_some_2', 'co_some_3']) },
    { key: 'co_num', label: L('Fangen: Anzahl', 'Catch: numbers'), ...scaleScores(d, ['co_num_1', 'co_num_2']) },
    { key: 'co_size', label: L('Fangen: Größe', 'Catch: size'), ...scaleScores(d, ['co_size_1', 'co_size_2', 'co_size_3']) },
    { key: 'co_keep', label: L('Fangen: Behalten', 'Catch: keeping'), ...scaleScores(d, ['co_keep_1', 'co_keep_2', 'co_keep_3']) }
  ];
}

export function surveyMotives(d: AdminData, lang: 'de' | 'en') {
  const section = SURVEY.sections.find((s) => s.id === 'motives');
  return (section?.items ?? [])
    .map((it) => ({ key: it.id, label: it.text[lang], ...scaleScores(d, [it.id]) }))
    .sort((a, b) => (b.mean ?? 0) - (a.mean ?? 0));
}

/** Survey answers in wide format (one row per respondent). */
export function surveyWide(d: AdminData) {
  const ids = allItems().map((i) => i.id);
  return d.surveys.map((s) => {
    const row: Record<string, unknown> = { user_id: s.userId, completed_at: s.completedAt };
    for (const id of ids) row[id] = s.answers[id] ?? '';
    return row;
  });
}
