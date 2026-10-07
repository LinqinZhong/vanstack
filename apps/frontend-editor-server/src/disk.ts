import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type ChangeOp = 'write' | 'delete';

export type ChangeEntry = {
  path: string;
  op: ChangeOp;
  contentType?: string;
};

export type ChangeLog = {
  entries: ChangeEntry[];
};

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function workspaceRoot(): string {
  return path.resolve(process.env.VANSTACK_WORKSPACE ?? path.join(process.cwd(), 'data', 'projects'));
}

export function assertProjectId(id: string): string {
  if (!ID_PATTERN.test(id)) {
    throw new ApiError(400, 'invalid project id');
  }
  return id;
}

export function projectDir(id: string): string {
  return path.join(workspaceRoot(), assertProjectId(id));
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function newId(): string {
  return randomUUID();
}

export async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const text = await readFile(filePath, 'utf8');
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function readChange(projectId: string): Promise<ChangeLog> {
  const log = await readJson<ChangeLog>(path.join(projectDir(projectId), '.change'));
  if (!log || !Array.isArray(log.entries)) {
    return { entries: [] };
  }
  return log;
}

export async function writeChange(projectId: string, log: ChangeLog): Promise<void> {
  await writeJson(path.join(projectDir(projectId), '.change'), log);
}

export async function markChange(projectId: string, entry: ChangeEntry): Promise<void> {
  const log = await readChange(projectId);
  const entries = log.entries.filter((item) => item.path !== entry.path);
  entries.push(entry);
  await writeChange(projectId, { entries });
}

export async function clearChange(projectId: string): Promise<void> {
  await writeChange(projectId, { entries: [] });
}

export function mongoFile(projectId: string, relativePath: string): string {
  const root = projectDir(projectId);
  const full = path.resolve(root, 'mongo', relativePath);
  const rel = path.relative(path.resolve(root, 'mongo'), full);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new ApiError(400, 'invalid path');
  }
  return full;
}

export function ossFile(projectId: string, key: string): string {
  if (!key || key.includes('..') || key.startsWith('/') || key.includes('\\')) {
    throw new ApiError(400, 'invalid object key');
  }
  return path.join(projectDir(projectId), 'oss', ...key.split('/'));
}

export async function listProjectIds(): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(workspaceRoot());
  } catch {
    return [];
  }
  return names.filter((name) => ID_PATTERN.test(name));
}

export async function removeProjectDir(projectId: string): Promise<void> {
  await rm(projectDir(projectId), { recursive: true, force: true });
}

const locks = new Map<string, Promise<unknown>>();

export function withProjectLock<T>(projectId: string, run: () => Promise<T>): Promise<T> {
  const previous = locks.get(projectId) ?? Promise.resolve();
  const next = previous.then(run, run);
  locks.set(
    projectId,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}
