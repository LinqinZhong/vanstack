import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { backendRoot, editorServerRoot } from './paths';

const HEALTH_TIMEOUT_MS = 45_000;
const HEALTH_INTERVAL_MS = 400;

export function resolveNodeExecutable(): string {
  const candidates = [process.env.VANSTACK_NODE, process.env.npm_node_execpath, 'node'];
  for (const candidate of candidates) {
    if (candidate && (candidate === 'node' || existsSync(candidate))) {
      return candidate;
    }
  }
  return 'node';
}

export function checkNode(executable: string): { ok: true } | { ok: false; reason: string } {
  const result = spawnSync(executable, ['-e', 'process.stdout.write(process.versions.node)'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    return {
      ok: false,
      reason: `找不到可用的 Node.js（尝试：${executable}）。桌面应用需要本机 Node >= 20 来运行后端。`,
    };
  }
  const version = (result.stdout ?? '').trim();
  const major = Number(version.split('.')[0]);
  if (!Number.isFinite(major) || major < 20) {
    return {
      ok: false,
      reason: `当前 Node 为 ${version || '未知'}，需要 Node >= 20 才能运行后端。`,
    };
  }
  return { ok: true };
}

export function spawnBackend(nodeExecutable: string, port: number): ChildProcess {
  const cwd = backendRoot();
  const entry = path.join(cwd, 'dist/main.js');
  if (!existsSync(entry)) {
    throw new Error(`后端尚未构建：找不到 ${entry}。请先执行 pnpm start:desktop 或 pnpm --filter @vanstack/backend build。`);
  }
  return spawn(nodeExecutable, ['dist/main.js'], {
    cwd,
    env: { ...process.env, PORT: String(port) },
    stdio: 'inherit',
    windowsHide: true,
  });
}

export function spawnEditorServer(nodeExecutable: string, backendOrigin: string, workspace: string): ChildProcess {
  const cwd = editorServerRoot();
  const entry = path.join(cwd, 'dist/index.js');
  if (!existsSync(entry)) {
    throw new Error(`编辑器服务尚未构建：找不到 ${entry}。请先执行 pnpm build。`);
  }
  return spawn(nodeExecutable, ['dist/index.js'], {
    cwd,
    env: {
      ...process.env,
      PORT: '3010',
      BACKEND_ORIGIN: backendOrigin,
      VANSTACK_WORKSPACE: workspace,
    },
    stdio: 'inherit',
    windowsHide: true,
  });
}

export async function isBackendHealthy(origin: string): Promise<boolean> {
  try {
    const response = await fetch(`${origin.replace(/\/$/, '')}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function waitForHealth(origin: string, timeoutMs = HEALTH_TIMEOUT_MS): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isBackendHealthy(origin)) {
      return;
    }
    await delay(HEALTH_INTERVAL_MS);
  }
  throw new Error(`后端未在约定时间内通过健康检查（${origin}）。请确认地址、端口与 Node >= 20。`);
}

export function stopBackend(child: ChildProcess | undefined): void {
  if (!child?.pid) {
    return;
  }
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true });
    return;
  }
  child.kill('SIGTERM');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
