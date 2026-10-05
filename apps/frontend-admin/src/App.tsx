import { LogoutOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Button, Layout, Menu, Spin, Tag, Typography } from 'antd';
import type { AuthSessionDto, AuthUserDto } from '@vanstack/shared';
import { api } from './apis/api';
import { LanguageSwitch } from './components/LanguageSwitch';
import { LoginPage } from './views/LoginPage';
import { PreviewPage } from './views/PreviewPage';
import { ProjectEditorPage } from './views/ProjectEditorPage';
import { ProjectHomePage } from './views/ProjectHomePage';
import { h5Url, localeFromI18n } from './utils/h5';
import { loadServerConfig } from './apis/serverConfig';
import { clearAccessToken, getAccessToken, setAccessToken, UNAUTHORIZED_EVENT } from './apis/session';

function isEditableElement(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('input, textarea, [contenteditable="true"]'));
}

function isExplicitDragHandle(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(target.closest('[draggable="true"], .ant-tree-treenode-draggable'))
  );
}

function preventNonInputSelection(event: Event) {
  if (event.type === 'dragstart' && isExplicitDragHandle(event.target)) {
    return;
  }
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
    let cancelled = false;
    void loadServerConfig().then(() => {
      if (cancelled) {
        return;
      }
      const token = getAccessToken();
      if (!token) {
        setBooting(false);
        return;
      }

      void api
        .me()
        .then((profile) => {
          if (!cancelled) {
            setUser(profile);
          }
        })
        .catch(() => {
          clearAccessToken();
          if (!cancelled) {
            setUser(null);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setBooting(false);
          }
        });
    });
    return () => {
      cancelled = true;
    };
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
      <Spin size="large" description={t('login.checking')}>
        <div style={{ minHeight: 120 }} />
      </Spin>
    </div>
  );
}

function Workspace({ user, onLogout }: { user: AuthUserDto; onLogout: () => void }) {
  const { t, i18n } = useTranslation();
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
        <Layout.Sider width={260} theme="light" className="sidebar">
          <Typography.Title level={3} className="brand">
            {t('app.name')}
          </Typography.Title>
          <Typography.Paragraph type="secondary">{t('app.tagline')}</Typography.Paragraph>
          <Typography.Text type="success">{user.username}</Typography.Text>
          <div className="sider-block">
            <LanguageSwitch />
          </div>
          <Menu
            theme="light"
            mode="inline"
            selectedKeys={[selected]}
            items={[
              { key: 'overview', label: <Link to="/">{t('nav.overview')}</Link> },
              {
                key: 'app',
                label: (
                  <a
                    href={h5Url({ lang: localeFromI18n(i18n.resolvedLanguage ?? i18n.language) })}
                    rel="noreferrer"
                  >
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
