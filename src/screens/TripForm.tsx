import { useEffect, useMemo, useState } from 'react';
import { go, useConfirm, useLang } from '../app';
import { Chips, Field, TopBar } from '../components/ui';
import { Satisfaction } from '../components/Satisfaction';
import { SpeciesCard, type CatchRowState } from '../components/SpeciesCard';
import { WaterPicker, type WaterValue } from '../components/WaterPicker';
import { METHODS, PLATFORMS, QUICK_SPECIES, SPECIES, TARGETS, label } from '../data/catalog';
import { applyReport, db, deleteTrip, getKV, rememberWater, saveTrip, setKV, type Trip } from '../lib/db';
import { scheduleSync } from '../lib/sync';
import { fromInputs, toDateInput, toTimeInput, uuid } from '../lib/util';

type LastSetup = { method: string | null; platform: string | null; targets: string[] };

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
  const [method, setMethod] = useState<string | null>('spin');
  const [platform, setPlatform] = useState<string | null>('shore');
  const [targets, setTargets] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [rows, setRows] = useState<CatchRowState[]>([]);
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // New day: method / platform / targets from last time, collapsed to one line.
  useEffect(() => {
    if (id) return;
    void getKV<LastSetup | null>('lastSetup', null).then((l) => {
      if (!l) return;
      setMethod(l.method);
      setPlatform(l.platform);
      setTargets(l.targets);
      setCollapsed(true);
    });
  }, [id]);

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
      setCollapsed(true);
      setSatisfaction(tr.satisfaction);
      const cs = (await db.catches.where('tripId').equals(id).toArray()).filter((c) => !c.deleted);
      const m = new Map<string, CatchRowState>();
      for (const c of cs) {
        const r = m.get(c.species) ?? { species: c.species, released: 0, kept: 0, lengths: [] };
        if (c.kept) r.kept += c.count; else r.released += c.count;
        if (c.lengthCm !== null) for (let i = 0; i < c.count; i++) r.lengths.push({ cm: c.lengthCm, kept: c.kept });
        m.set(c.species, r);
      }
      setRows([...m.values()]);
      setLoaded(true);
    })();
  }, [id]);

  const suggestions = useMemo(() => {
    const tg = targets.filter((c) => SPECIES.some((s) => s.code === c));
    return [...new Set([...tg, ...QUICK_SPECIES])].filter((c) => !rows.some((r) => r.species === c)).slice(0, 9);
  }, [targets, rows]);
  const others = useMemo(() => SPECIES.filter((s) => !rows.some((r) => r.species === s.code) && !suggestions.includes(s.code)), [rows, suggestions]);

  if (!loaded) return <main className="screen" />;

  // Catch list editing. Counts never drop below the number of measured fish with that fate.
  const update = (species: string, fn: (r: CatchRowState) => CatchRowState) => setRows((rs) => rs.map((r) => (r.species === species ? fn(r) : r)));
  const addSpecies = (species: string) => setRows((rs) => [...rs, { species, released: 0, kept: 0, lengths: [] }]);
  const change = (species: string, field: 'released' | 'kept', delta: number) =>
    update(species, (r) => {
      const measured = r.lengths.filter((l) => l.kept === (field === 'kept')).length;
      return { ...r, [field]: Math.max(measured, Math.min(999, r[field] + delta)) };
    });
  const addLength = (species: string, cm: number, kept: boolean) =>
    update(species, (r) => {
      const lengths = [...r.lengths, { cm, kept }];
      const field = kept ? 'kept' : 'released';
      return { ...r, lengths, [field]: Math.max(r[field], lengths.filter((l) => l.kept === kept).length) };
    });
  const total = rows.reduce((s, r) => s + r.released + r.kept, 0);
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
    const target = rows
      .flatMap((r) => [
        { species: r.species, kept: false, count: r.released },
        { species: r.species, kept: true, count: r.kept }
      ])
      .filter((x) => x.count > 0);
    const lengths = rows.flatMap((r) => r.lengths.map((l) => ({ species: r.species, kept: l.kept, lengthCm: l.cm })));
    await applyReport(tripId, target, null, lengths);
    if (water.waterId) await rememberWater(water.waterId);
    if (!id) await setKV('lastSetup', { method, platform, targets } satisfies LastSetup);
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
          {collapsed ? (
            <div className="card selected-water">
              <div className="stack-xs">
                <span className="card-title">
                  {[label(METHODS, method, lang), label(PLATFORMS, platform, lang)].filter(Boolean).join(' · ')}
                  {targets.length > 0 && ` · ${t('targetPrefix')} ${targets.map((c) => label(TARGETS, c, lang)).join(', ')}`}
                </span>
                {!id && <span className="small muted">{t('sameAsLast')}</span>}
              </div>
              <button type="button" className="btn small secondary" onClick={() => setCollapsed(false)}>{t('change')}</button>
            </div>
          ) : (
            <div className="stack">
              <Chips label={t('method')} options={METHODS.map((m) => ({ code: m.code, label: m[lang] }))} value={method} onChange={setMethod} />
              <Chips label={t('platform')} options={PLATFORMS.map((m) => ({ code: m.code, label: m[lang] }))} value={platform} onChange={setPlatform} />
              <p className="sub-label">{t('target')} ({t('multiple')})</p>
              <Chips multi label={t('target')} options={TARGETS.map((m) => ({ code: m.code, label: m[lang] }))} value={targets} onChange={toggleTarget} />
            </div>
          )}
        </Field>

        <Field label={t('catchesQ')} hint={t('catchesHint')}>
          {rows.map((r) => (
            <SpeciesCard
              key={r.species}
              row={r}
              name={label(SPECIES, r.species, lang)}
              onChange={(field, d) => change(r.species, field, d)}
              onRemove={() => setRows((rs) => rs.filter((x) => x.species !== r.species))}
              onAddLength={(cm, kept) => addLength(r.species, cm, kept)}
              onRemoveLength={(i) => update(r.species, (x) => ({ ...x, lengths: x.lengths.filter((_, j) => j !== i) }))}
            />
          ))}
          <div className="chips">
            {suggestions.map((c) => (
              <button key={c} type="button" className="chip" onClick={() => addSpecies(c)}>+ {label(SPECIES, c, lang)}</button>
            ))}
          </div>
          {others.length > 0 && (
            <select aria-label={t('chooseSpecies')} value="" onChange={(e) => e.target.value && addSpecies(e.target.value)}>
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
