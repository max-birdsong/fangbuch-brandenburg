import { useLang } from '../app';
import { BottomNav } from '../components/ui';
import { TripCard } from '../components/TripCard';
import { useCatches, useKV, usePending, useSurvey, useSyncState, useTrips, summarize } from '../lib/hooks';
import { SURVEY } from '../data/survey';
import { StaleTripPrompt, useIsStale } from '../components/StaleTripPrompt';
import { setKV } from '../lib/db';
import { isDemo } from '../lib/supabase';
import { fmtTime } from '../lib/util';

export function Home() {
  const { t, lang } = useLang();
  const trips = useTrips();
  const catches = useCatches();
  const pending = usePending();
  const sync = useSyncState();
  const survey = useSurvey();
  const snoozedUntil = useKV<number>('surveySnoozedUntil', 0);
  const staleActive = useIsStale(trips?.find((tr) => !tr.endedAt && tr.loggedLive));
  if (!trips || !catches || survey === undefined) return <main className="screen" />;

  const year = new Date().getFullYear();
  const seasonTrips = trips.filter((tr) => new Date(tr.startedAt).getFullYear() === year && tr.endedAt);
  const s = summarize(seasonTrips, catches);
  const active = trips.find((tr) => !tr.endedAt && tr.loggedLive);
  const stale = staleActive;
  const recent = trips.filter((tr) => tr.endedAt).slice(0, 8);
  const byTrip = (id: string) => catches.filter((c) => c.tripId === id);
  // Offer the optional survey after the first finished fishing day; "Later" hides it for 3 days.
  const showSurvey = !survey?.completedAt && trips.some((tr) => tr.endedAt) && Date.now() > snoozedUntil;

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
        {active && stale ? (
          <StaleTripPrompt trip={active} />
        ) : active ? (
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

        {showSurvey && (
          <section className="card survey-card stack-sm" aria-labelledby="survey-card-title">
            <h2 id="survey-card-title" className="card-title">{t('surveyCardTitle')}</h2>
            <p className="small">{survey ? t('surveyCardContinue') : t('surveyCardText', { min: SURVEY.minutes })}</p>
            <div className="row gap">
              <a className="btn primary small grow" href="#/survey">{survey ? t('surveyResume') : t('surveyStart')}</a>
              <button className="btn secondary small" onClick={() => void setKV('surveySnoozedUntil', Date.now() + 3 * 86400_000)}>{t('surveyLater')}</button>
            </div>
          </section>
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
