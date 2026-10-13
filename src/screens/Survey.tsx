import { useEffect, useState } from 'react';
import { go, useLang } from '../app';
import { TopBar } from '../components/ui';
import { SCALES, SURVEY, type Item } from '../data/survey';
import { getSurvey, patchSurvey, saveSurvey, type SurveyAnswer, type SurveyResponse } from '../lib/db';
import { useSurvey } from '../lib/hooks';
import { scheduleSync } from '../lib/sync';
import { uuid } from '../lib/util';

/** Creates the local response record the first time the survey is opened. */
async function ensureResponse(): Promise<SurveyResponse> {
  const existing = await getSurvey(SURVEY.id);
  if (existing) return existing;
  const r: SurveyResponse = {
    id: uuid(),
    surveyId: SURVEY.id,
    version: SURVEY.version,
    answers: {},
    page: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
    snoozedUntil: null,
    dirty: 1,
    updatedAt: Date.now()
  };
  await saveSurvey(r);
  return r;
}

export function Survey() {
  const { t, lang } = useLang();
  const resp = useSurvey();
  const [page, setPage] = useState<number | null>(null);

  useEffect(() => {
    void ensureResponse().then((r) => setPage(r.completedAt ? 0 : Math.min(r.page, SURVEY.sections.length - 1)));
  }, []);

  if (!resp || page === null) return <main className="screen" />;

  const total = SURVEY.sections.length;
  const section = SURVEY.sections[page];
  const last = page === total - 1;

  const setAnswer = (id: string, value: SurveyAnswer | null) => {
    void patchSurvey(SURVEY.id, (r) => {
      const answers = { ...r.answers };
      if (value === null || value === '') delete answers[id];
      else answers[id] = value;
      return { ...r, answers };
    });
    scheduleSync(4000);
  };

  const goPage = async (n: number) => {
    await patchSurvey(SURVEY.id, (r) => ({ ...r, page: n }));
    setPage(n);
    window.scrollTo(0, 0);
  };

  const finish = async () => {
    await patchSurvey(SURVEY.id, (r) => ({ ...r, page: 0, completedAt: r.completedAt ?? new Date().toISOString() }));
    scheduleSync(300);
    go('survey/thanks', true);
  };

  return (
    <main className="screen">
      <TopBar title={t('surveyTitle')} onBack={() => (page > 0 ? void goPage(page - 1) : go('', true))} />
      <div className="progress" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={page + 1} aria-label={t('surveyStep', { n: page + 1, total })}>
        <span style={{ width: `${((page + 1) / total) * 100}%` }} />
      </div>
      <div className="content stack-lg">
        <div className="stack-xs">
          <p className="small muted strong">{t('surveyStep', { n: page + 1, total })}</p>
          <h1 className="h2">{section.title[lang]}</h1>
          {section.intro && <p className="muted">{section.intro[lang]}</p>}
          {page === 0 && <p className="hint">{t('surveySkipHint')}</p>}
        </div>
        {section.items.map((item) => (
          <Question key={item.id} item={item} value={resp.answers[item.id]} onChange={(v) => setAnswer(item.id, v)} />
        ))}
      </div>
      <footer className="actionbar">
        <button className="btn primary big" onClick={() => void (last ? finish() : goPage(page + 1))}>
          {last ? t('surveyFinish') : t('surveyNext')}
        </button>
      </footer>
    </main>
  );
}

function Question({ item, value, onChange }: { item: Item; value: SurveyAnswer | undefined; onChange: (v: SurveyAnswer | null) => void }) {
  const { t, lang } = useLang();
  const labelId = `q-${item.id}`;

  if (item.type === 'likert') {
    const pts = SCALES[item.scale].points;
    const sel = typeof value === 'number' ? value : null;
    return (
      <section className="question">
        <h2 id={labelId} className="q-text">{item.text[lang]}</h2>
        <div className="likert" role="radiogroup" aria-labelledby={labelId}>
          {pts.map((p, i) => {
            const n = i + 1;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={sel === n}
                aria-label={`${n}: ${p[lang]}`}
                title={p[lang]}
                className={`chip likert-btn ${sel === n ? 'on' : ''}`}
                onClick={() => onChange(sel === n ? null : n)}
              >
                {n}
              </button>
            );
          })}
        </div>
        <div className="row between small muted likert-ends">
          <span>{pts[0][lang]}</span>
          <span className="right">{pts[pts.length - 1][lang]}</span>
        </div>
        {sel !== null && <p className="small teal strong">{pts[sel - 1][lang]}</p>}
      </section>
    );
  }

  if (item.type === 'single') {
    return (
      <section className="question">
        <h2 id={labelId} className="q-text">{item.text[lang]}</h2>
        <div className="chips" role="radiogroup" aria-labelledby={labelId}>
          {item.options.map((o) => (
            <button key={o.code} type="button" role="radio" aria-checked={value === o.code} className={`chip ${value === o.code ? 'on' : ''}`} onClick={() => onChange(value === o.code ? null : o.code)}>
              {o.label[lang]}
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (item.type === 'year') {
    const years: number[] = [];
    for (let y = item.max; y >= item.min; y--) years.push(y);
    return (
      <section className="question">
        <label className="stack-sm">
          <span className="q-text">{item.text[lang]}</span>
          <select value={typeof value === 'number' ? value : ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{t('pleaseChoose')}</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
      </section>
    );
  }

  // number
  return (
    <section className="question">
      <label className="stack-sm">
        <span className="q-text">{item.text[lang]}</span>
        <span className="row gap">
          <input
            className="num-input"
            type="number"
            inputMode="numeric"
            min={item.min}
            max={item.max}
            value={typeof value === 'number' ? value : ''}
            onChange={(e) => {
              if (e.target.value === '') return onChange(null);
              const n = Math.round(Number(e.target.value));
              if (!Number.isNaN(n)) onChange(Math.max(item.min, Math.min(item.max, n)));
            }}
          />
          {item.unit && <span className="muted">{item.unit[lang]}</span>}
        </span>
      </label>
    </section>
  );
}

export function SurveyThanks() {
  const { t } = useLang();
  return (
    <main className="screen">
      <div className="content stack-lg pad-top">
        <div className="stack-xs">
          <p className="small strong green">{t('surveyDone')}</p>
          <h1 className="h1">{t('surveyThanksTitle')}</h1>
          <p className="muted">{t('surveyThanksText')}</p>
        </div>
      </div>
      <footer className="actionbar">
        <button className="btn primary big" onClick={() => go('', true)}>{t('done')}</button>
      </footer>
    </main>
  );
}
