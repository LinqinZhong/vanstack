import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ApiError, clearChange, mongoFile, ossFile, readJson, workspaceRoot, writeJson } from './disk';
import { materializeBundle } from './lowcode';

const backendFile = () => path.join(workspaceRoot(), 'backend.json');

let backendOrigin = (process.env.BACKEND_ORIGIN ?? 'http://127.0.0.1:3000').replace(/\/$/, '');

export function getBackendOrigin(): string {
  return backendOrigin;
}

export async function loadBackendOrigin(): Promise<void> {
  const saved = await readJson<{ origin?: string }>(backendFile());
  if (saved?.origin) {
    backendOrigin = saved.origin.replace(/\/$/, '');
  }
}

export async function setBackendOrigin(host: string, port: number): Promise<string> {
  backendOrigin = `http://${host.includes(':') && !host.startsWith('[') ? `[${host}]` : host}:${port}`;
  await writeJson(backendFile(), { origin: backendOrigin });
  return backendOrigin;
}

export async function importProject(cloudId: string, authorization: string | undefined) {
  const bundle = await backendJson<{ project?: { _id?: string }; objects?: Array<{ key: string }> }>(
    'GET',
    `/api/projects/${cloudId}/bundle`,
    authorization,
  );
  const project = bundle.project as { _id?: string } | undefined;
  if (!project || project._id !== cloudId) {
    throw new ApiError(400, 'cloud project id does not match');
  }
  const { readChange, removeProjectDir } = await import('./disk');
  const existing = await readJson(mongoFile(cloudId, 'project.json'));
  if (existing) {
    const changes = await readChange(cloudId);
    if (changes.entries.length > 0) {
      throw new ApiError(409, 'local project has uncommitted changes');
    }
    await removeProjectDir(cloudId);
  }
  const objects = [];
  for (const item of bundle.objects ?? []) {
    const downloaded = await backendBytes(`/api/files/content/${encodeURIComponent(item.key)}`, authorization);
    objects.push({ key: item.key, body: downloaded.body, contentType: downloaded.contentType });
  }
  await materializeBundle(cloudId, bundle, objects);
  const saved = await readJson<{ name: string; key: string; description: string; currentVersionId: string | null; createdAt: string; updatedAt: string }>(
    mongoFile(cloudId, 'project.json'),
  );
  if (!saved) {
    throw new ApiError(500, 'import failed');
  }
  return {
    id: cloudId,
    name: saved.name,
    key: saved.key,
    description: saved.description,
    currentVersionId: saved.currentVersionId ?? null,
    createdAt: saved.createdAt,
    updatedAt: saved.updatedAt,
  };
}

export async function commitProject(projectId: string, authorization: string | undefined) {
  const { readChange } = await import('./disk');
  const log = await readChange(projectId);
  const writes: Array<{ collection: string; doc: unknown }> = [];
  const deletes: Array<{ collection: string; id: string; projectId: string }> = [];
  const deleteObjects: string[] = [];
  const uploads: Array<{ key: string; contentType: string }> = [];
  let project: unknown;
  for (const entry of log.entries) {
    if (entry.path === 'mongo/project.json') {
      if (entry.op === 'write') {
        project = await readJson(mongoFile(projectId, 'project.json'));
      }
      continue;
    }
    if (entry.path.startsWith('mongo/')) {
      const match = /^mongo\/(.+)\/([^/]+)\.json$/.exec(entry.path);
      if (!match) {
        continue;
      }
      const collection = match[1];
      const id = match[2];
      if (entry.op === 'delete') {
        deletes.push({ collection, id, projectId });
      } else {
        const doc = await readJson(mongoFile(projectId, `${collection}/${id}.json`));
        if (doc) {
          writes.push({ collection, doc });
        }
      }
      continue;
    }
    if (entry.path.startsWith('oss/')) {
      const key = entry.path.slice('oss/'.length);
      if (entry.op === 'delete') {
        deleteObjects.push(key);
      } else {
        uploads.push({ key, contentType: entry.contentType || 'application/octet-stream' });
      }
    }
  }
  await backendJson('PUT', '/api/projects/bundle', authorization, { project, writes, deletes, deleteObjects });
  for (const object of uploads) {
    const body = await readFile(ossFile(projectId, object.key));
    await backendBytesPut(object.key, body, object.contentType, authorization);
  }
  await clearChange(projectId);
  return { committed: log.entries.length };
}

async function backendJson<T>(method: string, pathname: string, authorization: string | undefined, body?: unknown): Promise<T> {
  const response = await fetch(`${backendOrigin}${pathname}`, {
    method,
    headers: {
      accept: 'application/json',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(authorization ? { authorization } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new ApiError(response.status, (await response.text()) || `backend ${response.status}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

async function backendBytes(pathname: string, authorization: string | undefined) {
  const response = await fetch(`${backendOrigin}${pathname}`, {
    headers: authorization ? { authorization } : {},
  });
  if (!response.ok) {
    throw new ApiError(response.status, `failed to download ${pathname}`);
  }
  return {
    body: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') || 'application/octet-stream',
  };
}

async function backendBytesPut(key: string, body: Buffer, contentType: string, authorization: string | undefined) {
  const response = await fetch(`${backendOrigin}/api/projects/bundle/object?key=${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/octet-stream',
      'x-content-type': contentType,
      ...(authorization ? { authorization } : {}),
    },
    body: new Uint8Array(body),
  });
  if (!response.ok) {
    throw new ApiError(response.status, (await response.text()) || `upload failed ${key}`);
  }
}

export function proxyToBackend(req: http.IncomingMessage, res: http.ServerResponse, targetPath: string) {
  const target = new URL(targetPath, backendOrigin);
  const headers = { ...req.headers, host: target.host };
  delete headers.connection;
  const proxyReq = http.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      path: `${target.pathname}${target.search}`,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    }
    res.end('Bad Gateway');
  });
  req.pipe(proxyReq);
}
