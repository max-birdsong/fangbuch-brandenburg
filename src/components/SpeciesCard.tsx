import { useState } from 'react';
import { useLang } from '../app';

export type Measured = { cm: number; kept: boolean };
export type CatchRowState = { species: string; released: number; kept: number; lengths: Measured[] };

/** One species in the catch list: released / kept counters and optional lengths. */
export function SpeciesCard({ row, name, onChange, onRemove, onAddLength, onRemoveLength }: {
  row: CatchRowState;
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
