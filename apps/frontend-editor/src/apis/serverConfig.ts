export type ServerConfig = {
  host: string;
  port: number;
};

export const DEFAULT_SERVER: ServerConfig = { host: '127.0.0.1', port: 3000 };
const STORAGE_KEY = 'vanstack.server';

export function isDesktopShell(): boolean {
  return Boolean(window.vanstackDesktop);
}

export function serverOrigin(config: ServerConfig = getServerConfig()): string {
  return `http://${formatHost(config.host)}:${config.port}`;
}

export function apiBase(): string {
  return '/api';
}

export function formatHost(host: string): string {
  return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
}

export function parseServerConfig(host: string, port: string | number): ServerConfig {
  const trimmed = host.trim();
  if (!trimmed) {
    throw new Error('host');
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) || trimmed.includes('/') || /\s/.test(trimmed)) {
    throw new Error('host');
  }
  const nextPort = typeof port === 'number' ? port : Number(String(port).trim());
  if (!Number.isInteger(nextPort) || nextPort < 1 || nextPort > 65535) {
    throw new Error('port');
  }
  return { host: trimmed, port: nextPort };
}

export function getServerConfig(): ServerConfig {
  if (!isDesktopShell()) {
    return DEFAULT_SERVER;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SERVER;
    }
    const parsed = JSON.parse(raw) as Partial<ServerConfig>;
    return parseServerConfig(String(parsed.host ?? ''), Number(parsed.port));
  } catch {
    return DEFAULT_SERVER;
  }
}

export async function loadServerConfig(): Promise<ServerConfig> {
  if (!window.vanstackDesktop) {
    return DEFAULT_SERVER;
  }
  const remote = await window.vanstackDesktop.getServer();
  writeLocal(remote);
  return remote;
}

export async function saveServerConfig(config: ServerConfig): Promise<ServerConfig> {
  if (!window.vanstackDesktop) {
    return config;
  }
  const saved = await window.vanstackDesktop.setServer(config);
  writeLocal(saved);
  return saved;
}

function writeLocal(config: ServerConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
