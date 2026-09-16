import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AuthSessionDto } from '@vanstack/shared';
import { api } from './api';
import { LanguageSwitch } from './LanguageSwitch';

type LoginFormValues = {
  username: string;
  password: string;
};

type LoginPageProps = {
  onLoggedIn: (session: AuthSessionDto) => void;
};

export function LoginPage({ onLoggedIn }: LoginPageProps) {
  const { t } = useTranslation();
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(values: LoginFormValues) {
    setPending(true);
    setError(false);
    try {
      const session = await api.login(values);
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
        <Form layout="vertical" onFinish={(values) => void submit(values)} requiredMark={false}>
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
