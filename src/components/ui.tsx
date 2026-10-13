import type { ReactNode } from 'react';
import { back, go, useLang } from '../app';

export function TopBar({ title, onBack, backTo = '', close, dark }: { title: string; onBack?: () => void; backTo?: string; close?: boolean; dark?: boolean }) {
  const { t } = useLang();
  return (
    <header className={`topbar ${dark ? 'dark' : ''}`}>
      <button className="icon-btn" aria-label={close ? t('cancel') : t('back')} onClick={onBack ?? (() => back(backTo))}>
        {close ? <IconClose /> : <IconBack />}
      </button>
      <h1>{title}</h1>
    </header>
  );
}

export function Chips<T extends string>({
  options, value, onChange, multi, label
}: {
  options: { code: T; label: string }[];
  value: T | T[] | null;
  onChange: (v: T) => void;
  multi?: boolean;
  label?: string;
}) {
  const sel = (c: T) => (Array.isArray(value) ? value.includes(c) : value === c);
  return (
    <div className="chips" role={multi ? 'group' : 'radiogroup'} aria-label={label}>
      {options.map((o) => (
        <button
          key={o.code}
          type="button"
          className={`chip ${sel(o.code) ? 'on' : ''}`}
          role={multi ? 'checkbox' : 'radio'}
          aria-checked={sel(o.code)}
          onClick={() => onChange(o.code)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 999, steps = [1], unit, label, allowInput = true }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; steps?: number[]; unit?: string; label: string; allowInput?: boolean;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const big = steps.length > 1 ? steps[steps.length - 1] : null;
  return (
    <div className="stepper">
      {big && <button type="button" className="step" aria-label={`${label} −${big}`} onClick={() => onChange(clamp(value - big))}>−{big}</button>}
      <button type="button" className="step" aria-label={`${label} −1`} onClick={() => onChange(clamp(value - 1))}>−</button>
      <label className="step-value">
        <span className="sr-only">{label}</span>
        {allowInput ? (
          <input
            type="number"
            inputMode="numeric"
            value={value}
            min={min}
            max={max}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!Number.isNaN(n)) onChange(clamp(n));
            }}
          />
        ) : (
          <span>{value}</span>
        )}
        {unit && <span className="unit">{unit}</span>}
      </label>
      <button type="button" className="step" aria-label={`${label} +1`} onClick={() => onChange(clamp(value + 1))}>+</button>
      {big && <button type="button" className="step" aria-label={`${label} +${big}`} onClick={() => onChange(clamp(value + big))}>+{big}</button>}
    </div>
  );
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="field">
      <h2 className="field-label">{label}</h2>
      {hint && <p className="hint">{hint}</p>}
      {children}
    </section>
  );
}

export function BottomNav({ active }: { active: 'home' | 'catches' | 'profile' }) {
  const { t } = useLang();
  const items: [typeof active, string, string][] = [
    ['home', t('navHome'), ''],
    ['catches', t('navCatches'), 'catches'],
    ['profile', t('navProfile'), 'profile']
  ];
  return (
    <nav className="bottomnav" aria-label="Navigation">
      {items.map(([id, label, path]) => (
        <a key={id} href={`#/${path}`} className={active === id ? 'on' : ''} aria-current={active === id ? 'page' : undefined}>
          <span className="bar" aria-hidden="true" />
          {label}
        </a>
      ))}
    </nav>
  );
}

export const IconBack = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
export const IconClose = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconPin = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 21s-7-6.1-7-11.5A7 7 0 0119 9.5C19 14.9 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
);
export const IconSearch = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-4-4" />
  </svg>
);

export const goHome = () => go('', true);
