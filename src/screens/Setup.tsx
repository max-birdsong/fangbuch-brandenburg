import { useEffect, useState } from 'react';
import { go, useLang } from '../app';
import { Chips, Field, TopBar } from '../components/ui';
import { WaterPicker, type WaterValue } from '../components/WaterPicker';
import { METHODS, PLATFORMS, TARGETS } from '../data/catalog';
import { getKV, rememberWater, saveTrip, setKV } from '../lib/db';
import { fromInputs, toDateInput, toTimeInput, uuid } from '../lib/util';
import { scheduleSync } from '../lib/sync';

type LastSetup = { method: string | null; platform: string | null; targets: string[] };

export function Setup() {
  const { t, lang } = useLang();
  const [mode, setMode] = useState<'now' | 'past'>('now');
  const [water, setWater] = useState<WaterValue | null>(null);
  const [method, setMethod] = useState<string | null>('spin');
  const [platform, setPlatform] = useState<string | null>('shore');
  const [targets, setTargets] = useState<string[]>([]);
  const now = new Date();
  const [date, setDate] = useState(toDateInput(now));
  const [from, setFrom] = useState(toTimeInput(new Date(now.getTime() - 3 * 3600_000)).slice(0, 3) + '00');
  const [to, setTo] = useState(toTimeInput(now).slice(0, 3) + '00');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void getKV<LastSetup | null>('lastSetup', null).then((l) => {
      if (!l) return;
      setMethod(l.method);
      setPlatform(l.platform);
      setTargets(l.targets);
    });
  }, []);

  const toggleTarget = (c: string) => setTargets((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]));

  const start = async () => {
    if (!water) return setErr(t('pickWater'));
    const id = uuid();
    const past = mode === 'past';
    let startedAt = new Date().toISOString();
    let endedAt: string | null = null;
    if (past) {
      startedAt = fromInputs(date, from);
      endedAt = fromInputs(date, to);
      if (endedAt <= startedAt) endedAt = new Date(new Date(startedAt).getTime() + 3600_000).toISOString();
    }
    await saveTrip({
      id,
      waterId: water.waterId,
      waterName: water.waterName,
      waterOther: water.waterOther,
      waterChoice: water.choice,
      waterGpsDistanceM: water.gpsDistanceM,
      loggedLive: !past,
      startedAt,
      endedAt,
      method,
      platform,
      targets,
      satisfaction: null,
      deleted: false
    });
    if (water.waterId) await rememberWater(water.waterId);
    await setKV('lastSetup', { method, platform, targets } satisfies LastSetup);
    await setKV('openBackfill', past ? id : null);
    scheduleSync();
    go(`trip/${id}`, true);
  };

  return (
    <main className="screen">
      <TopBar title={mode === 'now' ? t('setupTitle') : t('setupBackfill')} />
      <div className="content stack-lg">
        <Chips
          label={t('setupTitle')}
          options={[{ code: 'now', label: t('whenNow') }, { code: 'past', label: t('whenPast') }]}
          value={mode}
          onChange={(v) => {
            setMode(v as 'now' | 'past');
            // A GPS suggestion only makes sense when fishing right now.
            if (v === 'past' && water?.choice === 'gps') setWater(null);
          }}
        />
        {mode === 'past' && (
          <div className="grid-3">
            <label className="input-label">
              {t('date')}
              <input type="date" value={date} max={toDateInput(now)} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="input-label">
              {t('from')}
              <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="input-label">
              {t('to')}
              <input type="time" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
        )}

        <Field label={t('water')}>
          <WaterPicker key={mode} value={water} autoLocate={mode === 'now'} onChange={(v) => { setWater(v); setErr(null); }} />
        </Field>

        <Field label={t('method')}>
          <Chips label={t('method')} options={METHODS.map((m) => ({ code: m.code, label: m[lang] }))} value={method} onChange={setMethod} />
        </Field>
        <Field label={t('platform')}>
          <Chips label={t('platform')} options={PLATFORMS.map((m) => ({ code: m.code, label: m[lang] }))} value={platform} onChange={setPlatform} />
        </Field>
        <Field label={<>{t('target')} <span className="muted">({t('multiple')})</span></>}>
          <Chips multi label={t('target')} options={TARGETS.map((m) => ({ code: m.code, label: m[lang] }))} value={targets} onChange={toggleTarget} />
        </Field>
        {err && <p className="error" role="alert">{err}</p>}
      </div>
      <footer className="actionbar">
        <button className="btn primary big" onClick={() => void start()}>
          {mode === 'now' ? t('startNow') : t('continueBackfill')}
        </button>
      </footer>
    </main>
  );
}
