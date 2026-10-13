import { useState } from 'react';
import { go, useConfirm, useLang } from '../app';
import { BottomNav } from '../components/ui';
import { LangSwitch } from '../components/LangSwitch';
import { CLUB_STATUS, COUNTRIES, LICENSES, METHODS, PLATFORMS, SPECIES, label } from '../data/catalog';
import { db, saveProfile } from '../lib/db';
import { deleteAccount, signOut, useSession } from '../lib/auth';
import { useProfile, usePending, useSyncState } from '../lib/hooks';
import { isDemo } from '../lib/supabase';
import { scheduleSync, syncNow } from '../lib/sync';
import { downloadText, toCSV } from '../lib/util';

export function Profile() {
  const { t, lang } = useLang();
  const confirm = useConfirm();
  const profile = useProfile();
  const { session } = useSession();
  const pending = usePending();
  const sync = useSyncState();
  const [err, setErr] = useState<string | null>(null);
  if (profile === undefined) return <main className="screen with-nav" />;

  const email = session?.user.email || null;
  const isAnon = !!session?.user.is_anonymous;

  const exportCsv = async () => {
    const trips = (await db.trips.toArray()).filter((x) => !x.deleted);
    const catches = (await db.catches.toArray()).filter((x) => !x.deleted);
    const byId = new Map(trips.map((x) => [x.id, x]));
    const rows = catches
      .filter((c) => byId.has(c.tripId))
      .map((c) => {
        const tr = byId.get(c.tripId)!;
        return {
          date: tr.startedAt.slice(0, 10),
          water: tr.waterOther || tr.waterName,
          method: label(METHODS, tr.method, lang),
          platform: label(PLATFORMS, tr.platform, lang),
          species: label(SPECIES, c.species, lang),
          count: c.count,
          length_cm: c.lengthCm,
          kept: c.kept ? 1 : 0
        };
      });
    const tripRows = trips.map((tr) => ({
      date: tr.startedAt.slice(0, 10),
      start: tr.startedAt,
      end: tr.endedAt,
      water: tr.waterOther || tr.waterName,
      method: label(METHODS, tr.method, lang),
      platform: label(PLATFORMS, tr.platform, lang),
      satisfaction: tr.satisfaction,
      n_fish: catches.filter((c) => c.tripId === tr.id).reduce((s, c) => s + c.count, 0)
    }));
    downloadText('fangbuch-faenge.csv', toCSV(rows));
    setTimeout(() => downloadText('fangbuch-angeltage.csv', toCSV(tripRows)), 400);
  };

  const doSignOut = async () => {
    if (!(await confirm(t('signOutQ'), t('signOut'), true))) return;
    await signOut();
    go('welcome', true);
  };

  const doDelete = async () => {
    if (!(await confirm(t('deleteAccountQ'), t('delete'), true))) return;
    try {
      await deleteAccount();
      go('welcome', true);
    } catch {
      setErr(navigator.onLine ? t('errorGeneric') : t('errorOffline'));
    }
  };

  const licenses = (profile?.licenses ?? []).map((c) => label(LICENSES, c, lang)).join(', ');

  return (
    <main className="screen with-nav">
      <header className="plain-head"><h1>{t('profileTitle')}</h1></header>
      <div className="content stack">
        <div className="card row between">
          <span className="strong">{t('language')}</span>
          <LangSwitch />
        </div>

        {profile && (
          <a className="card stack-xs" href="#/profile/edit">
            <span className="row between"><span className="strong">{t('aboutMe')}</span><span className="teal small strong">{t('edit')}</span></span>
            <span className="muted small">
              {profile.yearsFishing} {t('years')} · {label(COUNTRIES, profile.homeCountry, lang)} {profile.homePostcode}
            </span>
            <span className="muted small">{label(CLUB_STATUS, profile.clubStatus, lang)}{profile.clubName ? ` (${profile.clubName})` : ''}</span>
            {licenses && <span className="muted small">{licenses}</span>}
          </a>
        )}

        {!isDemo && (
          <div className="card stack-sm">
            <span className="strong">{t('account')}</span>
            {email && !isAnon ? (
              <>
                <span className="muted small">{t('accountLinked', { email })}</span>
                {profile && (
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={profile.lotteryOptIn}
                      onChange={(e) => {
                        const { dirty: _d, updatedAt: _u, ...rest } = profile;
                        void saveProfile({ ...rest, lotteryOptIn: e.target.checked }).then(() => scheduleSync());
                      }}
                    />
                    {t('lottery')}
                  </label>
                )}
              </>
            ) : (
              <>
                <span className="muted small">{t('accountAnon')}</span>
                <a className="btn primary" href="#/secure">{t('secureAccount')}</a>
              </>
            )}
            <button className="btn secondary" disabled={sync.running} onClick={() => void syncNow()}>
              {t('syncNow')}{pending ? ` (${pending})` : ''}
            </button>
          </div>
        )}

        <button className="btn secondary" onClick={() => void exportCsv()}>{t('exportData')}</button>
        <a className="btn secondary" href="#/privacy">{t('privacy')}</a>

        <div className="card stack-xs">
          <span className="strong">{t('about')}</span>
          <span className="muted small">{t('aboutText')}</span>
          <span className="muted small">{t('osm')}</span>
          <span className="muted small">{t('version')} {__APP_VERSION__}</span>
        </div>

        {!isDemo && session && !isAnon && <button className="btn secondary" onClick={() => void doSignOut()}>{t('signOut')}</button>}
        <button className="btn danger-outline" onClick={() => void doDelete()}>{t('deleteAccount')}</button>
        {err && <p className="error" role="alert">{err}</p>}
      </div>
      <BottomNav active="profile" />
    </main>
  );
}
