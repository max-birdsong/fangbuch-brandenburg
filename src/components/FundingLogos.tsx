import { useState } from 'react';
import { useLang } from '../app';

// The Interreg logo (required on project materials). The official file goes to public/logos/
// (see the README there); until it exists, a text line is shown instead.
const LOGO = `${import.meta.env.BASE_URL}logos/interreg.svg`;

export function FundingLogos({ dark = false }: { dark?: boolean }) {
  const { t } = useLang();
  const [missing, setMissing] = useState(false);
  return (
    <div className={`funding ${dark ? 'on-dark' : ''}`}>
      {!missing && <img src={LOGO} alt={t('fundingAlt')} onError={() => setMissing(true)} />}
      <p className="funding-text">{t('fundingText')}</p>
    </div>
  );
}
