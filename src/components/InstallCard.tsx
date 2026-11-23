import { useEffect, useState } from 'react';
import { useLang } from '../app';
import { setKV } from '../lib/db';
import { useKV } from '../lib/hooks';

// No app stores: the app is a website that can be added to the home screen. This card explains how,
// using the browser's own install prompt where there is one (Android/Chrome), otherwise short steps.
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: BIPEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as BIPEvent; });
}
const standalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export function InstallCard() {
  const { t } = useLang();
  const dismissed = useKV<boolean>('installDismissed', false);
  const [canPrompt, setCanPrompt] = useState(!!deferred);
  useEffect(() => {
    const on = () => setCanPrompt(true);
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  if (dismissed || standalone()) return null;
  return (
    <section className="card install-card stack-sm" aria-labelledby="install-title">
      <h2 id="install-title" className="card-title">{t('installTitle')}</h2>
      <p className="small">{canPrompt ? t('installText') : isIOS() ? t('installIOS') : t('installOther')}</p>
      <div className="row gap">
        {canPrompt && (
          <button className="btn primary small grow" onClick={() => void deferred?.prompt().then(() => { deferred = null; setCanPrompt(false); })}>
            {t('installButton')}
          </button>
        )}
        <button className="btn secondary small" onClick={() => void setKV('installDismissed', true)}>{t('installLater')}</button>
      </div>
    </section>
  );
}
