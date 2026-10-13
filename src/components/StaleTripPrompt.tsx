import { useEffect, useState } from 'react';
import { go, useLang } from '../app';
import { db, setKV, updateTrip, type Trip } from '../lib/db';
import { useKV } from '../lib/hooks';
import { scheduleSync } from '../lib/sync';
import { fmtDate, fmtTime, fromInputs, toDateInput, toTimeInput } from '../lib/util';

/** A live trip running longer than this is probably one the angler forgot to end. */
export const STALE_HOURS = 10;

export function useIsStale(trip: Trip | null | undefined) {
  const snooze = useKV<{ id: string; until: number } | null>('staleSnooze', null);
  if (!trip || trip.endedAt || !trip.loggedLive) return false;
  if (Date.now() - new Date(trip.startedAt).getTime() < STALE_HOURS * 3_600_000) return false;
  return !(snooze && snooze.id === trip.id && Date.now() < snooze.until);
}

/** Asks when fishing actually stopped, so a forgotten trip doesn't become a 20-hour fishing day. */
export function StaleTripPrompt({ trip }: { trip: Trip }) {
  const { t, lang } = useLang();
  const [def] = useState(() => {
    // Default end: 3 h after the start (refined below from the last logged fish); never in the future.
    const start = new Date(trip.startedAt).getTime();
    return new Date(Math.min(Date.now(), start + 3 * 3_600_000));
  });
  const [date, setDate] = useState(toDateInput(def));
  const [time, setTime] = useState(toTimeInput(def).slice(0, 3) + '00');
  const [err, setErr] = useState<string | null>(null);

  // Refine the default from the last live catch, once.
  useEffect(() => {
    void db.catches.where('tripId').equals(trip.id).toArray().then((cs) => {
      const last = cs.filter((c) => !c.deleted && c.caughtAt).map((c) => c.caughtAt!).sort().pop();
      if (!last) return;
      const d = new Date(Math.min(Date.now(), new Date(last).getTime() + 30 * 60_000));
      setDate(toDateInput(d));
      setTime(toTimeInput(d));
    });
  }, [trip.id]);

  const end = async () => {
    const endIso = fromInputs(date, time);
    if (endIso <= trip.startedAt || new Date(endIso).getTime() > Date.now() + 60_000) return setErr(t('staleInvalid'));
    await updateTrip(trip.id, { endedAt: endIso });
    scheduleSync();
    go(`trip/${trip.id}/report`, true);
  };

  return (
    <section className="card stale-card stack-sm" role="alert" aria-labelledby="stale-title">
      <h2 id="stale-title" className="card-title">{t('staleTitle')}</h2>
      <p className="small">
        {t('staleText', { date: fmtDate(trip.startedAt, lang), time: fmtTime(trip.startedAt, lang), water: trip.waterOther || trip.waterName })}
      </p>
      <div className="grid-2">
        <label className="input-label">
          {t('date')}
          <input type="date" value={date} min={trip.startedAt.slice(0, 10)} max={toDateInput(new Date())} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="input-label">
          {t('to')}
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
      </div>
      {err && <p className="error small">{err}</p>}
      <button className="btn primary" onClick={() => void end()}>{t('staleEnd')}</button>
      <button className="btn secondary small" onClick={() => void setKV('staleSnooze', { id: trip.id, until: Date.now() + 6 * 3_600_000 })}>
        {t('staleStill')}
      </button>
    </section>
  );
}
