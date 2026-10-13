import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang } from './data/catalog';
import { translate, type StringKey } from './i18n';
import { getKV, setKV } from './lib/db';

// ------------------------------------------------------------ routing (hash based, works offline)
export function useRoute(): string[] {
  const parse = () => (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
  const [parts, setParts] = useState(parse);
  useEffect(() => {
    const on = () => {
      setParts(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return parts;
}
export const go = (path: string, replace = false) => {
  const h = `#/${path.replace(/^\//, '')}`;
  if (replace) location.replace(h);
  else location.hash = h;
};
export const back = (fallback = '') => {
  if (history.length > 1) history.back();
  else go(fallback, true);
};

// ------------------------------------------------------------ language
type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: StringKey, v?: Record<string, string | number>) => string };
const LangCtx = createContext<Ctx>(null as unknown as Ctx);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('de');
  useEffect(() => {
    void getKV<Lang>('lang', 'de').then(setLangState);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    void setKV('lang', l);
  }, []);
  const value = useMemo<Ctx>(() => ({ lang, setLang, t: (k, v) => translate(lang, k, v) }), [lang, setLang]);
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}
export const useLang = () => useContext(LangCtx);

// ------------------------------------------------------------ confirm dialog (no blocking browser dialogs)
type ConfirmReq = { text: string; okLabel: string; danger?: boolean; resolve: (ok: boolean) => void };
const ConfirmCtx = createContext<(text: string, okLabel: string, danger?: boolean) => Promise<boolean>>(
  async () => false
);
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<ConfirmReq | null>(null);
  const { t } = useLang();
  const ask = useCallback(
    (text: string, okLabel: string, danger = false) =>
      new Promise<boolean>((resolve) => setReq({ text, okLabel, danger, resolve })),
    []
  );
  const close = (ok: boolean) => {
    req?.resolve(ok);
    setReq(null);
  };
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {req && (
        <div className="modal-backdrop" role="presentation" onClick={() => close(false)}>
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-text" onClick={(e) => e.stopPropagation()}>
            <p id="confirm-text">{req.text}</p>
            <div className="row gap">
              <button className="btn secondary grow" onClick={() => close(false)}>{t('cancel')}</button>
              <button className={`btn grow ${req.danger ? 'danger' : 'primary'}`} onClick={() => close(true)} autoFocus>
                {req.okLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}
export const useConfirm = () => useContext(ConfirmCtx);
