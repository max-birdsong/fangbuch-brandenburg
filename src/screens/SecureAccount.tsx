import { useState } from 'react';
import { go, useLang } from '../app';
import { TopBar } from '../components/ui';
import { linkEmail, verifyLinkCode } from '../lib/auth';
import { getProfile, saveProfile } from '../lib/db';

export function SecureAccount() {
  const { t } = useLang();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [lottery, setLottery] = useState(true);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      console.warn(e);
      setErr(navigator.onLine ? t('errorGeneric') : t('errorOffline'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="screen">
      <TopBar title={t('secureAccount')} backTo="profile" />
      <div className="content stack">
        <p>{t('accountAnon')}</p>
        {!sent ? (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await linkEmail(email.trim());
                setSent(true);
              });
            }}
          >
            <label className="input-label">
              {t('email')}
              <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="check">
              <input type="checkbox" checked={lottery} onChange={(e) => setLottery(e.target.checked)} />
              {t('lottery')}
            </label>
            <button className="btn primary big" disabled={busy}>{t('sendCode')}</button>
          </form>
        ) : (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const p = await getProfile();
                if (p) {
                  const { dirty: _d, updatedAt: _u, ...rest } = p;
                  await saveProfile({ ...rest, lotteryOptIn: lottery });
                }
                await verifyLinkCode(email.trim(), code.trim());
                go('profile', true);
              });
            }}
          >
            <p>{t('codeSent', { email })}</p>
            <label className="input-label">
              {t('code')}
              <input inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
            <button className="btn primary big" disabled={busy}>{t('confirm')}</button>
          </form>
        )}
        {err && <p className="error" role="alert">{err}</p>}
      </div>
    </main>
  );
}
