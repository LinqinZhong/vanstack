import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LOCALES, type Locale } from '@vanstack/shared';
import { renderPageXml } from '@vanstack/lowcode-runtime';

const localeLabel: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
};

const DEMO_PAGE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<page>
  <flex id="f1" flex-direction="row" justify-content="space-between" gap="8">
    <text id="t1" value="左" />
    <button id="b1" text="右" />
  </flex>
</page>`;

export default function App() {
  const { t, i18n } = useTranslation();
  const current = LOCALES.find((locale) => i18n.language.startsWith(locale)) ?? 'zh';
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mountRef.current) {
      renderPageXml(mountRef.current, DEMO_PAGE_XML);
    }
  }, []);

  return (
    <div className="h5-frame">
      <header className="h5-bar">
        <h1>{t('app.name')}</h1>
        <div className="lang-switch">
          {LOCALES.map((locale) => (
            <button
              key={locale}
              className={locale === current ? 'active' : ''}
              onClick={() => void i18n.changeLanguage(locale)}
              type="button"
            >
              {localeLabel[locale]}
            </button>
          ))}
        </div>
      </header>
      <main className="h5-body">
        <p className="h5-hint">{t('runtime.hint')}</p>
        <div ref={mountRef} className="h5-runtime" />
      </main>
    </div>
  );
}
