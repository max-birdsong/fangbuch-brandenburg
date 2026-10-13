import { go, useLang } from '../app';
import { isDemo } from '../lib/supabase';
import { LangSwitch } from '../components/LangSwitch';

export function Welcome() {
  const { t } = useLang();
  return (
    <main className="screen welcome">
      <div className="welcome-top">
        <div className="row end">
          <LangSwitch dark />
        </div>
        <p className="kicker">{t('institute')}</p>
        <h1 className="display">
          {t('welcomeTitle')}
          <br />
          Brandenburg
        </h1>
        <p className="lead">{t('welcomeIntro')}</p>
      </div>
      <svg className="waves" aria-hidden="true" viewBox="0 0 334 120" preserveAspectRatio="none">
        <path d="M0 40 C 50 20, 90 60, 140 40 S 230 20, 334 40" fill="none" stroke="#5FA8B3" strokeWidth="3" />
        <path d="M0 70 C 50 50, 90 90, 140 70 S 230 50, 334 70" fill="none" stroke="#3D8592" strokeWidth="3" />
        <path d="M0 100 C 50 80, 90 120, 140 100 S 230 80, 334 100" fill="none" stroke="#2A6E7B" strokeWidth="3" />
        <path d="M190 58 q 26 -16 52 0 q -26 16 -52 0 z M242 58 l 14 -9 v 18 z" fill="#FFFFFF" />
      </svg>
      <div className="stack">
        <button className="btn accent big" onClick={() => go('onboarding')}>{t('getStarted')}</button>
        {!isDemo && (
          <button className="btn ghost-light" onClick={() => go('signin')}>{t('haveAccount')}</button>
        )}
        {isDemo && <p className="demo-note">{t('demoMode')}</p>}
        <a className="link-light" href="#/privacy">{t('privacy')}</a>
      </div>
    </main>
  );
}
