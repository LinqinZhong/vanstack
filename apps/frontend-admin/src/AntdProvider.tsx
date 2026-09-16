import type { PropsWithChildren } from 'react';
import { App as AntdApp, ConfigProvider, theme } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import { useTranslation } from 'react-i18next';

export function AntdProvider({ children }: PropsWithChildren) {
  const { i18n } = useTranslation();
  const locale = i18n.language.startsWith('en') ? enUS : zhCN;

  return (
    <ConfigProvider
      locale={locale}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#3dba9a',
          colorInfo: '#3dba9a',
          colorBgLayout: '#0d1318',
          borderRadius: 10,
          fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
        },
      }}
    >
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  );
}
