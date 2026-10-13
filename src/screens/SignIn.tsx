import { useState } from 'react';
import { go, useLang } from '../app';
import { TopBar } from '../components/ui';
import { sendLoginCode, verifyLoginCode } from '../lib/auth';

export function SignIn() {
  const { t } = useLang();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
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
      <TopBar title={t('signInTitle')} backTo="welcome" />
      <div className="content stack">
        {!sent ? (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await sendLoginCode(email.trim());
                setSent(true);
              });
            }}
          >
            <p>{t('signInIntro')}</p>
            <label className="input-label">
              {t('email')}
              <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button className="btn primary big" disabled={busy}>{t('sendCode')}</button>
          </form>
        ) : (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await verifyLoginCode(email.trim(), code.trim());
                go('', true);
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
