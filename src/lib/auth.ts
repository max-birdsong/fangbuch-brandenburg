// Accounts: anglers start without any login (anonymous Supabase user), so the first catch is
// one tap away. They can later "secure" the log with an email address (needed for a new phone).
// Signing in on another device uses a 6-digit code sent by email,
// which works better inside an installed web app than a magic link.
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { adoptSession, pullAll, syncNow } from './sync';
import { setKV, wipeLocal } from './db';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, ready };
}

/** Creates an anonymous account if none exists yet. Fails quietly when offline (retried on sync). */
export async function ensureAnonymous() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (data.session) return;
  const { data: res, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (res.user) await setKV('ownerId', res.user.id);
}

/** Where links in Supabase emails send the angler back to: this app. */
const appUrl = () => `${location.origin}${location.pathname}`;

export async function sendLoginCode(email: string) {
  if (!supabase) throw new Error('demo');
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: appUrl() } });
  if (error) throw error;
}

export async function verifyLoginCode(email: string, token: string) {
  if (!supabase) throw new Error('demo');
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
  if (data.user) await adoptSession(data.user.id);
}

/** Attach an email to the current (anonymous) account. Supabase emails a code to confirm. */
export async function linkEmail(email: string) {
  if (!supabase) throw new Error('demo');
  const { error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: appUrl() });
  if (error) throw error;
}

export async function verifyLinkCode(email: string, token: string) {
  if (!supabase) throw new Error('demo');
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email_change' });
  if (error) throw error;
  await syncNow();
}

/**
 * After the angler tapped the confirmation link (possibly in another browser tab), refresh this
 * device's session and report whether the email is now confirmed on the account.
 */
export async function checkEmailConfirmed(email: string): Promise<boolean> {
  if (!supabase) return false;
  await supabase.auth.refreshSession();
  const { data } = await supabase.auth.getUser();
  const ok = !!data.user && data.user.email?.toLowerCase() === email.toLowerCase();
  if (ok) await syncNow();
  return ok;
}

/** Signed in on this device (e.g. after tapping a login link)? Then adopt that account's data. */
export async function hasSession(): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  if (data.session?.user && !data.session.user.is_anonymous) {
    await adoptSession(data.session.user.id);
    return true;
  }
  return false;
}

export async function signOut() {
  await syncNow();
  await supabase?.auth.signOut();
  await wipeLocal();
}

export async function deleteAccount() {
  if (supabase) {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw error;
    await supabase.auth.signOut();
  }
  await wipeLocal();
}

export { pullAll };
