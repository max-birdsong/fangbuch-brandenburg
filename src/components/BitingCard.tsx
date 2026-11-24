import { useLang } from '../app';
import { SPECIES, label } from '../data/catalog';
import { monthToShow, perHour, type WaterStats } from '../lib/biting';
import { localWaterName } from '../lib/waterNames';

/**
 * "Was gerade beißt": fish per hour and top species per water this month, from all participants.
 * compact: the Home version (top 3 waters, hidden when there is nothing to show).
 */
export function BitingCard({ stats, compact = false }: { stats: WaterStats | null | undefined; compact?: boolean }) {
  const { t, lang } = useLang();
  const loc = lang === 'en' ? 'en-GB' : lang === 'pl' ? 'pl-PL' : 'de-DE';
  const shown = monthToShow(stats ?? null);
  if (stats === undefined) return null;
  if (!shown && compact) return null;
  const monthName = shown ? new Date(2026, shown.month - 1, 1).toLocaleDateString(loc, { month: 'long' }) : '';
  const rows = shown ? (compact ? shown.rows.slice(0, 3) : shown.rows) : [];
  const nf = (v: number) => v.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const waterName = (w: { waterId: string; water: string }) => (w.waterId === 'oder' ? t('oderAll') : localWaterName(w.water, lang));

  return (
    <section className="card stack-sm biting" aria-labelledby={compact ? 'biting-home' : 'biting-stats'}>
      <div className="row between baseline gap">
        <h2 id={compact ? 'biting-home' : 'biting-stats'} className="viz-title">{t('bitingTitle')}</h2>
        {stats?.example && <span className="badge-example">{t('exampleData')}</span>}
      </div>
      {shown ? (
        <>
          <p className="muted small">{t('bitingSub', { month: monthName })}</p>
          <ul className="biting-list">
            {rows.map((w) => {
              const top = Object.entries(w.species).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([sp]) => label(SPECIES, sp, lang));
              return (
                <li key={w.waterId}>
                  <div className="row between baseline gap">
                    <span className="strong">{waterName(w)}</span>
                    <span className="biting-rate">{nf(perHour(w))}<span className="muted small"> {t('perHourUnit')}</span></span>
                  </div>
                  <span className="muted small">{top.join(', ')} · {t('bitingAnglers', { n: w.anglers })}</span>
                </li>
              );
            })}
          </ul>
          {compact && shown.rows.length > rows.length && <a className="link-btn" href="#/catches">{t('bitingMore')}</a>}
        </>
      ) : (
        <p className="muted small">{t('bitingEmpty')}</p>
      )}
    </section>
  );
}
