import { Segmented } from 'antd';
import { useTranslation } from 'react-i18next';
import { LOCALES, type Locale } from '@vanstack/shared';
import { localeLabel } from '../apis/api';

export function LanguageSwitch() {
  const { i18n } = useTranslation();
  const current = (LOCALES.find((locale) => i18n.language.startsWith(locale)) ?? 'zh') as Locale;

  return (
    <Segmented
      size="small"
      value={current}
      options={LOCALES.map((locale) => ({ label: localeLabel[locale], value: locale }))}
      onChange={(value) => void i18n.changeLanguage(String(value))}
    />
  );
}
