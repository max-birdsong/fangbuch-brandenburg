// Creates the anonymous account at most once, even if onboarding and background sync ask for it
// at the same moment (two parallel requests would otherwise create two accounts).
import { supabase } from './supabase';
import { setKV } from './db';

let inflight: Promise<string | null> | null = null;

export function signInAnonymouslyOnce(): Promise<string | null> {
  if (!supabase) return Promise.resolve(null);
  if (!inflight) {
    inflight = (async () => {
      const { data } = await supabase!.auth.getSession();
      if (data.session) return data.session.user.id;
      const { data: res, error } = await supabase!.auth.signInAnonymously();
      if (error) throw error;
      if (res.user) await setKV('ownerId', res.user.id);
      return res.user?.id ?? null;
    })().finally(() => { inflight = null; });
  }
  return inflight;
}
