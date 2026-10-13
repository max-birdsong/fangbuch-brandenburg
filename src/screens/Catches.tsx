import { useLang } from '../app';
import { BottomNav } from '../components/ui';
import { TripCard } from '../components/TripCard';
import { SPECIES, label } from '../data/catalog';
import { useCatches, useTrips } from '../lib/hooks';

export function Catches() {
  const { t, lang } = useLang();
  const trips = useTrips();
  const catches = useCatches();
  if (!trips || !catches) return <main className="screen with-nav" />;

  const tripIds = new Set(trips.map((tr) => tr.id));
  const mine = catches.filter((c) => tripIds.has(c.tripId));
  const bySpecies = new Map<string, { n: number; best: number | null }>();
  for (const c of mine) {
    const s = bySpecies.get(c.species) ?? { n: 0, best: null };
    s.n += c.count;
    if (c.lengthCm !== null) s.best = Math.max(s.best ?? 0, c.lengthCm);
    bySpecies.set(c.species, s);
  }
  const rows = [...bySpecies.entries()].sort((a, b) => b[1].n - a[1].n);

  return (
    <main className="screen with-nav">
      <header className="plain-head"><h1>{t('catchesTitle')}</h1></header>
      <div className="content stack">
        <h2 className="section-title">{t('bySpecies')}</h2>
        {rows.length === 0 && <p className="muted">{t('noCatchesYet')}</p>}
        {rows.length > 0 && (
          <ul className="card species-list">
            {rows.map(([code, s]) => (
              <li key={code} className="row between">
                <span className="strong">{label(SPECIES, code, lang)}</span>
                <span className="muted">
                  {s.n}
                  {s.best !== null && ` · ${t('bestLength', { cm: s.best })}`}
                </span>
              </li>
            ))}
          </ul>
        )}
        <h2 className="section-title">{t('allTrips')}</h2>
        {trips.filter((tr) => tr.endedAt).map((tr) => (
          <TripCard key={tr.id} trip={tr} catches={catches.filter((c) => c.tripId === tr.id)} />
        ))}
      </div>
      <BottomNav active="catches" />
    </main>
  );
}
