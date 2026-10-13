import { useEffect, useMemo, useState } from 'react';
import { go, useConfirm, useLang } from '../app';
import { Chips, Field, TopBar } from '../components/ui';
import { Satisfaction } from '../components/Satisfaction';
import { FishRow, type FishDraft } from '../components/FishRow';
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
  const [showMissing, setShowMissing] = useState(false);
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
      // One row per fish (older entries may hold several fish in one record).
      const rows: FishDraft[] = [];
      for (const c of cs.sort((a, b) => a.updatedAt - b.updatedAt)) {
        for (let i = 0; i < c.count; i++) rows.push({ key: uuid(), species: c.species, cm: c.lengthCm === null ? '' : String(c.lengthCm), kept: c.kept });
      }
      setFish(rows);
      setLoaded(true);
    })();
  }, [id]);

  const suggestions = useMemo(() => {
    const tg = targets.filter((c) => SPECIES.some((s) => s.code === c));
    return [...new Set([...tg, ...QUICK_SPECIES])].slice(0, 9);
  }, [targets]);
  const others = useMemo(() => SPECIES.filter((s) => !suggestions.includes(s.code)), [suggestions]);

  if (!loaded) return <main className="screen" />;

  // Catch list: one row per fish.
  const addFish = (species: string) => setFish((fs) => [...fs, { key: uuid(), species, cm: '', kept: null }]);
  const setOne = (key: string, f: FishDraft) => setFish((fs) => fs.map((x) => (x.key === key ? f : x)));
  const copyFish = (key: string) =>
    setFish((fs) => {
      const i = fs.findIndex((x) => x.key === key);
      return [...fs.slice(0, i + 1), { ...fs[i], key: uuid(), cm: '' }, ...fs.slice(i + 1)];
    });
  const parseCm = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
  const total = fish.length;
  const toggleTarget = (c: string) => setTargets((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]));

  const save = async () => {
    if (!water) return setErr(t('pickWater'));
    const startedAt = fromInputs(date, from);
    let endedAt = fromInputs(date, to);
    if (endedAt <= startedAt) endedAt = new Date(new Date(endedAt).getTime() + 86_400_000).toISOString(); // past midnight
    if (new Date(startedAt).getTime() > Date.now() + 60_000) return setErr(t('futureTime'));
    if (fish.some((f) => f.kept === null)) {
      setShowMissing(true);
      return setErr(t('fateMissing'));
    }
    if (fish.some((f) => { const n = parseCm(f.cm); return n !== null && !(n > 0 && n < 400); })) return setErr(t('lengthInvalid'));
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
    await replaceCatches(tripId, fish.map((f) => ({ species: f.species, kept: f.kept === true, lengthCm: parseCm(f.cm) })));
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
          {fish.map((f, i) => (
            <FishRow
              key={f.key}
              fish={f}
              index={i + 1}
              name={label(SPECIES, f.species, lang)}
              showMissing={showMissing}
              onChange={(nf) => setOne(f.key, nf)}
              onCopy={() => copyFish(f.key)}
              onRemove={() => setFish((fs) => fs.filter((x) => x.key !== f.key))}
            />
          ))}
          <div className="chips">
            {suggestions.map((c) => (
              <button key={c} type="button" className="chip" onClick={() => addFish(c)}>+ {label(SPECIES, c, lang)}</button>
            ))}
          </div>
          {others.length > 0 && (
            <select aria-label={t('chooseSpecies')} value="" onChange={(e) => e.target.value && addFish(e.target.value)}>
              <option value="">{t('chooseSpecies')}</option>
              {others.map((s) => (
                <option key={s.code} value={s.code}>{s[lang]}</option>
              ))}
            </select>
          )}
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
    </main>
  );
}
