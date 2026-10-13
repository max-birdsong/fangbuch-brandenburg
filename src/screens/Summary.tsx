import { go, useLang } from '../app';
import { Satisfaction } from '../components/Satisfaction';
import { setKV, updateTrip } from '../lib/db';
import { useCatches, useTrip } from '../lib/hooks';
import { scheduleSync } from '../lib/sync';
import { fmtTime } from '../lib/util';

export function Summary({ id }: { id: string }) {
  const { t, lang } = useLang();
  const trip = useTrip(id);
  const catches = useCatches(id);
  if (!trip || !catches) return <main className="screen" />;

  const total = catches.reduce((s, c) => s + c.count, 0);
  const released = catches.filter((c) => !c.kept).reduce((s, c) => s + c.count, 0);

  const done = async () => {
    await setKV('openBackfill', null);
    scheduleSync(300);
    go('', true);
  };

  return (
    <main className="screen">
      <div className="content stack-lg pad-top">
        <div className="stack-xs">
          <p className="small strong green">{t('savedTrip')}</p>
          <h1 className="h1">{t('petri')}</h1>
          <p className="muted">
            {trip.waterOther || trip.waterName} · {fmtTime(trip.startedAt, lang)}
            {trip.endedAt && `–${fmtTime(trip.endedAt, lang)}`}
          </p>
        </div>
        <div className="grid-2">
          <div className="card stat-card"><span className="big-num">{total}</span><span className="muted small">{t('caught')}</span></div>
          <div className="card stat-card"><span className="big-num">{released}</span><span className="muted small">{t('statReleased')}</span></div>
        </div>
        {total === 0 && <p className="note-green">{t('skunk')}</p>}
        <section className="field">
          <h2 className="field-label">{t('satQ')}</h2>
          <Satisfaction value={trip.satisfaction} onChange={(v) => void updateTrip(id, { satisfaction: v })} />
        </section>
      </div>
      <footer className="actionbar">
        <button className="btn primary big" onClick={() => void done()}>{t('done')}</button>
      </footer>
    </main>
  );
}
