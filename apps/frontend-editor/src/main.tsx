import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import App from './App';
import { AntdProvider } from './components/AntdProvider';
import './styles/global.less';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AntdProvider>
      <App />
    </AntdProvider>
  </StrictMode>,
);
