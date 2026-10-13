import { useEffect, useState } from 'react';
import { useLang } from '../app';
import { Chips } from './ui';
import { SPECIES, label } from '../data/catalog';

/** One entry in the list: a single fish (count 1, optional length) or many small fish at once (count > 1, no length). */
export type FishDraft = { key: string; species: string; count: number; cm: string; kept: boolean };

export const parseCm = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

/**
 * Small screen for one fish: species, optional length, released or kept. Used to add and to edit.
 * A link at the bottom switches to "many fish at once" (species, number, released or kept; no length).
 */
export function FishSheet({ fish, suggestions, onSave, onDelete, onClose }: {
  fish: FishDraft | null;
  suggestions: string[];
  onSave: (f: Omit<FishDraft, 'key'>) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const { t, lang } = useLang();
  const [species, setSpecies] = useState<string | null>(fish?.species ?? null);
  const [cm, setCm] = useState(fish?.cm ?? '');
  const [kept, setKept] = useState<boolean | null>(fish?.kept ?? null);
  const [bulk, setBulk] = useState((fish?.count ?? 1) > 1);
  const [count, setCount] = useState(fish && fish.count > 1 ? String(fish.count) : '');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // A species picked from the dropdown joins the chips so the choice stays visible.
  const chipCodes = species && !suggestions.includes(species) ? [...suggestions, species] : suggestions;
  const others = SPECIES.filter((s) => !chipCodes.includes(s.code));

  const submit = () => {
    if (!species) return setErr(t('pickSpecies'));
    const n = bulk ? Number(count) : 1;
    if (bulk && !(Number.isInteger(n) && n >= 2 && n <= 9999)) return setErr(t('countInvalid'));
    const len = bulk ? null : parseCm(cm);
    if (len !== null && !(len > 0 && len < 400)) return setErr(t('lengthInvalid'));
    if (kept === null) return setErr(t('pickFate'));
    onSave({ species, count: n, cm: bulk ? '' : cm.trim(), kept });
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal fish-sheet" role="dialog" aria-modal="true" aria-labelledby="fish-sheet-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="fish-sheet-title" className="sheet-title">{bulk ? t('bulkTitle') : fish ? t('fishEdit') : t('fishAdd')}</h2>
        {bulk && <p className="muted small">{t('bulkHint')}</p>}

        <div className="stack-sm">
          <p className="sub-label">{t('species')}</p>
          <Chips
            label={t('species')}
            options={chipCodes.map((c) => ({ code: c, label: label(SPECIES, c, lang) }))}
            value={species}
            onChange={(v) => { setSpecies(v); setErr(null); }}
          />
          <select aria-label={t('chooseSpecies')} value="" onChange={(e) => { if (e.target.value) { setSpecies(e.target.value); setErr(null); } }}>
            <option value="">{t('chooseSpecies')}</option>
            {others.map((s) => <option key={s.code} value={s.code}>{s[lang]}</option>)}
          </select>
        </div>

        {bulk ? (
          <label className="input-label">
            {t('count')}
            <input className="fish-len" inputMode="numeric" value={count} onChange={(e) => { setCount(e.target.value.replace(/\D/g, '')); setErr(null); }} />
          </label>
        ) : (
          <label className="input-label">
            {t('lengthOptional')}
            <input className="fish-len" inputMode="decimal" placeholder="cm" value={cm} onChange={(e) => { setCm(e.target.value); setErr(null); }} />
          </label>
        )}

        <div className="stack-sm">
          <p className="sub-label">{bulk ? t('fateMany') : t('fate')}</p>
          <div className="chips" role="radiogroup" aria-label={bulk ? t('fateMany') : t('fate')}>
            <button type="button" role="radio" aria-checked={kept === false} className={`chip ${kept === false ? 'on' : ''}`} onClick={() => { setKept(false); setErr(null); }}>{t('released')}</button>
            <button type="button" role="radio" aria-checked={kept === true} className={`chip ${kept === true ? 'on' : ''}`} onClick={() => { setKept(true); setErr(null); }}>{t('kept')}</button>
          </div>
        </div>

        {err && <p className="error" role="alert">{err}</p>}

        <div className="stack-sm">
          <button type="button" className="btn primary" onClick={submit}>{fish ? t('save') : t('addFishBtn')}</button>
          <button type="button" className="btn secondary" onClick={onClose}>{t('cancel')}</button>
          {onDelete && <button type="button" className="btn danger-outline" onClick={onDelete}>{t('delete')}</button>}
        </div>
        <button type="button" className="link-btn" onClick={() => { setBulk(!bulk); setErr(null); }}>
          {bulk ? t('bulkBack') : t('bulkLink')}
        </button>
      </div>
    </div>
  );
}

/** One line in the fish list, e.g. "Zander · 52 cm · zurückgesetzt" or "Plötze · 40 Stück · zurückgesetzt". */
export function fishLine(f: FishDraft, name: string, fateText: string, piecesText: string, lang: string) {
  const n = parseCm(f.cm);
  const len = f.count > 1 ? piecesText : n === null ? null : `${lang === 'de' ? String(n).replace('.', ',') : n} cm`;
  return [name, len, fateText.toLowerCase()].filter(Boolean).join(' · ');
}
