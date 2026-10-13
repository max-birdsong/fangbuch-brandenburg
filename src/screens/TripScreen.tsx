import { useEffect, useRef, useState } from 'react';
import { go, useConfirm, useLang } from '../app';
import { CatchRow } from '../components/CatchRow';
import { TopBar } from '../components/ui';
import { Satisfaction } from '../components/Satisfaction';
import { METHODS, PLATFORMS, QUICK_SPECIES, SPECIES, TARGETS, label } from '../data/catalog';
import { StaleTripPrompt, useIsStale } from '../components/StaleTripPrompt';
import { deleteCatch, deleteTrip, saveCatch, updateTrip } from '../lib/db';
import { useCatches, useKV, useTrip } from '../lib/hooks';
import { scheduleSync } from '../lib/sync';
import { fmtDate, fmtTime, uuid } from '../lib/util';

export function TripScreen({ id }: { id: string }) {
  const { t, lang } = useLang();
  const confirm = useConfirm();
  const trip = useTrip(id);
  const catches = useCatches(id);
  const openBackfill = useKV<string | null>('openBackfill', null);
  const gone = trip === null || !!trip?.deleted;
  const stale = useIsStale(trip);
  const [toast, setToast] = useState<{ id: string; text: string } | null>(null);
  const toastTimer = useRef<number>();
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
    go(`trip/${id}/report`, true);
  };

  // One tap = one released fish of that species, with an undo.
  const quickSpecies = [...new Set([...trip.targets.filter((c) => SPECIES.some((x) => x.code === c)), ...QUICK_SPECIES])].slice(0, 9);
  const quickLog = async (species: string) => {
    const cid = uuid();
    await saveCatch({ id: cid, tripId: id, species, count: 1, lengthCm: null, kept: false, caughtAt: new Date().toISOString(), deleted: false });
    scheduleSync(5000);
    window.clearTimeout(toastTimer.current);
    setToast({ id: cid, text: t('quickSaved', { species: label(SPECIES, species, lang) }) });
    toastTimer.current = window.setTimeout(() => setToast(null), 5000);
  };
  const undo = async () => {
    if (!toast) return;
    await deleteCatch(toast.id);
    setToast(null);
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
        {stale && <StaleTripPrompt trip={trip} />}
        {running && !stale && (
          <section className="field" aria-labelledby="quick-title">
            <h3 id="quick-title" className="section-title">{t('quickTitle')}</h3>
            <p className="hint">{t('quickHint')}</p>
            <div className="tiles">
              {quickSpecies.map((c) => (
                <button key={c} type="button" className="tile" onClick={() => void quickLog(c)}>{label(SPECIES, c, lang)}</button>
              ))}
            </div>
            <select
              aria-label={t('chooseSpecies')}
              value=""
              onChange={(e) => {
                if (e.target.value) void quickLog(e.target.value);
                e.target.value = '';
              }}
            >
              <option value="">{t('chooseSpecies')}</option>
              {SPECIES.filter((x) => !quickSpecies.includes(x.code)).map((x) => (
                <option key={x.code} value={x.code}>{x[lang]}</option>
              ))}
            </select>
          </section>
        )}
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

      {toast && (
        <div className="toast" role="status">
          <span>{toast.text}</span>
          <button className="toast-btn" onClick={() => void undo()}>{t('undo')}</button>
        </div>
      )}
      {!stale && (
        <footer className="actionbar stack-sm">
          {running ? (
            <button className="btn accent big" onClick={() => void end()}>{t('endTrip')}</button>
          ) : fresh ? (
            <button className="btn accent big" onClick={() => void end()}>{t('finishBackfill')}</button>
          ) : (
            <a className="btn secondary" href={`#/trip/${id}/catch`}>{t('addCatchLater')}</a>
          )}
        </footer>
      )}
    </main>
  );
}
