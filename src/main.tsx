import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import '@fontsource/figtree/800.css';
import './styles.css';
import { ConfirmProvider, LangProvider, useLang, useRoute } from './app';
import { useSession } from './lib/auth';
import { useProfile } from './lib/hooks';
import { adoptSession, startAutoSync } from './lib/sync';
import { loadWaters } from './lib/waters';
import { isDemo, isTryMode, supabase } from './lib/supabase';
import { exitDemo } from './lib/demo';
import { seedDemo } from './lib/demoSeed';
import { Welcome } from './screens/Welcome';
import { SignIn } from './screens/SignIn';
import { ProfileForm } from './screens/ProfileForm';
import { Home } from './screens/Home';
import { Catches } from './screens/Catches';
import { Profile } from './screens/Profile';
import { SecureAccount } from './screens/SecureAccount';
import { Privacy } from './screens/Privacy';
import { Survey, SurveyThanks } from './screens/Survey';
import { Admin } from './screens/Admin';
import { TripForm } from './screens/TripForm';

function DemoBar() {
  const { t } = useLang();
  if (!isTryMode) return null;
  return (
    <div className="demo-bar" role="status">
      <span>{t('demoBar')}</span>
      <button type="button" onClick={() => void exitDemo()}>{t('demoExit')}</button>
    </div>
  );
}

function Router() {
  const r = useRoute();
  const profile = useProfile();
  const { session, ready } = useSession();

  useEffect(() => {
    if (session?.user.id) void adoptSession(session.user.id);
  }, [session?.user.id]);

  if (profile === undefined || !ready) return null; // loading local DB and session (a few ms)

  // Pages reachable without a profile.
  if (r[0] === 'privacy') return <Privacy />;
  if (r[0] === 'signin') return <SignIn />;
  // No profile yet: sign up with email first, then the one-time profile. (The demo build has no
  // server, so it goes straight to the profile.)
  if (!profile) {
    if (session || (isDemo && r[0] === 'onboarding')) return <ProfileForm mode="onboarding" />;
    return <Welcome />;
  }

  switch (r[0]) {
    case 'new':
      return <TripForm key="new" />;
    case 'trip':
      return <TripForm key={r[1]} id={r[1]} />;
    case 'catches':
      return <Catches />;
    case 'profile':
      return r[1] === 'edit' ? <ProfileForm mode="edit" /> : <Profile />;
    case 'secure':
      return <SecureAccount />;
    case 'admin':
      return <Admin />;
    case 'survey':
      return r[1] === 'thanks' ? <SurveyThanks /> : <Survey />;
    default:
      return <Home />;
  }
}

// Links in Supabase emails come back as #access_token=... or #message=...; that clashes with the
// hash routes. Let Supabase read it first, then send the angler to the start screen.
if (/(access_token|error_description|message)=/.test(location.hash)) {
  const clean = () => history.replaceState(null, '', `${location.pathname}#/`);
  if (supabase) void supabase.auth.getSession().finally(() => { clean(); dispatchEvent(new HashChangeEvent('hashchange')); });
  else clean();
}

registerSW({ immediate: true });
if (isTryMode) void seedDemo();
startAutoSync();
// Fetch the water list right away (not only when a day is opened), so it is on the phone even if the
// signal drops before the first fishing day is entered.
setTimeout(() => void loadWaters().catch(() => {}), 1500);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LangProvider>
      <ConfirmProvider>
        <DemoBar />
        <Router />
      </ConfirmProvider>
    </LangProvider>
  </StrictMode>
);
