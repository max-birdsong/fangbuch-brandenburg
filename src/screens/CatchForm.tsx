import { useEffect, useMemo, useState } from 'react';
import { back, useConfirm, useLang } from '../app';
import { Chips, Field, Stepper, TopBar } from '../components/ui';
import { QUICK_SPECIES, SPECIES } from '../data/catalog';
import { db, deleteCatch, saveCatch } from '../lib/db';
import { useTrip } from '../lib/hooks';
import { scheduleSync } from '../lib/sync';
import { uuid } from '../lib/util';

export function CatchForm({ tripId, catchId }: { tripId: string; catchId?: string }) {
  const { t, lang } = useLang();
  const confirm = useConfirm();
  const trip = useTrip(tripId);
  const [species, setSpecies] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [q, setQ] = useState('');
  const [count, setCount] = useState(1);
  const [length, setLength] = useState(40);
  const [measured, setMeasured] = useState(true);
  const [kept, setKept] = useState(false);
  const [caughtAt, setCaughtAt] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!catchId) return;
    void db.catches.get(catchId).then((c) => {
      if (!c) return;
      setSpecies(c.species);
      setCount(c.count);
      setLength(c.lengthCm ?? 40);
      setMeasured(c.lengthCm !== null);
      setKept(c.kept);
      setCaughtAt(c.caughtAt);
      if (!QUICK_SPECIES.includes(c.species)) setShowAll(true);
    });
  }, [catchId]);

  const quick = useMemo(() => SPECIES.filter((s) => QUICK_SPECIES.includes(s.code)), []);
  const rest = useMemo(() => {
    const n = q.trim().toLowerCase();
    return SPECIES.filter((s) => !QUICK_SPECIES.includes(s.code) && (!n || s[lang].toLowerCase().includes(n) || s.de.toLowerCase().includes(n)));
  }, [q, lang]);

  const save = async () => {
    if (!species) return setErr(t('pickSpecies'));
    await saveCatch({
      id: catchId ?? uuid(),
      tripId,
      species,
      count,
      lengthCm: measured ? length : null,
      kept,
      // Live trips get the real time; backfilled trips don't pretend to know it.
      caughtAt: catchId ? caughtAt : trip?.loggedLive ? new Date().toISOString() : null,
      deleted: false
    });
    scheduleSync();
    back(`trip/${tripId}`);
  };

  const remove = async () => {
    if (!catchId || !(await confirm(t('deleteCatchQ'), t('delete'), true))) return;
    await deleteCatch(catchId);
    scheduleSync();
    back(`trip/${tripId}`);
  };

  const SpeciesBtn = ({ code, name }: { code: string; name: string }) => (
    <button type="button" role="radio" aria-checked={species === code} className={`tile ${species === code ? 'on' : ''}`} onClick={() => { setSpecies(code); setErr(null); }}>
      {name}
    </button>
  );

  return (
    <main className="screen">
      <TopBar title={catchId ? t('catchEdit') : t('catchTitle')} close backTo={`trip/${tripId}`} />
      <div className="content stack-lg">
        <Field label={t('species')}>
          <div className="tiles" role="radiogroup" aria-label={t('species')}>
            {quick.map((s) => <SpeciesBtn key={s.code} code={s.code} name={s[lang]} />)}
            {!showAll && (
              <button type="button" className="tile more" onClick={() => setShowAll(true)}>{t('moreSpecies')}</button>
            )}
          </div>
          {showAll && (
            <div className="stack-sm">
              <input type="search" placeholder={t('searchSpecies')} aria-label={t('searchSpecies')} value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="tiles" role="radiogroup" aria-label={t('moreSpecies')}>
                {rest.map((s) => <SpeciesBtn key={s.code} code={s.code} name={s[lang]} />)}
              </div>
            </div>
          )}
        </Field>

        <Field label={t('count')}>
          <Stepper label={t('count')} value={count} min={1} max={999} onChange={setCount} />
        </Field>

        <Field label={count > 1 ? t('avgLength') : t('length')}>
          {measured && <Stepper label={t('length')} value={length} min={1} max={300} steps={[1, 5]} unit="cm" onChange={setLength} />}
          <label className="check">
            <input type="checkbox" checked={!measured} onChange={(e) => setMeasured(!e.target.checked)} />
            {t('notMeasured')}
          </label>
        </Field>

        <Field label={count > 1 ? t('fateMany') : t('fate')}>
          <Chips
            label={t('fate')}
            options={[{ code: 'released', label: t('released') }, { code: 'kept', label: t('kept') }]}
            value={kept ? 'kept' : 'released'}
            onChange={(v) => setKept(v === 'kept')}
          />
        </Field>
        {err && <p className="error" role="alert">{err}</p>}
        {catchId && <button className="btn danger-outline" onClick={() => void remove()}>{t('delete')}</button>}
      </div>
      <footer className="actionbar">
        <button className="btn primary big" onClick={() => void save()}>{t('save')}</button>
      </footer>
    </main>
  );
}
