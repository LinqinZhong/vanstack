import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AuthSessionDto } from '@vanstack/shared';
import { api } from '../apis/api';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { ServerAddressFields } from '../components/ServerAddressFields';
import {
  getServerConfig,
  isDesktopShell,
  loadServerConfig,
  parseServerConfig,
  saveServerConfig,
} from '../apis/serverConfig';

type LoginFormValues = {
  host?: string;
  port?: string;
  username: string;
  password: string;
};

type LoginPageProps = {
  onLoggedIn: (session: AuthSessionDto) => void;
};

export function LoginPage({ onLoggedIn }: LoginPageProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<LoginFormValues>();
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const desktop = isDesktopShell();
  const server = getServerConfig();

  useEffect(() => {
    if (!desktop) {
      return;
    }
    void loadServerConfig().then((next) => {
      form.setFieldsValue({ host: next.host, port: String(next.port) });
    });
  }, [desktop, form]);

  async function submit(values: LoginFormValues) {
    setPending(true);
    setError(false);
    try {
      if (desktop) {
        await saveServerConfig(parseServerConfig(values.host ?? '', values.port ?? ''));
      }
      const session = await api.login({ username: values.username, password: values.password });
      onLoggedIn(session);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="login-shell">
      <Card className="login-panel">
        <Typography.Title level={2} style={{ marginTop: 0, fontFamily: 'Fraunces, Georgia, serif' }}>
          {t('app.name')}
        </Typography.Title>
        <Typography.Paragraph type="secondary">{t('login.subtitle')}</Typography.Paragraph>
        <div className="login-lang">
          <LanguageSwitch />
        </div>
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => void submit(values)}
          requiredMark={false}
          initialValues={desktop ? { host: server.host, port: String(server.port) } : undefined}
        >
          {desktop ? <ServerAddressFields /> : null}
          <Form.Item
            label={t('login.username')}
            name="username"
            rules={[{ required: true, message: t('login.username') }]}
          >
            <Input autoComplete="username" size="large" prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item
            label={t('login.password')}
            name="password"
            rules={[{ required: true, message: t('login.password') }]}
          >
            <Input.Password autoComplete="current-password" size="large" prefix={<LockOutlined />} />
          </Form.Item>
          {error ? <Alert type="error" showIcon message={t('login.failed')} style={{ marginBottom: 16 }} /> : null}
          <Button type="primary" htmlType="submit" loading={pending} block size="large">
            {pending ? t('login.submitting') : t('login.submit')}
          </Button>
        </Form>
      </Card>
    </div>
  );
}
