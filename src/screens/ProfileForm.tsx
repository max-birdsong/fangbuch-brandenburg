import { useEffect, useState } from 'react';
import { go, useLang } from '../app';
import { Chips, Field, Stepper, TopBar } from '../components/ui';
import { CLUB_STATUS, COUNTRIES, LICENSES } from '../data/catalog';
import { CONSENT_VERSION, getProfile, saveProfile, type Profile } from '../lib/db';
import { ensureAnonymous } from '../lib/auth';
import { scheduleSync } from '../lib/sync';

type Draft = Omit<Profile, 'dirty' | 'updatedAt' | 'consentVersion' | 'consentAt'>;
const EMPTY: Draft = {
  yearsFishing: 10,
  homeCountry: 'DE',
  homePostcode: '',
  clubStatus: null,
  clubName: '',
  hasFishingExam: null,
  licenses: [],
  licensesOther: ''
};

const postcodeOk = (country: Draft['homeCountry'], pc: string) => {
  const v = pc.trim();
  if (!v) return true; // optional
  if (country === 'DE') return /^\d{5}$/.test(v);
  if (country === 'PL') return /^\d{2}-?\d{3}$/.test(v);
  return v.length >= 2 && v.length <= 10;
};

/** Onboarding (mode = 'onboarding') and later editing (mode = 'edit') share this form. */
export function ProfileForm({ mode }: { mode: 'onboarding' | 'edit' }) {
  const { t, lang } = useLang();
  const [d, setD] = useState<Draft>(EMPTY);
  const [consent, setConsent] = useState(false);
  const [existing, setExisting] = useState<Profile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getProfile().then((p) => {
      if (p) {
        setExisting(p);
        const { dirty: _d, updatedAt: _u, consentVersion: _cv, consentAt: _ca, ...rest } = p;
        setD(rest);
        setConsent(true);
      }
    });
  }, []);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const toggleLicense = (code: string) =>
    set('licenses', d.licenses.includes(code) ? d.licenses.filter((x) => x !== code) : [...d.licenses, code]);
  const isMember = d.clubStatus === 'active' || d.clubStatus === 'passive';
  const pcValid = postcodeOk(d.homeCountry, d.homePostcode);

  const submit = async () => {
    if (!consent) return setErr(t('required'));
    if (!pcValid) return setErr(`${t('postcode')}?`);
    setErr(null);
    setBusy(true);
    await saveProfile({
      ...d,
      homePostcode: d.homePostcode.trim(),
      clubName: isMember ? d.clubName.trim() : '',
      licensesOther: d.licenses.includes('other') ? d.licensesOther.trim() : '',
      consentVersion: existing?.consentVersion ?? CONSENT_VERSION,
      consentAt: existing?.consentAt ?? new Date().toISOString()
    });
    setBusy(false);
    go(mode === 'onboarding' ? '' : 'profile', true);
    if (mode === 'onboarding') {
      // In the background: never block or redirect the angler while the account is created.
      ensureAnonymous()
        .catch((e) => console.warn('Anonymous sign-in deferred', e)) // offline: retried by sync
        .finally(() => scheduleSync(300));
    } else {
      scheduleSync(300);
    }
  };

  return (
    <main className="screen">
      {mode === 'onboarding' ? (
        <header className="form-head">
          <p className="kicker dark">{t('onbKicker')}</p>
          <h1>{t('onbTitle')}</h1>
        </header>
      ) : (
        <TopBar title={t('editProfile')} backTo="profile" />
      )}
      <div className="content stack-lg">
        <Field label={t('qYears')}>
          <Stepper label={t('qYears')} value={d.yearsFishing ?? 0} min={0} max={90} unit={t('years')} onChange={(v) => set('yearsFishing', v)} />
        </Field>

        <Field label={t('qHome')} hint={t('homeHint')}>
          <Chips
            label={t('country')}
            options={COUNTRIES.map((c) => ({ code: c.code as NonNullable<Draft['homeCountry']>, label: c[lang] }))}
            value={d.homeCountry}
            onChange={(v) => set('homeCountry', v)}
          />
          <label className="input-label">
            {t('postcode')}
            <input
              className={pcValid ? '' : 'invalid'}
              inputMode={d.homeCountry === 'other' ? 'text' : 'numeric'}
              autoComplete="postal-code"
              maxLength={10}
              value={d.homePostcode}
              onChange={(e) => set('homePostcode', e.target.value)}
              aria-invalid={!pcValid}
            />
          </label>
        </Field>

        <Field label={t('qClub')}>
          <Chips
            label={t('qClub')}
            options={CLUB_STATUS.map((c) => ({ code: c.code as NonNullable<Draft['clubStatus']>, label: c[lang] }))}
            value={d.clubStatus}
            onChange={(v) => set('clubStatus', v)}
          />
          {isMember && (
            <label className="input-label">
              {t('clubName')}
              <input maxLength={200} value={d.clubName} onChange={(e) => set('clubName', e.target.value)} />
            </label>
          )}
        </Field>

        <Field label={t('qExam')}>
          <Chips
            label={t('qExam')}
            options={[{ code: 'yes', label: t('yes') }, { code: 'no', label: t('no') }]}
            value={d.hasFishingExam === null ? null : d.hasFishingExam ? 'yes' : 'no'}
            onChange={(v) => set('hasFishingExam', v === 'yes')}
          />
        </Field>

        <Field label={<>{t('qLicenses')} <span className="muted">({t('multiple')})</span></>}>
          <div className="stack-sm" role="group" aria-label={t('qLicenses')}>
            {LICENSES.map((l) => {
              const on = d.licenses.includes(l.code);
              return (
                <button key={l.code} type="button" role="checkbox" aria-checked={on} className={`option ${on ? 'on' : ''}`} onClick={() => toggleLicense(l.code)}>
                  <span className="option-title">{l[lang]}</span>
                  {(lang === 'de' ? l.sub_de : l.sub_en) && <span className="option-sub">{lang === 'de' ? l.sub_de : l.sub_en}</span>}
                </button>
              );
            })}
          </div>
          {d.licenses.includes('other') && (
            <label className="input-label">
              {t('licensesOther')}
              <input maxLength={200} value={d.licensesOther} onChange={(e) => set('licensesOther', e.target.value)} />
            </label>
          )}
        </Field>

        {mode === 'onboarding' && (
          <label className="consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              {t('consent')} <a href="#/privacy">{t('privacy')}</a>
            </span>
          </label>
        )}
        {err && <p className="error" role="alert">{err}</p>}
      </div>
      <footer className="actionbar">
        <button className="btn primary big" disabled={busy || (mode === 'onboarding' && !consent)} onClick={() => void submit()}>
          {mode === 'onboarding' ? t('onbNext') : t('save')}
        </button>
      </footer>
    </main>
  );
}
