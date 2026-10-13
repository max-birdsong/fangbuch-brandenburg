import { useLang } from '../app';
import { BottomNav } from '../components/ui';
import { TripCard } from '../components/TripCard';
import { useCatches, usePending, useSyncState, useTrips, summarize } from '../lib/hooks';
import { isDemo } from '../lib/supabase';
import { fmtTime } from '../lib/util';

export function Home() {
  const { t, lang } = useLang();
  const trips = useTrips();
  const catches = useCatches();
  const pending = usePending();
  const sync = useSyncState();
  if (!trips || !catches) return <main className="screen" />;

  const year = new Date().getFullYear();
  const seasonTrips = trips.filter((tr) => new Date(tr.startedAt).getFullYear() === year && tr.endedAt);
  const s = summarize(seasonTrips, catches);
  const active = trips.find((tr) => !tr.endedAt && tr.loggedLive);
  const recent = trips.filter((tr) => tr.endedAt).slice(0, 8);
  const byTrip = (id: string) => catches.filter((c) => c.tripId === id);

  return (
    <main className="screen with-nav">
      <header className="hero">
        <div className="row between baseline">
          <h1>{t('myLog')}</h1>
          <span className="hero-sub">{t('season', { year })}</span>
        </div>
        <dl className="stats">
          <div><dd>{s.days}</dd><dt>{t('statDays')}</dt></div>
          <div><dd>{s.fish}</dd><dt>{t('statFish')}</dt></div>
          <div><dd>{s.species}</dd><dt>{t('statSpecies')}</dt></div>
          <div><dd>{s.releasedPct === null ? '–' : `${s.releasedPct}%`}</dd><dt>{t('statReleased')}</dt></div>
        </dl>
      </header>

      <div className="content stack">
        {active ? (
          <a className="btn accent big banner" href={`#/trip/${active.id}`}>
            <span className="stack-xs left">
              <span className="small">{t('tripRunning', { time: fmtTime(active.startedAt, lang) })}</span>
              <span className="strong">{active.waterOther || active.waterName}</span>
            </span>
            <span>{t('resume')} →</span>
          </a>
        ) : (
          <a className="btn accent big" href="#/setup">{t('startTrip')}</a>
        )}

        <h2 className="section-title">{t('recentTrips')}</h2>
        {recent.length === 0 && <p className="muted">{t('noTripsYet')}</p>}
        {recent.map((tr) => (
          <TripCard key={tr.id} trip={tr} catches={byTrip(tr.id)} />
        ))}

        <p className="sync-line" aria-live="polite">
          {isDemo ? t('demoMode') : sync.running ? t('syncing') : pending > 0 ? t('syncPending', { n: pending }) : t('syncOk')}
        </p>
      </div>
      <BottomNav active="home" />
    </main>
  );
}
