import { useLang } from '../app';

export function Satisfaction({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const { t } = useLang();
  return (
    <div className="stack-xs">
      <div className="sat" role="radiogroup" aria-label={t('satQ')}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} / 5`} className={`chip sat-btn ${value === n ? 'on' : ''}`} onClick={() => onChange(n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="row between small muted">
        <span>{t('satLow')}</span>
        <span>{t('satHigh')}</span>
      </div>
    </div>
  );
}
