import { useLang } from '../app';
import { METHODS, SPECIES, label } from '../data/catalog';
import type { Catch, Trip } from '../lib/db';
import { fmtDateShort, fmtTime } from '../lib/util';

export function TripCard({ trip, catches }: { trip: Trip; catches: Catch[] }) {
  const { t, lang } = useLang();
  const n = catches.reduce((s, c) => s + c.count, 0);
  const species = [...new Set(catches.map((c) => label(SPECIES, c.species, lang)))].join(', ');
  const time = `${fmtTime(trip.startedAt, lang)}${trip.endedAt ? `–${fmtTime(trip.endedAt, lang)}` : ''}`;
  return (
    <a className="card trip-card" href={`#/trip/${trip.id}`}>
      <div className="row between gap">
        <span className="card-title">{trip.waterOther || trip.waterName}</span>
        <span className="muted nowrap">{fmtDateShort(trip.startedAt, lang)}</span>
      </div>
      <div className="muted">
        {time}
        {trip.method ? ` · ${label(METHODS, trip.method, lang)}` : ''}
      </div>
      <div className={n ? 'strong teal' : 'strong amber'}>
        {n ? `${t(n === 1 ? 'nFish' : 'nFishPl', { n })}: ${species}` : t('noCatch')}
      </div>
    </a>
  );
}
