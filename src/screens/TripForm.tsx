import { useEffect, useMemo, useState } from 'react';
import { go, useConfirm, useLang } from '../app';
import { Chips, Field, TopBar } from '../components/ui';
import { Satisfaction } from '../components/Satisfaction';
import { FishSheet, fishLine, parseCm, type FishDraft } from '../components/FishSheet';
import { WaterPicker, type WaterValue } from '../components/WaterPicker';
import { METHODS, PLATFORMS, QUICK_SPECIES, SPECIES, TARGETS, label } from '../data/catalog';
import { db, deleteTrip, rememberWater, replaceCatches, saveTrip, type Trip } from '../lib/db';
import { scheduleSync } from '../lib/sync';
import { fromInputs, toDateInput, toTimeInput, uuid } from '../lib/util';

const roundHour = (d: Date) => toTimeInput(d).slice(0, 3) + '00';

/**
 * The one form for a fishing day: where, when, how, what was caught, how it was.
 * Used for new days (#/new) and for editing a saved day (#/trip/<id>).
 */
export function TripForm({ id }: { id?: string }) {
  const { t, lang } = useLang();
  const confirm = useConfirm();
  const now = new Date();
  const [loaded, setLoaded] = useState(!id);
  const [existing, setExisting] = useState<Trip | null>(null);
  const [water, setWater] = useState<WaterValue | null>(null);
  const [date, setDate] = useState(toDateInput(now));
  const [from, setFrom] = useState(roundHour(new Date(now.getTime() - 3 * 3_600_000)));
  const [to, setTo] = useState(roundHour(now));
  const [method, setMethod] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string | null>(null);
  const [targets, setTargets] = useState<string[]>([]);
  const [fish, setFish] = useState<FishDraft[]>([]);
  const [sheet, setSheet] = useState<{ fish: FishDraft | null } | null>(null);
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Edit: load the day and its catches.
  useEffect(() => {
    if (!id) return;
    void (async () => {
      const tr = await db.trips.get(id);
      if (!tr || tr.deleted) return go('', true);
      setExisting(tr);
      setWater({ waterId: tr.waterId, waterName: tr.waterName, waterOther: tr.waterOther, choice: tr.waterChoice, gpsDistanceM: tr.waterGpsDistanceM });
      const start = new Date(tr.startedAt);
      setDate(toDateInput(start));
      setFrom(toTimeInput(start));
      setTo(tr.endedAt ? toTimeInput(new Date(tr.endedAt)) : roundHour(new Date()));
      setMethod(tr.method);
      setPlatform(tr.platform);
      setTargets(tr.targets);
      setSatisfaction(tr.satisfaction);
      const cs = (await db.catches.where('tripId').equals(id).toArray()).filter((c) => !c.deleted);
      setFish(cs.sort((a, b) => a.updatedAt - b.updatedAt).map((c) => ({
        key: uuid(), species: c.species, count: c.count, kept: c.kept,
        cm: c.lengthCm === null ? '' : String(c.lengthCm).replace('.', lang === 'de' ? ',' : '.')
      })));
      setLoaded(true);
    })();
  }, [id]);

  const suggestions = useMemo(() => {
    const tg = targets.filter((c) => SPECIES.some((s) => s.code === c));
    return [...new Set([...tg, ...QUICK_SPECIES])].slice(0, 9);
  }, [targets]);

  if (!loaded) return <main className="screen" />;

  // Catch list: one line per fish, added and edited in a small sheet.
  const saveFish = (f: Omit<FishDraft, 'key'>) => {
    const editing = sheet?.fish;
    setFish((fs) => (editing ? fs.map((x) => (x.key === editing.key ? { ...f, key: x.key } : x)) : [...fs, { ...f, key: uuid() }]));
    setSheet(null);
  };
  const removeFish = (key: string) => {
    setFish((fs) => fs.filter((x) => x.key !== key));
    setSheet(null);
  };
  const total = fish.reduce((n, f) => n + f.count, 0);
  const toggleTarget = (c: string) => setTargets((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]));

  const save = async () => {
    if (!water) return setErr(t('pickWater'));
    const startedAt = fromInputs(date, from);
    let endedAt = fromInputs(date, to);
    if (endedAt <= startedAt) endedAt = new Date(new Date(endedAt).getTime() + 86_400_000).toISOString(); // past midnight
    if (new Date(startedAt).getTime() > Date.now() + 60_000) return setErr(t('futureTime'));
    setErr(null);
    setBusy(true);
    const tripId = id ?? uuid();
    await saveTrip({
      id: tripId,
      waterId: water.waterId,
      waterName: water.waterName,
      waterOther: water.waterOther,
      waterChoice: water.choice,
      waterGpsDistanceM: water.gpsDistanceM,
      loggedLive: existing?.loggedLive ?? false,
      startedAt,
      endedAt,
      method,
      platform,
      targets,
      satisfaction,
      deleted: false
    });
    await replaceCatches(tripId, fish.map((f) => ({ species: f.species, count: f.count, kept: f.kept, lengthCm: parseCm(f.cm) })));
    if (water.waterId) await rememberWater(water.waterId);
    scheduleSync();
    go('', true);
  };

  const remove = async () => {
    if (!id || !(await confirm(t('deleteTripQ'), t('delete'), true))) return;
    await deleteTrip(id);
    scheduleSync();
    go('', true);
  };

  return (
    <main className="screen">
      <TopBar title={id ? t('formTitleEdit') : t('formTitleNew')} backTo="" />
      <div className="content stack-lg">
        <Field label={t('water')}>
          <WaterPicker value={water} autoLocate={!id} onChange={(v) => { setWater(v); setErr(null); }} />
        </Field>

        <Field label={t('when')}>
          <div className="grid-3">
            <label className="input-label">
              {t('date')}
              <input type="date" value={date} max={toDateInput(new Date())} onChange={(e) => setDate(e.target.value)} />
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
        </Field>

        <Field label={t('how')}>
          <div className="stack">
            <p className="sub-label">{t('method')}</p>
            <Chips label={t('method')} options={METHODS.map((m) => ({ code: m.code, label: m[lang] }))} value={method} onChange={(v) => setMethod(method === v ? null : v)} />
            <p className="sub-label">{t('platform')}</p>
            <Chips label={t('platform')} options={PLATFORMS.map((m) => ({ code: m.code, label: m[lang] }))} value={platform} onChange={(v) => setPlatform(platform === v ? null : v)} />
            <p className="sub-label">{t('target')} ({t('multiple')})</p>
            <Chips multi label={t('target')} options={TARGETS.map((m) => ({ code: m.code, label: m[lang] }))} value={targets} onChange={toggleTarget} />
          </div>
        </Field>

        <Field label={t('catchesQ')} hint={t('catchesHint')}>
          {fish.length > 0 && (
            <ol className="fish-list">
              {fish.map((f) => (
                <li key={f.key}>
                  <button type="button" className="fish-line" onClick={() => setSheet({ fish: f })}>
                    {fishLine(f, label(SPECIES, f.species, lang), f.kept ? t('kept') : t('released'), t('pieces', { n: f.count }), lang)}
                  </button>
                </li>
              ))}
            </ol>
          )}
          <button type="button" className="btn secondary" onClick={() => setSheet({ fish: null })}>{t('addFish')}</button>
        </Field>

        <Field label={t('satQ')}>
          <Satisfaction value={satisfaction} onChange={(v) => setSatisfaction(satisfaction === v ? null : v)} />
        </Field>

        {err && <p className="error" role="alert">{err}</p>}
        {id && <button className="btn danger-outline" onClick={() => void remove()}>{t('delete')}</button>}
      </div>
      <footer className="actionbar">
        <button className="btn primary big" disabled={busy} onClick={() => void save()}>
          {total === 0 ? t('saveNoCatch') : t('saveWithFish', { n: total })}
        </button>
      </footer>
      {sheet && (
        <FishSheet
          fish={sheet.fish}
          suggestions={suggestions}
          onSave={saveFish}
          onDelete={sheet.fish ? () => removeFish(sheet.fish!.key) : undefined}
          onClose={() => setSheet(null)}
        />
      )}
    </main>
  );
}
