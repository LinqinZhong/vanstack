import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export type DesktopServerConfig = {
  host: string;
  port: number;
};

export const DEFAULT_SERVER: DesktopServerConfig = { host: '127.0.0.1', port: 3000 };

export function formatHost(host: string): string {
  return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
}

export function serverOrigin(config: DesktopServerConfig): string {
  return `http://${formatHost(config.host)}:${config.port}`;
}

export function isLoopbackHost(host: string): boolean {
  const value = host.trim().toLowerCase();
  return value === '127.0.0.1' || value === 'localhost' || value === '::1' || value === '[::1]';
}

export function parseServerConfig(raw: unknown): DesktopServerConfig {
  const value = raw as Partial<DesktopServerConfig>;
  const host = String(value?.host ?? '').trim();
  const port = Number(value?.port);
  if (!host || /^[a-z][a-z0-9+.-]*:\/\//i.test(host) || host.includes('/') || /\s/.test(host)) {
    throw new Error('服务器 IP / 主机名无效');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('服务器端口须为 1–65535');
  }
  return { host, port };
}

export function serverFilePath(): string {
  return path.join(app.getPath('userData'), 'server.json');
}

export function loadServer(): DesktopServerConfig {
  try {
    const file = serverFilePath();
    if (!existsSync(file)) {
      return DEFAULT_SERVER;
    }
    return parseServerConfig(JSON.parse(readFileSync(file, 'utf8')));
  } catch {
    return DEFAULT_SERVER;
  }
}

export function saveServer(raw: unknown): DesktopServerConfig {
  const config = parseServerConfig(raw);
  const file = serverFilePath();
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return config;
}
