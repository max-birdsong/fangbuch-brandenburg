import { useLang } from '../app';
import { TopBar } from '../components/ui';

export function Privacy() {
  const { t } = useLang();
  return (
    <main className="screen">
      <TopBar title={t('privacyTitle')} />
      <div className="content stack">
        <p className="draft-note">{t('privacyDraft')}</p>
        {t('privacyBody').split('\n\n').map((para, i) => (
          <p key={i}>{para}</p>
        ))}
        <p className="muted small">{t('osm')}</p>
      </div>
    </main>
  );
}
