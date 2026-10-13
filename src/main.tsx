import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import '@fontsource/figtree/800.css';
import './styles.css';
import { ConfirmProvider, LangProvider, useRoute } from './app';
import { useSession } from './lib/auth';
import { useProfile } from './lib/hooks';
import { adoptSession, startAutoSync } from './lib/sync';
import { supabase } from './lib/supabase';
import { Welcome } from './screens/Welcome';
import { SignIn } from './screens/SignIn';
import { ProfileForm } from './screens/ProfileForm';
import { Home } from './screens/Home';
import { Setup } from './screens/Setup';
import { TripScreen } from './screens/TripScreen';
import { CatchForm } from './screens/CatchForm';
import { Summary } from './screens/Summary';
import { Catches } from './screens/Catches';
import { Profile } from './screens/Profile';
import { SecureAccount } from './screens/SecureAccount';
import { Privacy } from './screens/Privacy';
import { Survey, SurveyThanks } from './screens/Survey';
import { Admin } from './screens/Admin';

function Router() {
  const r = useRoute();
  const profile = useProfile();
  const { session } = useSession();

  useEffect(() => {
    if (session?.user.id) void adoptSession(session.user.id);
  }, [session?.user.id]);

  if (profile === undefined) return null; // loading local DB (a few ms)

  // Pages reachable without a profile.
  if (r[0] === 'privacy') return <Privacy />;
  if (r[0] === 'signin') return <SignIn />;
  if (!profile) return r[0] === 'onboarding' ? <ProfileForm mode="onboarding" /> : <Welcome />;

  switch (r[0]) {
    case 'setup':
      return <Setup />;
    case 'trip':
      if (r[2] === 'catch') return <CatchForm key={r[3] ?? 'new'} tripId={r[1]} catchId={r[3]} />;
      if (r[2] === 'summary') return <Summary id={r[1]} />;
      return <TripScreen id={r[1]} />;
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
startAutoSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LangProvider>
      <ConfirmProvider>
        <Router />
      </ConfirmProvider>
    </LangProvider>
  </StrictMode>
);
