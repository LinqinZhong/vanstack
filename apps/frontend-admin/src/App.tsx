import { LogoutOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Button, Layout, Menu, Spin, Tag, Typography } from 'antd';
import type { AuthSessionDto, AuthUserDto } from '@vanstack/shared';
import { api } from './api';
import { LanguageSwitch } from './LanguageSwitch';
import { LoginPage } from './LoginPage';
import { PreviewPage } from './PreviewPage';
import { ProjectEditorPage } from './ProjectEditorPage';
import { ProjectHomePage } from './ProjectHomePage';
import { clearAccessToken, getAccessToken, setAccessToken, UNAUTHORIZED_EVENT } from './session';

function isEditableElement(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('input, textarea, [contenteditable="true"]'));
}

function preventNonInputSelection(event: Event) {
  if (!isEditableElement(event.target)) {
    event.preventDefault();
  }
}

export default function App() {
  const [user, setUser] = useState<AuthUserDto | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    document.addEventListener('selectstart', preventNonInputSelection);
    document.addEventListener('copy', preventNonInputSelection);
    document.addEventListener('cut', preventNonInputSelection);
    document.addEventListener('dragstart', preventNonInputSelection);
    return () => {
      document.removeEventListener('selectstart', preventNonInputSelection);
      document.removeEventListener('copy', preventNonInputSelection);
      document.removeEventListener('cut', preventNonInputSelection);
      document.removeEventListener('dragstart', preventNonInputSelection);
    };
  }, []);

  useEffect(() => {
    function onUnauthorized() {
      setUser(null);
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setBooting(false);
      return;
    }

    void api
      .me()
      .then((profile) => setUser(profile))
      .catch(() => {
        clearAccessToken();
        setUser(null);
      })
      .finally(() => setBooting(false));
  }, []);

  function handleLoggedIn(session: AuthSessionDto) {
    setAccessToken(session.accessToken);
    setUser(session.user);
  }

  function logout() {
    clearAccessToken();
    setUser(null);
  }

  if (booting) {
    return <BootScreen />;
  }
  if (!user) {
    return <LoginPage onLoggedIn={handleLoggedIn} />;
  }
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/preview" element={<PreviewPage />} />
        <Route path="*" element={<Workspace user={user} onLogout={logout} />} />
      </Routes>
    </BrowserRouter>
  );
}

function BootScreen() {
  const { t } = useTranslation();
  return (
    <div className="login-shell">
      <Spin size="large" tip={t('login.checking')}>
        <div style={{ minHeight: 120 }} />
      </Spin>
    </div>
  );
}

function Workspace({ user, onLogout }: { user: AuthUserDto; onLogout: () => void }) {
  const { t } = useTranslation();
  const location = useLocation();
  const [online, setOnline] = useState(false);

  useEffect(() => {
    void api
      .health()
      .then((health) => setOnline(health.ok))
      .catch(() => setOnline(false));
  }, []);

  const selected = location.pathname.startsWith('/projects/') ? 'overview' : 'overview';
  const inProject = location.pathname.startsWith('/projects/');

  return (
    <Layout className="app-shell">
      {inProject ? null : (
        <Layout.Sider width={260} theme="dark" className="sidebar">
          <Typography.Title level={3} className="brand">
            {t('app.name')}
          </Typography.Title>
          <Typography.Paragraph type="secondary">{t('app.tagline')}</Typography.Paragraph>
          <Typography.Text type="success">{user.username}</Typography.Text>
          <div className="sider-block">
            <LanguageSwitch />
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[selected]}
            items={[
              { key: 'overview', label: <Link to="/">{t('nav.overview')}</Link> },
              {
                key: 'app',
                label: (
                  <a href="http://127.0.0.1:5173" rel="noreferrer">
                    {t('nav.app')}
                  </a>
                ),
              },
            ]}
          />
          <Button className="logout" icon={<LogoutOutlined />} onClick={onLogout} block>
            {t('actions.logout')}
          </Button>
          <Tag color={online ? 'success' : 'default'}>{online ? t('status.online') : t('status.offline')}</Tag>
        </Layout.Sider>
      )}
      <Layout.Content className={inProject ? 'workspace workspace-fill' : 'workspace'}>
        <Routes>
          <Route path="/" element={<ProjectHomePage />} />
          <Route path="/projects/:id" element={<ProjectEditorPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout.Content>
    </Layout>
  );
}
