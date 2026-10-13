import { useLang } from '../app';
import type { Lang } from '../data/catalog';

const LANGS: [Lang, string, string][] = [
  ['de', 'DE', 'Deutsch'],
  ['en', 'EN', 'English']
];

export function LangSwitch({ dark }: { dark?: boolean }) {
  const { lang, setLang, t } = useLang();
  return (
    <div className={`langswitch ${dark ? 'dark' : ''}`} role="radiogroup" aria-label={t('language')}>
      {LANGS.map(([code, short, name]) => (
        <button key={code} role="radio" aria-checked={lang === code} aria-label={name} className={lang === code ? 'on' : ''} onClick={() => setLang(code)}>
          {short}
        </button>
      ))}
    </div>
  );
}
