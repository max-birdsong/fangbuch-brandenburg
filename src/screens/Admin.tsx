import { useCallback, useEffect, useState } from 'react';
import { useLang } from '../app';
import { TopBar } from '../components/ui';
import { ChartCard, Columns, DataTable, DotScale, HBars, StackedHBars } from '../components/charts';
import { loadAdminData, type AdminData } from '../lib/admin';
import { byWater, bySpecies, hoursOf, kpis, surveyMotives, surveyScales, surveyWide, weekly } from '../lib/stats';
import { downloadText, toCSV } from '../lib/util';

/** Research dashboard. Admins see all anglers; everyone else only this device's data. */
export function Admin() {
  const { lang } = useLang();
  const L = (de: string, en: string) => (lang === 'de' ? de : en);
  const [data, setData] = useState<AdminData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      setData(await loadAdminData());
    } catch (e) {
      console.warn(e);
      setErr(L('Daten konnten nicht geladen werden.', 'Could not load data.'));
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);
  useEffect(() => {
    void load();
  }, [load]);

  const nf = (v: number, d = 0) => v.toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });

  if (!data) {
    return (
      <main className="screen">
        <TopBar title={L('Auswertung', 'Dashboard')} backTo="profile" />
        <div className="content"><p className="muted">{err ?? L('Lädt …', 'Loading …')}</p></div>
      </main>
    );
  }

  const k = kpis(data);
  const weeks = weekly(data);
  const minDays = data.source === 'all' ? 3 : 1;
  const waters = byWater(data, minDays).slice(0, 12);
  const species = bySpecies(data, lang);
  const scales = surveyScales(data, lang);
  const motives = surveyMotives(data, lang);
  const fmtWeek = (w: string) => new Date(w).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short' });

  const exportTrips = () => {
    const fish = new Map<string, { n: number; kept: number }>();
    for (const c of data.catches) {
      const r = fish.get(c.tripId) ?? { n: 0, kept: 0 };
      r.n += c.count;
      if (c.kept) r.kept += c.count;
      fish.set(c.tripId, r);
    }
    downloadText('fangbuch-angeltage.csv', toCSV(data.trips.map((t) => ({
      trip_id: t.id, user_id: t.userId, water_id: t.waterId, water: t.waterName, started_at: t.startedAt, ended_at: t.endedAt,
      hours: hoursOf(t).toFixed(2), method: t.method, platform: t.platform, logged_live: t.loggedLive ? 1 : 0,
      satisfaction: t.satisfaction, n_fish: fish.get(t.id)?.n ?? 0, n_kept: fish.get(t.id)?.kept ?? 0
    }))));
  };
  const exportCatches = () => downloadText('fangbuch-faenge.csv', toCSV(data.catches.map((c) => ({ trip_id: c.tripId, species: c.species, count: c.count, length_cm: c.lengthCm, kept: c.kept ? 1 : 0 }))));
  const exportSurvey = () => downloadText('fangbuch-umfrage.csv', toCSV(surveyWide(data)));

  return (
    <main className="screen">
      <TopBar title={L('Auswertung', 'Dashboard')} backTo="profile" />
      <div className="content stack">
        <div className={`source-note ${data.source}`}>
          {data.source === 'all'
            ? <>{L('Alle Angler', 'All anglers')} · {L('Stand', 'as of')} {data.loadedAt.toLocaleTimeString(lang === 'de' ? 'de-DE' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}</>
            : L('Nur die Daten auf diesem Gerät. Als Admin angemeldet siehst du hier alle Angler.', 'Only the data on this device. Signed in as an admin you see all anglers here.')}
          <button className="btn small secondary" disabled={busy} onClick={() => void load()}>{L('Aktualisieren', 'Refresh')}</button>
        </div>
        {err && <p className="error" role="alert">{err}</p>}

        <dl className="kpis">
          <div><dt>{L('Angler', 'Anglers')}</dt><dd>{nf(k.anglers)}</dd></div>
          <div><dt>{L('Angeltage', 'Fishing days')}</dt><dd>{nf(k.days)}</dd></div>
          <div><dt>{L('Angelstunden', 'Hours fished')}</dt><dd>{nf(k.hours)}</dd></div>
          <div><dt>{L('Fische', 'Fish caught')}</dt><dd>{nf(k.fish)}</dd></div>
          <div><dt>{L('Fische pro Stunde', 'Fish per hour')}</dt><dd>{k.cpue === null ? '–' : nf(k.cpue, 2)}</dd></div>
          <div><dt>{L('Tage ohne Fang', 'Days without catch')}</dt><dd>{k.zeroPct === null ? '–' : `${k.zeroPct} %`}</dd></div>
          <div><dt>{L('Umfragen abgeschlossen', 'Surveys completed')}</dt><dd>{nf(k.surveysDone)}</dd></div>
        </dl>

        {k.days === 0 ? (
          <p className="muted">{L('Noch keine abgeschlossenen Angeltage.', 'No finished fishing days yet.')}</p>
        ) : (
          <>
            <ChartCard
              title={L('Angeltage pro Woche', 'Fishing days per week')}
              subtitle={L('Letzte 26 Wochen, nach Wochenbeginn', 'Last 26 weeks, by week start')}
              table={<DataTable head={[L('Woche ab', 'Week of'), L('Angeltage', 'Fishing days')]} rows={[...weeks].reverse().map((w) => [w.week, w.n])} />}
            >
              <Columns
                label={L('Angeltage pro Woche', 'Fishing days per week')}
                data={weeks.map((w) => ({ x: w.week, xLabel: fmtWeek(w.week), value: w.n }))}
                valueLabel={(v) => `${v} ${L('Angeltage', 'fishing days')}`}
              />
            </ChartCard>

            <ChartCard
              title={L('Fische pro Angelstunde nach Gewässer', 'Fish per angler-hour by water')}
              subtitle={L(`Gewässer mit mindestens ${minDays} Angeltag${minDays > 1 ? 'en' : ''}, höchste 12 · in Klammern: Angeltage`, `Waters with at least ${minDays} fishing day${minDays > 1 ? 's' : ''}, top 12 · in brackets: fishing days`)}
              table={<DataTable
                head={[L('Gewässer', 'Water'), L('Angeltage', 'Days'), L('Stunden', 'Hours'), L('Fische', 'Fish'), L('ohne Fang', 'no catch'), L('Fische/Std.', 'Fish/hour')]}
                rows={waters.map((w) => [w.water, w.days, w.hours.toFixed(1), w.fish, w.zero, w.rate.toFixed(2)])}
              />}
            >
              {waters.length ? (
                <HBars
                  label={L('Fische pro Angelstunde nach Gewässer', 'Fish per angler-hour by water')}
                  rows={waters.map((w) => ({
                    key: w.water, label: `${w.water} (${w.days})`, value: w.rate, valueText: nf(w.rate, 2),
                    tip: <><strong>{w.water}</strong><br />{w.days} {L('Angeltage', 'days')}, {nf(w.hours, 1)} h<br />{w.fish} {L('Fische', 'fish')}, {w.zero} {L('ohne Fang', 'without catch')}</>
                  }))}
                />
              ) : <p className="muted small">{L('Noch zu wenige Angeltage pro Gewässer.', 'Not enough fishing days per water yet.')}</p>}
            </ChartCard>

            <ChartCard
              title={L('Fänge nach Art', 'Catch by species')}
              subtitle={L('Anzahl Fische, zurückgesetzt und entnommen', 'Number of fish, released and kept')}
              table={<DataTable head={[L('Art', 'Species'), L('zurückgesetzt', 'released'), L('entnommen', 'kept'), L('gesamt', 'total')]} rows={species.map((s) => [s.label, s.released, s.kept, s.total])} />}
            >
              {species.length ? (
                <StackedHBars
                  label={L('Fänge nach Art', 'Catch by species')}
                  aName={L('zurückgesetzt', 'released')}
                  bName={L('entnommen', 'kept')}
                  rows={species.map((s) => ({ key: s.code, label: s.label, a: s.released, b: s.kept }))}
                />
              ) : <p className="muted small">{L('Noch keine Fänge.', 'No catches yet.')}</p>}
            </ChartCard>
          </>
        )}

        <ChartCard
          title={L('Umfrage: Skalen', 'Survey: scales')}
          subtitle={L(`Mittelwerte 1 bis 5, umgepolte Items berücksichtigt · ${k.surveysDone} abgeschlossen`, `Means 1 to 5, reverse-coded items flipped · ${k.surveysDone} completed`)}
          table={<DataTable head={[L('Skala', 'Scale'), L('Mittelwert', 'Mean'), 'n']} rows={scales.map((s) => [s.label, s.mean === null ? '–' : s.mean.toFixed(2), s.n])} />}
        >
          <DotScale label={L('Umfrage-Skalen', 'Survey scales')} rows={scales} lowText={L('niedrig', 'low')} highText={L('hoch', 'high')} />
        </ChartCard>

        <ChartCard
          title={L('Umfrage: Motive', 'Survey: motivations')}
          subtitle={L('Wichtigkeit 1 bis 5, sortiert', 'Importance 1 to 5, sorted')}
          table={<DataTable head={[L('Motiv', 'Motive'), L('Mittelwert', 'Mean'), 'n']} rows={motives.map((s) => [s.label, s.mean === null ? '–' : s.mean.toFixed(2), s.n])} />}
        >
          <DotScale label={L('Motive', 'Motivations')} rows={motives} lowText={L('überhaupt nicht wichtig', 'not at all important')} highText={L('extrem wichtig', 'extremely important')} />
        </ChartCard>

        <section className="card stack-sm">
          <h2 className="viz-title">{L('Daten herunterladen', 'Download data')}</h2>
          <p className="muted small">{L('CSV mit Semikolon, Angler nur als pseudonyme ID.', 'Semicolon CSV, anglers only as pseudonymous IDs.')}</p>
          <div className="row gap wrap">
            <button className="btn secondary small" onClick={exportTrips}>{L('Angeltage', 'Fishing days')}</button>
            <button className="btn secondary small" onClick={exportCatches}>{L('Fänge', 'Catches')}</button>
            <button className="btn secondary small" onClick={exportSurvey}>{L('Umfrage', 'Survey')}</button>
          </div>
        </section>
      </div>
    </main>
  );
}
