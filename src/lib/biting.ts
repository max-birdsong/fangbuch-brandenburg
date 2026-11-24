// "What's biting": catch rates per water and month, pooled from all participants (water_stats in
// supabase/schema.sql; only water-months with at least 5 anglers). Demo mode shows made-up numbers.
import { useEffect, useState } from 'react';
import { getKV, setKV } from './db';
import { useOnline } from './hooks';
import { isDemo, supabase } from './supabase';

export interface WaterMonth {
  waterId: string; // a water id, or 'oder' for all Oder sections together
  water: string;
  month: number; // 1..12
  anglers: number;
  days: number;
  hours: number;
  fish: number;
  species: Record<string, number>; // top 5
}

export interface WaterStats {
  rows: WaterMonth[];
  example: boolean;
  fetchedAt: number;
}

export const perHour = (w: WaterMonth) => (w.hours > 0 ? w.fish / w.hours : 0);

/** Rows for the month to show: the current month if it has any, otherwise the latest month that does. */
export function monthToShow(stats: WaterStats | null, now = new Date()): { month: number; rows: WaterMonth[] } | null {
  if (!stats || stats.rows.length === 0) return null;
  const cur = now.getMonth() + 1;
  const months = [...new Set(stats.rows.map((r) => r.month))].filter((m) => m <= cur).sort((a, b) => b - a);
  if (!months.length) return null;
  const month = months[0];
  return { month, rows: stats.rows.filter((r) => r.month === month).sort((a, b) => (a.waterId === 'oder' ? -1 : b.waterId === 'oder' ? 1 : b.days - a.days)) };
}

/** The row to compare a fishing day with: its own water if shown, otherwise the pooled Oder row for Oder sections. */
export function rowFor(stats: WaterStats | null, waterId: string | null, month: number): WaterMonth | null {
  if (!stats || !waterId) return null;
  const rows = stats.rows.filter((r) => r.month === month);
  return rows.find((r) => r.waterId === waterId) ?? (waterId.startsWith('oder-bei-') ? rows.find((r) => r.waterId === 'oder') ?? null : null);
}

export function useWaterStats(year = new Date().getFullYear()): WaterStats | null | undefined {
  const online = useOnline();
  const [stats, setStats] = useState<WaterStats | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    if (isDemo) {
      setStats(exampleWaterStats());
      return;
    }
    const key = `waterStats:${year}`;
    void getKV<WaterStats | null>(key, null).then((s) => live && setStats((cur) => cur ?? s));
    if (supabase && online) {
      void supabase.rpc('water_stats', { season: year }).then(({ data, error }) => {
        if (!live || error || !Array.isArray(data)) return;
        const s: WaterStats = { rows: (data as WaterMonth[]).map((r) => ({ ...r, hours: Number(r.hours), fish: Number(r.fish) })), example: false, fetchedAt: Date.now() };
        setStats(s);
        void setKV(key, s);
      });
    }
    return () => { live = false; };
  }, [year, online]);
  return stats;
}

/** Made-up numbers for the demo: this month and the two before, a few Oder sections and lakes. */
export function exampleWaterStats(now = new Date()): WaterStats {
  let seed = 3;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const waters: [string, string, number, [string, number][]][] = [
    ['oder-bei-frankfurt-oder', 'Oder bei Frankfurt (Oder)', 0.75, [['zander', 5], ['perch', 9], ['asp', 3], ['bream', 4]]],
    ['oder-bei-schwedt', 'Oder bei Schwedt', 0.6, [['zander', 4], ['perch', 6], ['ide', 3], ['pike', 2]]],
    ['oder-bei-kienitz', 'Oder bei Kienitz', 0.55, [['zander', 3], ['wels', 1], ['perch', 5], ['bream', 3]]],
    ['parsteiner-see', 'Parsteiner See', 0.4, [['pike', 3], ['perch', 7], ['roach', 6]]],
    ['werbellinsee', 'Werbellinsee', 0.3, [['perch', 6], ['pike', 2], ['roach', 4]]],
    ['scharmuetzelsee', 'Scharmützelsee', 0.35, [['zander', 2], ['perch', 5], ['bream', 4]]]
  ];
  const rows: WaterMonth[] = [];
  const cur = now.getMonth() + 1;
  for (const m of [cur, cur - 1, cur - 2].filter((x) => x >= 1)) {
    const oder: WaterMonth = { waterId: 'oder', water: 'Oder', month: m, anglers: 0, days: 0, hours: 0, fish: 0, species: {} };
    for (const [waterId, water, rate, mix] of waters) {
      const anglers = 5 + Math.floor(rnd() * 14);
      const days = anglers + Math.floor(rnd() * anglers * 2);
      const hours = Math.round(days * (2.5 + rnd() * 2) * 10) / 10;
      const fish = Math.round(hours * rate * (0.7 + rnd() * 0.6));
      const total = mix.reduce((s, [, w]) => s + w, 0);
      const species: Record<string, number> = {};
      for (const [sp, w] of mix) species[sp] = Math.max(1, Math.round((fish * w) / total));
      rows.push({ waterId, water, month: m, anglers, days, hours, fish, species });
      if (waterId.startsWith('oder-bei-')) {
        oder.anglers += anglers; oder.days += days; oder.hours += hours; oder.fish += fish;
        for (const [sp, n] of Object.entries(species)) oder.species[sp] = (oder.species[sp] ?? 0) + n;
      }
    }
    oder.hours = Math.round(oder.hours * 10) / 10;
    oder.species = Object.fromEntries(Object.entries(oder.species).sort((a, b) => b[1] - a[1]).slice(0, 5));
    rows.push(oder);
  }
  return { rows, example: true, fetchedAt: Date.now() };
}
