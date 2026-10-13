import { useLang } from '../app';

export type FishDraft = { key: string; species: string; cm: string; kept: boolean | null };

/** One caught fish: species, optional length, released or kept (must be chosen). */
export function FishRow({ fish, name, index, showMissing, onChange, onCopy, onRemove }: {
  fish: FishDraft;
  name: string;
  index: number;
  showMissing: boolean;
  onChange: (f: FishDraft) => void;
  onCopy: () => void;
  onRemove: () => void;
}) {
  const { t } = useLang();
  const missing = showMissing && fish.kept === null;
  const label = `${index}. ${name}`;
  return (
    <section className={`card fish-row ${missing ? 'missing' : ''}`} aria-label={label}>
      <div className="row between">
        <h3 className="card-title">{label}</h3>
        <div className="row">
          <button type="button" className="icon-btn" aria-label={`${t('copyFish')}: ${name}`} title={t('copyFish')} onClick={onCopy}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15V6a2 2 0 012-2h9" />
            </svg>
          </button>
          <button type="button" className="icon-btn" aria-label={`${t('delete')}: ${name}`} onClick={onRemove}>×</button>
        </div>
      </div>
      <div className="fish-fields">
        <input
          className="fish-len"
          inputMode="decimal"
          placeholder={t('lengthPlaceholder')}
          aria-label={`${name}: ${t('lengthOptional')}`}
          value={fish.cm}
          onChange={(e) => onChange({ ...fish, cm: e.target.value })}
        />
        <div className="chips fate" role="radiogroup" aria-label={`${name}: ${t('fate')}`}>
          <button type="button" role="radio" aria-checked={fish.kept === false} className={`chip ${fish.kept === false ? 'on' : ''}`} onClick={() => onChange({ ...fish, kept: false })}>
            {t('released')}
          </button>
          <button type="button" role="radio" aria-checked={fish.kept === true} className={`chip ${fish.kept === true ? 'on' : ''}`} onClick={() => onChange({ ...fish, kept: true })}>
            {t('kept')}
          </button>
        </div>
      </div>
      {missing && <p className="error small">{t('fateMissing')}</p>}
    </section>
  );
}
