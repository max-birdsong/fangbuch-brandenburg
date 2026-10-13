import { useEffect, useMemo, useState } from 'react';
import { go, useLang } from '../app';
import { TopBar } from '../components/ui';
import { QUICK_SPECIES, SPECIES, label } from '../data/catalog';
import { applyReport, db } from '../lib/db';
import { useTrip } from '../lib/hooks';
import { scheduleSync } from '../lib/sync';
import { fmtDate, fmtTime } from '../lib/util';

type Measured = { cm: number; kept: boolean };
type Row = { species: string; released: number; kept: number; lengths: Measured[] };

/** End-of-trip catch report: counts per species (released / kept), lengths optional. */
export function Report({ tripId }: { tripId: string }) {
  const { t, lang } = useLang();
  const trip = useTrip(tripId);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);

  // Prefill from anything logged during the day.
  useEffect(() => {
    void db.catches.where('tripId').equals(tripId).toArray().then((cs) => {
      const m = new Map<string, Row>();
      for (const c of cs.filter((x) => !x.deleted)) {
        const r = m.get(c.species) ?? { species: c.species, released: 0, kept: 0, lengths: [] };
        if (c.kept) r.kept += c.count; else r.released += c.count;
        if (c.lengthCm !== null) for (let i = 0; i < c.count; i++) r.lengths.push({ cm: c.lengthCm, kept: c.kept });
        m.set(c.species, r);
      }
      setRows([...m.values()]);
    });
  }, [tripId]);

  const suggestions = useMemo(() => {
    const targets = (trip?.targets ?? []).filter((c) => SPECIES.some((s) => s.code === c));
    return [...new Set([...targets, ...QUICK_SPECIES])].filter((c) => !rows?.some((r) => r.species === c)).slice(0, 9);
  }, [trip, rows]);
  const others = useMemo(() => SPECIES.filter((s) => !rows?.some((r) => r.species === s.code) && !suggestions.includes(s.code)), [rows, suggestions]);

  if (!trip || !rows) return <main className="screen" />;

  const update = (species: string, fn: (r: Row) => Row) => setRows((rs) => (rs ?? []).map((r) => (r.species === species ? fn(r) : r)));
  const add = (species: string) => setRows((rs) => [...(rs ?? []), { species, released: 1, kept: 0, lengths: [] }]);
  const remove = (species: string) => setRows((rs) => (rs ?? []).filter((r) => r.species !== species));
  // A count can't drop below the number of measured fish with that fate.
  const change = (species: string, field: 'released' | 'kept', delta: number) =>
    update(species, (r) => {
      const measured = r.lengths.filter((l) => l.kept === (field === 'kept')).length;
      return { ...r, [field]: Math.max(measured, Math.min(999, r[field] + delta)) };
    });
  const addLength = (species: string, cm: number, kept: boolean) =>
    update(species, (r) => {
      const lengths = [...r.lengths, { cm, kept }];
      const field = kept ? 'kept' : 'released';
      const measured = lengths.filter((l) => l.kept === kept).length;
      return { ...r, lengths, [field]: Math.max(r[field], measured) };
    });
  const removeLength = (species: string, i: number) => update(species, (r) => ({ ...r, lengths: r.lengths.filter((_, j) => j !== i) }));
  const total = rows.reduce((s, r) => s + r.released + r.kept, 0);

  const save = async () => {
    setBusy(true);
    const target = rows
      .flatMap((r) => [
        { species: r.species, kept: false, count: r.released },
        { species: r.species, kept: true, count: r.kept }
      ])
      .filter((x) => x.count > 0);
    const lengths = rows.flatMap((r) => r.lengths.map((l) => ({ species: r.species, kept: l.kept, lengthCm: l.cm })));
    await applyReport(tripId, target, null, lengths);
    scheduleSync();
    go(`trip/${tripId}/summary`, true);
  };

  return (
    <main className="screen">
      <TopBar title={t('reportTitle')} backTo={`trip/${tripId}`} />
      <div className="content stack">
        <p className="muted small">
          {trip.waterOther || trip.waterName} · {fmtDate(trip.startedAt, lang)}, {fmtTime(trip.startedAt, lang)}
          {trip.endedAt && `–${fmtTime(trip.endedAt, lang)}`}
        </p>
        <p className="hint">{t('reportHint')}</p>

        {rows.map((r) => (
          <SpeciesCard
            key={r.species}
            row={r}
            name={label(SPECIES, r.species, lang)}
            onChange={(field, d) => change(r.species, field, d)}
            onRemove={() => remove(r.species)}
            onAddLength={(cm, kept) => addLength(r.species, cm, kept)}
            onRemoveLength={(i) => removeLength(r.species, i)}
          />
        ))}

        <section className="field">
          <h2 className="field-label">{rows.length ? t('addSpecies') : t('reportTitle')}</h2>
          <div className="chips">
            {suggestions.map((c) => (
              <button key={c} type="button" className="chip" onClick={() => add(c)}>+ {label(SPECIES, c, lang)}</button>
            ))}
          </div>
          {others.length > 0 && (
            <select aria-label={t('chooseSpecies')} value="" onChange={(e) => e.target.value && add(e.target.value)}>
              <option value="">{t('chooseSpecies')}</option>
              {others.map((s) => (
                <option key={s.code} value={s.code}>{s[lang]}</option>
              ))}
            </select>
          )}
        </section>
      </div>
      <footer className="actionbar">
        <button className="btn primary big" disabled={busy} onClick={() => void save()}>
          {total === 0 ? t('saveNothing') : `${t('save')} (${total})`}
        </button>
      </footer>
    </main>
  );
}

function SpeciesCard({ row, name, onChange, onRemove, onAddLength, onRemoveLength }: {
  row: Row;
  name: string;
  onChange: (field: 'released' | 'kept', delta: number) => void;
  onRemove: () => void;
  onAddLength: (cm: number, kept: boolean) => void;
  onRemoveLength: (i: number) => void;
}) {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const fmt = (n: number) => n.toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB');
  const [cm, setCm] = useState('');
  const [kept, setKept] = useState(row.released === 0 && row.kept > 0);
  const cmNum = Number(cm.replace(',', '.'));
  const valid = cm !== '' && cmNum > 0 && cmNum < 400;

  const Counter = ({ field, value, label: l }: { field: 'released' | 'kept'; value: number; label: string }) => (
    <div className="counter">
      <span className="counter-label">{l}</span>
      <div className="row gap">
        <button type="button" className="step small" aria-label={`${name} ${l} −1`} onClick={() => onChange(field, -1)}>−</button>
        <span className="counter-value" aria-live="polite">{value}</span>
        <button type="button" className="step small" aria-label={`${name} ${l} +1`} onClick={() => onChange(field, 1)}>+</button>
      </div>
    </div>
  );

  return (
    <section className="card report-row" aria-label={name}>
      <div className="row between">
        <h2 className="card-title">{name}</h2>
        <button type="button" className="icon-btn" aria-label={`${t('removeSpecies')}: ${name}`} onClick={onRemove}>×</button>
      </div>
      <Counter field="released" value={row.released} label={t('released')} />
      <Counter field="kept" value={row.kept} label={t('kept')} />

      {row.lengths.length > 0 && (
        <div className="chips">
          {row.lengths.map((l, i) => (
            <button key={i} type="button" className="chip length-chip" aria-label={`${fmt(l.cm)} cm ${l.kept ? t('tagKept') : t('tagReleased')}: ${t('delete')}`} onClick={() => onRemoveLength(i)}>
              {fmt(l.cm)} cm · {l.kept ? t('tagKept') : t('tagReleased')} ×
            </button>
          ))}
        </div>
      )}
      {!open ? (
        <button type="button" className="link-btn small-link" onClick={() => setOpen(true)}>{t('addLength')}</button>
      ) : (
        <div className="length-row">
          <label className="input-label length-input">
            {t('length')} (cm)
            <input inputMode="decimal" value={cm} onChange={(e) => setCm(e.target.value)} />
          </label>
          <div className="chips" role="radiogroup" aria-label={t('fate')}>
            <button type="button" role="radio" aria-checked={!kept} className={`chip ${!kept ? 'on' : ''}`} onClick={() => setKept(false)}>{t('tagReleased')}</button>
            <button type="button" role="radio" aria-checked={kept} className={`chip ${kept ? 'on' : ''}`} onClick={() => setKept(true)}>{t('tagKept')}</button>
          </div>
          <button
            type="button"
            className="btn small primary"
            disabled={!valid}
            onClick={() => {
              onAddLength(Math.round(cmNum * 10) / 10, kept);
              setCm('');
            }}
          >
            {t('addShort')}
          </button>
        </div>
      )}
    </section>
  );
}
