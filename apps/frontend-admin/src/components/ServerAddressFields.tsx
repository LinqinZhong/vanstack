import { Form, Input, Space } from 'antd';
import { useTranslation } from 'react-i18next';

export function ServerAddressFields() {
  const { t } = useTranslation();
  return (
    <Form.Item label={t('login.server')}>
      <Space.Compact block className="server-address">
        <Form.Item
          name="host"
          noStyle
          rules={[
            { required: true, message: t('login.serverHostInvalid') },
            {
              validator: async (_, value: string) => {
                const host = String(value ?? '').trim();
                if (!host || /^[a-z][a-z0-9+.-]*:\/\//i.test(host) || host.includes('/') || /\s/.test(host)) {
                  throw new Error(t('login.serverHostInvalid'));
                }
              },
            },
          ]}
        >
          <Input autoComplete="off" placeholder={t('login.serverHost')} />
        </Form.Item>
        <Form.Item
          name="port"
          noStyle
          rules={[
            { required: true, message: t('login.serverPortInvalid') },
            {
              validator: async (_, value: string | number) => {
                const port = Number(String(value ?? '').trim());
                if (!Number.isInteger(port) || port < 1 || port > 65535) {
                  throw new Error(t('login.serverPortInvalid'));
                }
              },
            },
          ]}
        >
          <Input autoComplete="off" inputMode="numeric" placeholder={t('login.serverPort')} className="server-port" />
        </Form.Item>
      </Space.Compact>
    </Form.Item>
  );
}
