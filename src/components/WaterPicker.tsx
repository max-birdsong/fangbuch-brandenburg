import { useEffect, useMemo, useState } from 'react';
import { useLang } from '../app';
import type { WaterChoice } from '../lib/db';
import { useKV, useWaters } from '../lib/hooks';
import { autoSelectRadius, getPosition, locationPermission, nearestWaters, searchWaters, type Water } from '../lib/waters';
import { IconPin, IconSearch } from './ui';

export interface WaterValue {
  waterId: string | null;
  waterName: string;
  waterOther: string | null;
  choice: WaterChoice;
  gpsDistanceM: number | null;
}

type Geo = 'idle' | 'locating' | 'done' | 'denied';

export function WaterPicker({ value, onChange, autoLocate = true }: { value: WaterValue | null; onChange: (v: WaterValue | null) => void; autoLocate?: boolean }) {
  const { t } = useLang();
  const { file } = useWaters();
  const recentIds = useKV<string[]>('recentWaters', []);
  const [geo, setGeo] = useState<Geo>('idle');
  const [nearby, setNearby] = useState<{ water: Water; distanceM: number }[]>([]);
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const [otherMode, setOtherMode] = useState(false);
  const [otherText, setOtherText] = useState('');
  const [editing, setEditing] = useState(!value);

  const pick = (w: Water, choice: WaterChoice, gpsDistanceM: number | null = null) => {
    onChange({ waterId: w.id, waterName: w.name, waterOther: null, choice, gpsDistanceM });
    setEditing(false);
  };

  const locate = async (auto = false) => {
    if (!file) return;
    setGeo('locating');
    try {
      const pos = await getPosition();
      const near = nearestWaters(file, pos.coords.latitude, pos.coords.longitude);
      setNearby(near);
      setGeo('done');
      // Preselect only when clearly at a water and nothing chosen yet.
      if (auto && !value && near[0] && near[0].distanceM <= autoSelectRadius(file)) pick(near[0].water, 'gps', near[0].distanceM);
    } catch {
      setGeo('denied');
    }
  };

  // Locate automatically only if the angler already allowed it before (no surprise prompt).
  useEffect(() => {
    if (!file) return;
    void locationPermission().then((s) => {
      if (s === 'granted' && autoLocate) void locate(true);
      if (s === 'denied') setGeo('denied');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const recent = useMemo(
    () => (file ? recentIds.map((id) => file.waters.find((w) => w.id === id)).filter((w): w is Water => !!w) : []),
    [file, recentIds]
  );
  const results = useMemo(() => (file && query ? searchWaters(file, query) : []), [file, query]);
  const regionList = useMemo(() => (file && region ? file.waters.filter((w) => w.region === region) : []), [file, region]);

  const fmtDist = (m: number) => (m < 1000 ? t('distanceM', { m: Math.round(m / 10) * 10 }) : t('distanceKm', { km: (m / 1000).toFixed(1) }));

  if (value && !editing) {
    return (
      <div className="card selected-water">
        <div className="stack-xs">
          <span className="card-title">{value.waterOther || value.waterName}</span>
          {value.choice === 'gps' && value.gpsDistanceM !== null && (
            <span className="small teal">
              <IconPin /> {fmtDist(value.gpsDistanceM)}
            </span>
          )}
        </div>
        <button type="button" className="btn small secondary" onClick={() => setEditing(true)}>{t('change')}</button>
      </div>
    );
  }

  const WaterBtn = ({ w, choice, dist }: { w: Water; choice: WaterChoice; dist?: number }) => (
    <button type="button" className={`option ${value?.waterId === w.id ? 'on' : ''}`} onClick={() => pick(w, choice, dist ?? null)}>
      <span className="option-title">{w.name}</span>
      <span className="option-sub">{dist !== undefined ? `${fmtDist(dist)} · ${w.region}` : w.region}</span>
    </button>
  );

  return (
    <div className="stack">
      {/* Location */}
      {geo === 'idle' && (
        <div className="stack-xs">
          <button type="button" className="btn secondary" onClick={() => void locate(false)} disabled={!file}>
            <IconPin /> {t('useLocation')}
          </button>
          <p className="hint">{t('locationWhy')}</p>
        </div>
      )}
      {geo === 'locating' && <p className="hint" aria-live="polite">{t('locating')}</p>}
      {geo === 'denied' && <p className="hint">{t('locationDenied')}</p>}
      {geo === 'done' && (
        <div className="stack-sm">
          <h3 className="sub-label">{t('nearby')}</h3>
          {nearby.length === 0 && <p className="hint">{t('nothingNearby')}</p>}
          {nearby.map(({ water, distanceM }) => (
            <WaterBtn key={water.id} w={water} choice="gps" dist={distanceM} />
          ))}
        </div>
      )}

      {/* Recent */}
      {recent.length > 0 && (
        <div className="stack-sm">
          <h3 className="sub-label">{t('recent')}</h3>
          {recent.map((w) => (
            <WaterBtn key={w.id} w={w} choice="recent" />
          ))}
        </div>
      )}

      {/* Search */}
      <label className="search">
        <IconSearch />
        <span className="sr-only">{t('searchWater')}</span>
        <input type="search" placeholder={t('searchWater')} value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {query && (
        <div className="stack-sm">
          {results.length === 0 && <p className="hint">{t('noResults')}</p>}
          {results.map((w) => (
            <WaterBtn key={w.id} w={w} choice="search" />
          ))}
        </div>
      )}

      {/* By region */}
      {file && (
        <label className="input-label">
          {t('byRegion')}
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">{t('chooseRegion')}</option>
            {file.regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
      )}
      {region && (
        <div className="stack-sm">
          {regionList.map((w) => (
            <WaterBtn key={w.id} w={w} choice="manual" />
          ))}
        </div>
      )}

      {/* Not in list */}
      {!otherMode ? (
        <button type="button" className="link-btn" onClick={() => setOtherMode(true)}>{t('otherWater')}</button>
      ) : (
        <div className="row gap">
          <label className="input-label grow">
            {t('otherWaterName')}
            <input maxLength={200} value={otherText} onChange={(e) => setOtherText(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn small primary self-end"
            disabled={otherText.trim().length < 2}
            onClick={() => {
              onChange({ waterId: null, waterName: otherText.trim(), waterOther: otherText.trim(), choice: 'other', gpsDistanceM: null });
              setEditing(false);
            }}
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}
