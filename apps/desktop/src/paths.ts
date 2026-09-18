import path from 'node:path';

export const ADMIN_ORIGIN = 'http://127.0.0.1:5174';
export const APP_ORIGIN = 'http://127.0.0.1:5173';
export const BACKEND_ORIGIN = 'http://127.0.0.1:3000';
export const HEALTH_URL = `${BACKEND_ORIGIN}/api/health`;
export const LOOPBACK = '127.0.0.1';
export const ADMIN_PORT = 5174;
export const APP_PORT = 5173;
export const BACKEND_PORT = 3000;

export function desktopRoot(): string {
  return path.resolve(__dirname, '..');
}

export function repoRoot(): string {
  return path.resolve(desktopRoot(), '../..');
}

export function backendRoot(): string {
  return path.resolve(repoRoot(), 'apps/backend');
}

export function adminDist(): string {
  return path.resolve(repoRoot(), 'apps/frontend-admin/dist');
}

export function appDist(): string {
  return path.resolve(repoRoot(), 'apps/frontend-app/dist');
}

export function preloadPath(): string {
  return path.join(__dirname, 'preload.js');
}

export function isDevMode(argv: string[] = process.argv): boolean {
  return argv.includes('--dev');
}
