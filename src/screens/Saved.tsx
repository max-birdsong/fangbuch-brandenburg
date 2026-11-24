import { useLang } from '../app';
import { SPECIES, label } from '../data/catalog';
import { perHour, rowFor, useWaterStats } from '../lib/biting';
import { useCatches, useTrips } from '../lib/hooks';
import { dayHighlights } from '../lib/personalStats';
import { localWaterName } from '../lib/waterNames';

/**
 * Shown right after a new fishing day is saved: what this day added. The point is that every entry
 * gives something back straight away (a number, a new species, a record, a comparison).
 */
export function Saved({ tripId }: { tripId: string }) {
  const { t, lang } = useLang();
  const trips = useTrips();
  const catches = useCatches();
  const water = useWaterStats();
  if (!trips || !catches) return <main className="screen" />;
  const h = dayHighlights(trips, catches, tripId, SPECIES.map((s) => s.code));
  if (!h) {
    location.hash = '#/';
    return null;
  }
  const loc = lang === 'en' ? 'en-GB' : lang === 'pl' ? 'pl-PL' : 'de-DE';
  const nf = (v: number, d = 0) => v.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const sp = (code: string) => label(SPECIES, code, lang);
  const month = new Date(h.trip.startedAt).getMonth() + 1;
  const cmp = rowFor(water ?? null, h.trip.waterId, month);
  const monthName = new Date(h.trip.startedAt).toLocaleDateString(loc, { month: 'long' });
  const cmpName = cmp ? (cmp.waterId === 'oder' ? t('oderAll') : localWaterName(cmp.water, lang)) : '';
  const yours = h.hours > 0 ? h.fish / h.hours : null;

  return (
    <main className="screen saved">
      <div className="content stack">
        <div className="saved-head">
          <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
            <circle cx="28" cy="28" r="28" fill="#DCEDEF" />
            <path d="M17 29l7 7 15-16" fill="none" stroke="#1F7A8C" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h1>{t('savedTitle')}</h1>
          <p className="saved-no">{t('savedDayNo', { n: h.dayNo, year: h.year })}</p>
        </div>

        <ul className="saved-list">
          {h.newSpecies.map((s) => (
            <li key={`n-${s}`} className="saved-item new">
              <span className="saved-tag">{t('savedNewSpeciesTag')}</span>
              <span>{t('savedNewSpecies', { species: sp(s), n: h.collectionSize, total: h.collectionTotal })}</span>
            </li>
          ))}
          {h.records.map((r) => (
            <li key={`r-${r.species}`} className="saved-item record">
              <span className="saved-tag">{t('savedRecordTag')}</span>
              <span>{t('savedRecord', { species: sp(r.species), cm: nf(r.cm, r.cm % 1 ? 1 : 0), prev: nf(r.previous, r.previous % 1 ? 1 : 0) })}</span>
            </li>
          ))}
          {h.fish === 0 && (
            <li className="saved-item">
              <span>{t('savedZero')}</span>
            </li>
          )}
          {cmp && (
            <li className="saved-item compare">
              <span className="saved-tag">{water?.example ? t('exampleData') : t('savedAllTag')}</span>
              <span>
                {t('savedCompare', { water: cmpName, month: monthName, all: nf(perHour(cmp), 2), n: cmp.anglers })}
                {yours !== null && h.fish > 0 && <> {t('savedCompareYou', { you: nf(yours, 2) })}</>}
              </span>
            </li>
          )}
          <li className="saved-item">
            <span>{t('savedThanks')}</span>
          </li>
        </ul>
      </div>
      <footer className="actionbar stack-sm">
        <a className="btn primary big" href="#/">{t('savedDone')}</a>
        <a className="btn secondary" href="#/catches">{t('savedStats')}</a>
      </footer>
    </main>
  );
}
