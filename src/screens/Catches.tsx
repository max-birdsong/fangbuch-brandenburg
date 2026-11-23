import { useEffect, useMemo, useState } from 'react';
import { useLang } from '../app';
import { BottomNav, Chips } from '../components/ui';
import { TripCard } from '../components/TripCard';
import { Columns, HBars } from '../components/charts';
import { SPECIES, label } from '../data/catalog';
import { getKV, setKV } from '../lib/db';
import { useCatches, useOnline, useTrips } from '../lib/hooks';
import { personalStats, seasons, yearOf, type CommunityStats } from '../lib/personalStats';
import { supabase } from '../lib/supabase';
import { fmtDateShort } from '../lib/util';
import { localWaterName } from '../lib/waterNames';

const PAGE = 30;

/**
 * The angler's own dashboard ("Statistik" tab): season numbers, records, when and where they catch,
 * how everyone is doing, and the full list of fishing days. Meant as the reason to keep logging.
 */
export function Catches() {
  const { t, lang } = useLang();
  const trips = useTrips();
  const catches = useCatches();
  const online = useOnline();
  const [season, setSeason] = useState<number | 'all'>(new Date().getFullYear());
  const [shown, setShown] = useState(PAGE);
  const [community, setCommunity] = useState<CommunityStats | null>(null);

  // Community numbers: last known value from the phone first, then fresh from the server.
  const commYear = season === 'all' ? new Date().getFullYear() : season;
  useEffect(() => {
    let live = true;
    const key = `community:${commYear}`;
    void getKV<CommunityStats | null>(key, null).then((c) => live && setCommunity(c));
    if (supabase && online) {
      void supabase.rpc('community_stats', { season: commYear }).then(({ data, error }) => {
        if (!live || error || !data) return;
        const c = { ...(data as CommunityStats), fetchedAt: Date.now() };
        setCommunity(c);
        void setKV(key, c);
      });
    }
    return () => { live = false; };
  }, [commYear, online]);

  const byTrip = useMemo(() => {
    const m = new Map<string, NonNullable<typeof catches>>();
    for (const c of catches ?? []) m.set(c.tripId, [...(m.get(c.tripId) ?? []), c]);
    return m;
  }, [catches]);
  const st = useMemo(() => (trips && catches ? personalStats(trips, catches, season) : null), [trips, catches, season]);
  if (!trips || !catches || !st) return <main className="screen with-nav" />;

  const nf = (v: number, d = 0) => v.toLocaleString(lang === 'en' ? 'en-GB' : lang === 'pl' ? 'pl-PL' : 'de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
  const months = Array.from({ length: 12 }, (_, m) => new Date(2026, m, 1).toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'pl' ? 'pl-PL' : 'de-DE', { month: 'short' }));
  const slotName = { morning: t('slotMorning'), day: t('slotDay'), evening: t('slotEvening'), night: t('slotNight') };
  const listed = trips.filter((tr) => season === 'all' || yearOf(tr) === season);
  const years = seasons(trips);
  const comm = community && community.enough ? community : null;
  const commPerHour = comm && comm.hours ? (comm.fish ?? 0) / comm.hours : null;

  return (
    <main className="screen with-nav">
      <header className="plain-head"><h1>{t('statsTitle')}</h1></header>
      <div className="content stack">
        {years.length > 1 && (
          <Chips
            label={t('season', { year: '' }).trim()}
            options={[...years.map((y) => ({ code: String(y), label: String(y) })), { code: 'all', label: t('allYears') }]}
            value={String(season)}
            onChange={(v) => { setSeason(v === 'all' ? 'all' : Number(v)); setShown(PAGE); }}
          />
        )}

        {trips.length === 0 ? (
          <p className="muted">{t('statsEmpty')}</p>
        ) : (
          <>
            <dl className="kpis">
              <div><dt>{t('statDays')}</dt><dd>{nf(st.days)}</dd></div>
              <div><dt>{t('statHours')}</dt><dd>{nf(st.hours)}</dd></div>
              <div><dt>{t('statFish')}</dt><dd>{nf(st.fish)}</dd></div>
              <div><dt>{t('statPerHour')}</dt><dd>{st.perHour === null ? '–' : nf(st.perHour, 2)}</dd></div>
              <div><dt>{t('statSpecies')}</dt><dd>{nf(st.speciesCount)}</dd></div>
              <div><dt>{t('statZero')}</dt><dd>{nf(st.zeroDays)}</dd></div>
            </dl>

            <section className="card stack-sm">
              <h2 className="viz-title">{t('recordsTitle')}</h2>
              {st.bests.length === 0 ? (
                <p className="muted small">{t('recordsEmpty')}</p>
              ) : (
                <ul className="records">
                  {st.bests.map((b) => (
                    <li key={b.species} className="row between gap">
                      <span>
                        <span className="strong">{label(SPECIES, b.species, lang)}</span>
                        {b.isNew && <span className="badge-new">{t('recordNew')}</span>}
                        <span className="muted small record-sub">{fmtDateShort(b.date, lang)} · {localWaterName(b.water, lang)}</span>
                      </span>
                      <span className="record-cm">{nf(b.cm, b.cm % 1 ? 1 : 0)} cm</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {st.byMonth.length > 1 && (
              <section className="card stack-sm">
                <h2 className="viz-title">{t('monthTitle')}</h2>
                <Columns
                  label={t('monthTitle')}
                  data={st.byMonth.map((m) => ({ x: String(m.month), xLabel: months[m.month], value: m.hours > 0 ? m.fish / m.hours : 0 }))}
                  valueLabel={(v) => t('perHourFmt', { v: nf(v, 2) })}
                />
              </section>
            )}

            {st.byWater.length > 0 && (
              <section className="card stack-sm">
                <h2 className="viz-title">{t('watersTitle')}</h2>
                <p className="muted small">{t('watersSub')}</p>
                <HBars
                  label={t('watersTitle')}
                  rows={st.byWater.slice(0, 6).map((w) => ({
                    key: w.water,
                    label: `${localWaterName(w.water, lang)} (${t('daysFmt', { n: w.days })})`,
                    value: w.perHour,
                    valueText: nf(w.perHour, 2),
                    tip: <><strong>{localWaterName(w.water, lang)}</strong><br />{t('daysFmt', { n: w.days })} · {nf(w.hours, 1)} h · {w.fish} {t('statFish')}</>
                  }))}
                />
              </section>
            )}

            {st.byTimeOfDay.length > 1 && (
              <section className="card stack-sm">
                <h2 className="viz-title">{t('timeTitle')}</h2>
                <HBars
                  label={t('timeTitle')}
                  rows={st.byTimeOfDay.map((s) => ({
                    key: s.slot,
                    label: `${slotName[s.slot]} (${t('daysFmt', { n: s.days })})`,
                    value: s.perHour ?? 0,
                    valueText: s.perHour === null ? '–' : nf(s.perHour, 2),
                    tip: <><strong>{slotName[s.slot]}</strong><br />{t('perHourFmt', { v: s.perHour === null ? '–' : nf(s.perHour, 2) })}</>
                  }))}
                />
              </section>
            )}
          </>
        )}

        {supabase && (
          <section className="card stack-sm community">
            <h2 className="viz-title">{t('communityTitle', { year: commYear })}</h2>
            {comm ? (
              <>
                <dl className="kpis small">
                  <div><dt>{t('communityAnglers')}</dt><dd>{nf(comm.anglers)}</dd></div>
                  <div><dt>{t('statDays')}</dt><dd>{nf(comm.days ?? 0)}</dd></div>
                  <div><dt>{t('statFish')}</dt><dd>{nf(comm.fish ?? 0)}</dd></div>
                </dl>
                {commPerHour !== null && st.perHour !== null && season !== 'all' && (
                  <p className="small">{t('communityYou', { you: nf(st.perHour, 2), all: nf(commPerHour, 2) })}</p>
                )}
                {comm.recentSpecies && Object.keys(comm.recentSpecies).length > 0 && (
                  <>
                    <h3 className="sub-label">{t('recentTitle')}</h3>
                    <ul className="species-list">
                      {Object.entries(comm.recentSpecies).map(([code, n]) => (
                        <li key={code} className="row between"><span>{label(SPECIES, code, lang)}</span><span className="muted">{n}</span></li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            ) : (
              <p className="muted small">{community ? t('communityFew', { n: community.anglers }) : t('communityOffline')}</p>
            )}
          </section>
        )}

        {trips.length > 0 && (
          <section className="card contrib stack-sm">
            <h2 className="viz-title">{t('contribTitle')}</h2>
            <p className="small">{t('contribText', { days: nf(st.days), zero: nf(st.zeroDays) })}</p>
          </section>
        )}

        <h2 className="section-title">{t('allTrips')}</h2>
        {listed.slice(0, shown).map((tr) => (
          <TripCard key={tr.id} trip={tr} catches={byTrip.get(tr.id) ?? []} />
        ))}
        {listed.length > shown && (
          <button type="button" className="btn secondary" onClick={() => setShown(shown + PAGE)}>
            {t('showMore', { n: Math.min(PAGE, listed.length - shown) })}
          </button>
        )}
      </div>
      <BottomNav active="catches" />
    </main>
  );
}
