import { useLang } from '../app';
import { SPECIES, label } from '../data/catalog';
import type { Catch } from '../lib/db';
import { fmtTime } from '../lib/util';

export function CatchRow({ c, href, showTime = true }: { c: Catch; href?: string; showTime?: boolean }) {
  const { t, lang } = useLang();
  const name = label(SPECIES, c.species, lang);
  const title = `${c.count > 1 ? `${c.count} × ` : ''}${name}${c.lengthCm ? ` · ${c.lengthCm} cm` : ''}`;
  const body = (
    <>
      <span className="stack-xs">
        <span className="card-title">{title}</span>
        {showTime && c.caughtAt && <span className="muted small">{fmtTime(c.caughtAt, lang)}</span>}
      </span>
      <span className={`tag ${c.kept ? 'kept' : 'released'}`}>{c.kept ? t('tagKept') : t('tagReleased')}</span>
    </>
  );
  return href ? (
    <a className="card catch-row" href={href}>{body}</a>
  ) : (
    <div className="card catch-row">{body}</div>
  );
}
