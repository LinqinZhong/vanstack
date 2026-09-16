import { useTranslation } from 'react-i18next';
import { LOCALES, type Locale } from '@vanstack/shared';

const localeLabel: Record<Locale, string> = {
  zh: '中文',
  en: 'English',
};

export default function App() {
  const { t, i18n } = useTranslation();
  const current = LOCALES.find((locale) => i18n.language.startsWith(locale)) ?? 'zh';

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
      <main className="h5-body" />
    </div>
  );
}
