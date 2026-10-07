import http from 'node:http';
import Busboy from 'busboy';
import { ApiError, assertProjectId, withProjectLock } from './disk';
import { findLocalObject, LocalLowcode } from './lowcode';
import { commitProject, getBackendOrigin, importProject, proxyToBackend, setBackendOrigin } from './remote';

const lowcode = new LocalLowcode();

type Ctx = {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  url: URL;
  params: Record<string, string>;
};

export function listen(port: number): Promise<void> {
  const server = http.createServer((req, res) => {
    void handle(req, res).catch((error: unknown) => {
      const status = error instanceof ApiError ? error.status : 500;
      const message = error instanceof Error ? error.message : 'error';
      if (!res.headersSent) {
        sendText(res, status, message);
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve());
  });
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const pathname = decodeURI(url.pathname);
  if (pathname === '/api/health' || pathname.startsWith('/api/auth') || pathname.startsWith('/api/runtime')) {
    proxyToBackend(req, res, `${pathname}${url.search}`);
    return;
  }
  if (pathname.startsWith('/api/files/content/')) {
    await serveFile(pathname.slice('/api/files/content/'.length), req, res, url);
    return;
  }
  if (req.method === 'POST' && pathname === '/api/workspace/backend') {
    const body = await readJson(req);
    const host = String(body.host ?? '').trim();
    const port = Number(body.port);
    if (!host || !Number.isInteger(port)) {
      throw new ApiError(400, 'invalid backend');
    }
    sendJson(res, 200, { origin: await setBackendOrigin(host, port) });
    return;
  }
  if (req.method === 'GET' && pathname === '/api/workspace/backend') {
    sendJson(res, 200, { origin: getBackendOrigin() });
    return;
  }
  if (req.method === 'POST' && pathname === '/api/workspace/projects/import') {
    const body = await readJson(req);
    const id = assertProjectId(String(body.id ?? ''));
    sendJson(res, 201, await importProject(id, header(req, 'authorization')));
    return;
  }
  const changeMatch = /^\/api\/workspace\/projects\/([^/]+)\/(changes|commit)$/.exec(pathname);
  if (changeMatch) {
    const id = assertProjectId(changeMatch[1]);
    if (changeMatch[2] === 'changes' && req.method === 'GET') {
      sendJson(res, 200, await lowcode.changes(id));
      return;
    }
    if (changeMatch[2] === 'commit' && req.method === 'POST') {
      sendJson(res, 200, await withProjectLock(id, () => commitProject(id, header(req, 'authorization'))));
      return;
    }
  }
  if (!pathname.startsWith('/api/projects')) {
    sendText(res, 404, 'Not Found');
    return;
  }
  await routeProject(req, res, url, pathname);
}

async function routeProject(req: http.IncomingMessage, res: http.ServerResponse, url: URL, pathname: string) {
  const method = req.method ?? 'GET';
  const parts = pathname.split('/').filter(Boolean);
  // api projects ...
  if (parts.length === 2 && parts[0] === 'api' && parts[1] === 'projects') {
    if (method === 'GET') {
      sendJson(res, 200, await lowcode.listProjects());
      return;
    }
    if (method === 'POST') {
      sendJson(res, 201, await lowcode.createProject(await readJson(req)));
      return;
    }
  }
  const id = parts[2];
  if (!id) {
    sendText(res, 404, 'Not Found');
    return;
  }
  assertProjectId(id);
  const rest = parts.slice(3).map((part) => safeDecode(part));
  await withProjectLock(id, async () => {
    const result = await dispatch(method, id, rest, req);
    if (result === undefined) {
      sendEmpty(res);
      return;
    }
    sendJson(res, method === 'POST' ? 201 : 200, result);
  });
}

async function dispatch(method: string, id: string, rest: string[], req: http.IncomingMessage): Promise<unknown> {
  const body = async () => readJson(req);
  if (rest.length === 0) {
    if (method === 'GET') return lowcode.getProject(id);
    if (method === 'PATCH') return lowcode.updateProject(id, await body());
    if (method === 'DELETE') {
      await lowcode.deleteProject(id);
      return undefined;
    }
  }
  if (rest[0] === 'versions' && rest.length === 1) {
    if (method === 'GET') return lowcode.listVersions(id);
    if (method === 'POST') return lowcode.createVersion(id, await body());
  }
  const versionId = rest[1];
  if (rest[0] === 'versions' && rest.length === 2 && method === 'DELETE') {
    await lowcode.deleteVersion(id, versionId);
    return undefined;
  }
  if (rest[0] === 'versions' && rest[2] === 'langs') {
    if (method === 'GET') return lowcode.getLangs(id, versionId);
    if (method === 'PUT') return lowcode.putLangs(id, versionId, await body());
  }
  if (rest[0] === 'versions' && rest[2] === 'pages' && rest.length === 3) {
    if (method === 'GET') return lowcode.listPages(id, versionId);
    if (method === 'POST') return lowcode.createPage(id, versionId, await body());
  }
  if (rest[0] === 'versions' && rest[2] === 'pages' && rest.length === 4) {
    const pageId = rest[3];
    if (method === 'PATCH') return lowcode.updatePage(id, versionId, pageId, await body());
    if (method === 'DELETE') {
      await lowcode.deletePage(id, versionId, pageId);
      return undefined;
    }
  }
  if (rest[0] === 'versions' && rest[2] === 'pages' && rest[4] === 'document') {
    const pageId = rest[3];
    if (method === 'GET') return lowcode.getPageDocument(id, versionId, pageId);
    if (method === 'PATCH') return lowcode.updatePageDocument(id, versionId, pageId, await body());
  }
  if (rest[0] === 'components' && rest.length === 1) {
    if (method === 'GET') return lowcode.listComponents(id);
    if (method === 'POST') return lowcode.createComponent(id, await body());
  }
  if (rest[0] === 'components' && rest.length === 2 && method === 'GET') {
    const rows = await lowcode.listComponents(id);
    const found = rows.find((item) => item.id === rest[1]);
    if (!found) {
      throw new ApiError(404, 'component not found');
    }
    return found;
  }
  if (rest[0] === 'components' && rest.length === 2) {
    if (method === 'PATCH') return lowcode.updateComponent(id, rest[1], await body());
    if (method === 'DELETE') {
      await lowcode.deleteComponent(id, rest[1]);
      return undefined;
    }
  }
  if (rest[0] === 'components' && rest[2] === 'versions' && rest[3] === 'meta' && method === 'GET') {
    return lowcode.listComponentVersionMeta(id, rest[1]);
  }
  if (rest[0] === 'components' && rest[2] === 'versions' && rest.length === 4 && method === 'GET') {
    return lowcode.getComponentVersion(id, rest[1], rest[3]);
  }
  if (rest[0] === 'components' && rest[2] === 'versions' && rest.length === 4 && method === 'PATCH') {
    return lowcode.updateComponentVersion(id, rest[1], rest[3], await body());
  }
  const library = rest[2] === 'assets' ? 'asset' : rest[2] === 'icons' ? 'icon' : null;
  if (rest[0] === 'versions' && library && rest[3] === 'groups') {
    if (rest.length === 4) {
      if (method === 'GET') return lowcode.listGroups(id, versionId, library);
      if (method === 'POST') {
        const payload = await body();
        return lowcode.createGroup(id, versionId, library, String(payload.name ?? ''));
      }
    }
    if (rest.length === 5 && method === 'PATCH') {
      const payload = await body();
      return lowcode.renameGroup(id, versionId, library, rest[4], String(payload.name ?? ''));
    }
    if (rest.length === 5 && method === 'DELETE') {
      await lowcode.deleteGroup(id, versionId, library, rest[4]);
      return undefined;
    }
    if (rest[5] === 'files' && rest.length === 6 && method === 'GET') {
      return lowcode.listFiles(id, versionId, library, rest[4]);
    }
    if (rest[5] === 'files' && rest.length === 6 && method === 'POST') {
      const form = await readForm(req);
      if (!form.file) {
        throw new ApiError(400, 'file is required');
      }
      return lowcode.uploadFile(id, versionId, library, rest[4], form.file, form.fields.name);
    }
    if (rest[5] === 'files' && rest.length === 7 && method === 'DELETE') {
      await lowcode.deleteFile(id, versionId, library, rest[4], rest[6]);
      return undefined;
    }
  }
  if (rest[0] === 'namespaces' && rest.length === 1) {
    if (method === 'GET') return lowcode.listNamespaces(id);
    if (method === 'POST') {
      const payload = await body();
      return lowcode.createNamespace(id, String(payload.name ?? ''));
    }
  }
  if (rest[0] === 'namespaces' && rest.length === 2) {
    if (method === 'GET') return lowcode.getNamespace(id, rest[1]);
    if (method === 'PUT') return lowcode.putNamespace(id, rest[1], await body());
    if (method === 'PATCH') {
      const payload = await body();
      return lowcode.renameNamespace(id, rest[1], String(payload.name ?? ''));
    }
    if (method === 'DELETE') {
      await lowcode.deleteNamespace(id, rest[1]);
      return undefined;
    }
  }
  if (rest[0] === 'methods' && rest.length === 2) {
    if (method === 'GET') return lowcode.getMethod(id, rest[1]);
    if (method === 'PUT') {
      const payload = await body();
      return lowcode.putMethod(id, rest[1], String(payload.code ?? ''));
    }
  }
  if (rest[0] === 'events' && rest.length === 2) {
    if (method === 'GET') return lowcode.getEvent(id, rest[1]);
    if (method === 'PUT') {
      const payload = await body();
      return lowcode.putEvent(id, rest[1], String(payload.source ?? ''));
    }
    if (method === 'DELETE') {
      await lowcode.deleteEvent(id, rest[1]);
      return undefined;
    }
  }
  throw new ApiError(404, 'Not Found');
}

async function serveFile(encodedKey: string, req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  const key = safeDecode(encodedKey);
  const local = await findLocalObject(key);
  if (local) {
    res.writeHead(200, { 'content-type': local.contentType, 'cache-control': 'no-cache' });
    res.end(local.body);
    return;
  }
  proxyToBackend(req, res, `/api/files/content/${encodeURIComponent(key)}${url.search}`);
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function sendText(res: http.ServerResponse, status: number, message: string) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(message);
}

function sendEmpty(res: http.ServerResponse) {
  res.writeHead(204);
  res.end();
}

function header(req: http.IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

async function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) {
    return {};
  }
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw new ApiError(400, 'invalid json');
  }
  return parsed as Record<string, unknown>;
}

function readForm(req: http.IncomingMessage): Promise<{ fields: Record<string, string>; file?: { originalName: string; mime: string; body: Buffer } }> {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: 8 * 1024 * 1024 } });
    const fields: Record<string, string> = {};
    const chunks: Buffer[] = [];
    let file: { originalName: string; mime: string; body: Buffer } | undefined;
    busboy.on('field', (name, value) => {
      fields[name] = value;
    });
    busboy.on('file', (_name, stream, info) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('limit', () => reject(new ApiError(400, 'file too large')));
      stream.on('end', () => {
        file = { originalName: info.filename, mime: info.mimeType, body: Buffer.concat(chunks) };
      });
    });
    busboy.on('finish', () => resolve({ fields, file }));
    busboy.on('error', reject);
    req.pipe(busboy);
  });
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function findAndServe() {
  return findLocalObject;
}
