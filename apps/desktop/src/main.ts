import { app, BrowserWindow, ipcMain } from 'electron';
import type http from 'node:http';
import { existsSync } from 'node:fs';
import {
  checkNode,
  isBackendHealthy,
  resolveNodeExecutable,
  spawnBackend,
  stopBackend,
  waitForHealth,
} from './backend';
import { errorPageHtml, startingPageHtml } from './error-page';
import { listenStatic, setBackendOrigin, getBackendOrigin } from './host';
import {
  ADMIN_ORIGIN,
  ADMIN_PORT,
  APP_ORIGIN,
  APP_PORT,
  LOOPBACK,
  adminDist,
  appDist,
  isDevMode,
  preloadPath,
} from './paths';
import { isLoopbackHost, loadServer, saveServer, serverOrigin } from './server-store';

const devMode = isDevMode();
let mainWindow: BrowserWindow | undefined;
let backendProcess: ReturnType<typeof spawnBackend> | undefined;
const servers: http.Server[] = [];

function windowPrefs() {
  return {
    preload: preloadPath(),
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
  };
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    webPreferences: windowPrefs(),
    show: false,
  });
  win.once('ready-to-show', () => win.show());
  return win;
}

function openH5Window(url: string): void {
  const child = new BrowserWindow({
    width: 420,
    height: 800,
    webPreferences: windowPrefs(),
  });
  void child.loadURL(url);
}

function isOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

function isAllowedNavigation(url: string): boolean {
  if (url.startsWith('data:text/html')) {
    return true;
  }
  return isOrigin(url, ADMIN_ORIGIN) || isOrigin(url, APP_ORIGIN) || isOrigin(url, getBackendOrigin());
}

function attachNavigationGuards(): void {
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (isOrigin(url, APP_ORIGIN)) {
        openH5Window(url);
        return { action: 'deny' };
      }
      if (isAllowedNavigation(url)) {
        return { action: 'allow', overrideBrowserWindowOptions: { webPreferences: windowPrefs() } };
      }
      return { action: 'deny' };
    });
    contents.on('will-navigate', (event, url) => {
      if (contents === mainWindow?.webContents && isOrigin(url, APP_ORIGIN)) {
        event.preventDefault();
        openH5Window(url);
        return;
      }
      if (!isAllowedNavigation(url)) {
        event.preventDefault();
      }
    });
  });
}

function showHtml(html: string): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow();
  }
  void mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

let showingError = false;

function showError(message: string): void {
  showingError = true;
  showHtml(errorPageHtml(message));
}

function watchDevWindow(win: BrowserWindow): void {
  win.webContents.on('console-message', (details, level, message) => {
    const text = message || (details as unknown as { message?: string }).message || '';
    const namedLevel = (details as unknown as { level?: string }).level;
    if (level >= 3 || namedLevel === 'error') {
      console.error(`[renderer] ${text}`);
    }
  });
  win.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame || code === -3) {
      return;
    }
    console.error(`[renderer] failed to load ${url}: ${description} (${code})`);
    showError(`无法打开管理后台 ${url}\n${description} (${code})`);
  });
  let retried = false;
  win.webContents.on('did-finish-load', () => {
    if (showingError || retried) {
      return;
    }
    setTimeout(() => {
      if (showingError || retried || win.isDestroyed()) {
        return;
      }
      void win.webContents
        .executeJavaScript('document.getElementById("root")?.childElementCount ?? 0')
        .then((count: number) => {
          if (count === 0 && !retried && !win.isDestroyed()) {
            retried = true;
            console.error('[renderer] blank page, reloading');
            win.webContents.reload();
          }
        })
        .catch(() => undefined);
    }, 1500);
  });
}

function isAddrInUse(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'EADDRINUSE';
}

async function startProductionHosts(): Promise<void> {
  const adminRoot = adminDist();
  const h5Root = appDist();
  if (!existsSync(adminRoot)) {
    throw new Error(`找不到管理后台构建产物：${adminRoot}`);
  }
  if (!existsSync(h5Root)) {
    throw new Error(`找不到 H5 构建产物：${h5Root}`);
  }
  try {
    servers.push(await listenStatic({ host: LOOPBACK, port: ADMIN_PORT, root: adminRoot }));
    servers.push(await listenStatic({ host: LOOPBACK, port: APP_PORT, root: h5Root }));
  } catch (error) {
    if (isAddrInUse(error)) {
      throw new Error('端口 5173 或 5174 已被占用。请先关闭 pnpm dev 或其它占用进程后再启动桌面生产模式。');
    }
    throw error;
  }
}

async function startProductionBackend(): Promise<void> {
  const server = loadServer();
  const origin = serverOrigin(server);
  setBackendOrigin(origin);
  if (await isBackendHealthy(origin)) {
    return;
  }
  if (!isLoopbackHost(server.host)) {
    throw new Error(`无法连接后端 ${origin}。请检查 IP 与端口，或在登录页修改服务器地址。`);
  }
  const nodeExecutable = resolveNodeExecutable();
  const nodeCheck = checkNode(nodeExecutable);
  if (!nodeCheck.ok) {
    throw new Error(nodeCheck.reason);
  }
  backendProcess = spawnBackend(nodeExecutable, server.port);
  backendProcess.once('error', (error) => {
    showError(error.message);
  });
  await waitForHealth(origin);
}

function registerServerIpc(): void {
  ipcMain.handle('server:get', () => loadServer());
  ipcMain.handle('server:set', (_event, raw: unknown) => {
    const config = saveServer(raw);
    setBackendOrigin(serverOrigin(config));
    return config;
  });
}

async function boot(): Promise<void> {
  registerServerIpc();
  setBackendOrigin(serverOrigin(loadServer()));
  attachNavigationGuards();
  mainWindow = createMainWindow();
  if (devMode) {
    watchDevWindow(mainWindow);
    void mainWindow.loadURL(ADMIN_ORIGIN);
    return;
  }
  try {
    showHtml(startingPageHtml());
    await startProductionHosts();
    await startProductionBackend();
    void mainWindow.loadURL(ADMIN_ORIGIN);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showError(message);
  }
}

void app.whenReady().then(() => {
  void boot();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackend(backendProcess);
  backendProcess = undefined;
  for (const server of servers) {
    server.close();
  }
  servers.length = 0;
});
