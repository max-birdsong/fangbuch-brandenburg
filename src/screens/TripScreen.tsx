import { useEffect } from 'react';
import { go, useConfirm, useLang } from '../app';
import { CatchRow } from '../components/CatchRow';
import { TopBar } from '../components/ui';
import { Satisfaction } from '../components/Satisfaction';
import { METHODS, PLATFORMS, TARGETS, label } from '../data/catalog';
import { deleteTrip, updateTrip } from '../lib/db';
import { useCatches, useKV, useTrip } from '../lib/hooks';
import { scheduleSync } from '../lib/sync';
import { fmtDate, fmtTime } from '../lib/util';

export function TripScreen({ id }: { id: string }) {
  const { t, lang } = useLang();
  const confirm = useConfirm();
  const trip = useTrip(id);
  const catches = useCatches(id);
  const openBackfill = useKV<string | null>('openBackfill', null);
  const gone = trip === null || !!trip?.deleted;
  useEffect(() => {
    if (gone) go('', true);
  }, [gone]);
  if (trip === undefined || catches === undefined || !trip || gone) return <main className="screen" />;

  const running = trip.loggedLive && !trip.endedAt;
  const fresh = openBackfill === id; // a backfilled day that is still being entered
  const total = catches.reduce((s, c) => s + c.count, 0);
  const targets = trip.targets.map((c) => label(TARGETS, c, lang)).join(', ');
  const meta = [label(METHODS, trip.method, lang), label(PLATFORMS, trip.platform, lang)].filter(Boolean).join(' · ');

  const end = async () => {
    if (running) await updateTrip(id, { endedAt: new Date().toISOString() });
    scheduleSync();
    go(`trip/${id}/summary`, true);
  };

  const remove = async () => {
    if (!(await confirm(t('deleteTripQ'), t('delete'), true))) return;
    await deleteTrip(id);
    scheduleSync();
    go('', true);
  };

  return (
    <main className="screen">
      <header className="trip-head">
        <TopBar title={running ? t('tripRunning', { time: fmtTime(trip.startedAt, lang) }) : fmtDate(trip.startedAt, lang)} backTo="" dark />
        <div className="trip-head-body">
          <h2>{trip.waterOther || trip.waterName}</h2>
          <p>
            {!running && `${fmtTime(trip.startedAt, lang)}${trip.endedAt ? `–${fmtTime(trip.endedAt, lang)}` : ''} · `}
            {meta}
            {targets && ` · ${t('targetPrefix')} ${targets}`}
          </p>
        </div>
      </header>

      <div className="content stack">
        <div className="row between baseline">
          <h3 className="section-title">{t('todaysCatches')}</h3>
          <span className="strong muted">{total}</span>
        </div>
        {catches.length === 0 && (
          <div className="empty">
            <p>{t('emptyTrip1')}</p>
            <p>{t('emptyTrip2')}</p>
          </div>
        )}
        {catches.map((c) => (
          <CatchRow key={c.id} c={c} href={`#/trip/${id}/catch/${c.id}`} showTime={trip.loggedLive} />
        ))}

        {!running && !fresh && (
          <>
            <h3 className="section-title">{t('satisfaction')}</h3>
            <Satisfaction value={trip.satisfaction} onChange={(v) => { void updateTrip(id, { satisfaction: v }); scheduleSync(); }} />
            <button className="btn danger-outline" onClick={() => void remove()}>{t('delete')}</button>
          </>
        )}
      </div>

      <footer className="actionbar stack-sm">
        <a className="btn accent big" href={`#/trip/${id}/catch`}>{running || fresh ? t('addCatch') : t('addCatchLater')}</a>
        {(running || fresh) && (
          <button className="btn secondary" onClick={() => void end()}>{running ? t('endTrip') : t('finishBackfill')}</button>
        )}
      </footer>
    </main>
  );
}
