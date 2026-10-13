import { useEffect, useMemo, useState } from 'react';
import { go, useLang } from '../app';
import { TopBar } from '../components/ui';
import { QUICK_SPECIES, SPECIES, label } from '../data/catalog';
import { applyReport, db } from '../lib/db';
import { useTrip } from '../lib/hooks';
import { scheduleSync } from '../lib/sync';
import { fmtDate, fmtTime } from '../lib/util';

type Row = { species: string; released: number; kept: number };

/** End-of-trip catch report: counts per species, released and kept. */
export function Report({ tripId }: { tripId: string }) {
  const { t, lang } = useLang();
  const trip = useTrip(tripId);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);

  // Prefill from anything logged live during the day.
  useEffect(() => {
    void db.catches.where('tripId').equals(tripId).toArray().then((cs) => {
      const m = new Map<string, Row>();
      for (const c of cs.filter((x) => !x.deleted)) {
        const r = m.get(c.species) ?? { species: c.species, released: 0, kept: 0 };
        if (c.kept) r.kept += c.count; else r.released += c.count;
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

  const add = (species: string) => setRows((rs) => [...(rs ?? []), { species, released: 1, kept: 0 }]);
  const change = (species: string, field: 'released' | 'kept', delta: number) =>
    setRows((rs) => (rs ?? []).map((r) => (r.species === species ? { ...r, [field]: Math.max(0, Math.min(999, r[field] + delta)) } : r)));
  const remove = (species: string) => setRows((rs) => (rs ?? []).filter((r) => r.species !== species));
  const total = rows.reduce((s, r) => s + r.released + r.kept, 0);

  const save = async () => {
    setBusy(true);
    const target = rows.flatMap((r) => [
      { species: r.species, kept: false, count: r.released },
      { species: r.species, kept: true, count: r.kept }
    ]).filter((x) => x.count > 0);
    // Fish added in the report have no exact catch time.
    await applyReport(tripId, target, null);
    scheduleSync();
    go(`trip/${tripId}/summary`, true);
  };

  const Counter = ({ species, field, value, name }: { species: string; field: 'released' | 'kept'; value: number; name: string }) => (
    <div className="counter">
      <span className="counter-label">{name}</span>
      <div className="row gap">
        <button type="button" className="step small" aria-label={`${name} −1`} onClick={() => change(species, field, -1)}>−</button>
        <span className="counter-value" aria-live="polite">{value}</span>
        <button type="button" className="step small" aria-label={`${name} +1`} onClick={() => change(species, field, 1)}>+</button>
      </div>
    </div>
  );

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
          <section key={r.species} className="card report-row" aria-label={label(SPECIES, r.species, lang)}>
            <div className="row between">
              <h2 className="card-title">{label(SPECIES, r.species, lang)}</h2>
              <button type="button" className="icon-btn" aria-label={`${t('removeSpecies')}: ${label(SPECIES, r.species, lang)}`} onClick={() => remove(r.species)}>×</button>
            </div>
            <Counter species={r.species} field="released" value={r.released} name={t('released')} />
            <Counter species={r.species} field="kept" value={r.kept} name={t('kept')} />
          </section>
        ))}

        <section className="field">
          <h2 className="field-label">{t('addSpecies')}</h2>
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
