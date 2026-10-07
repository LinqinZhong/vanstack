import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';

let backendOrigin = 'http://127.0.0.1:3010';

export function setBackendOrigin(origin: string): void {
  backendOrigin = origin.replace(/\/$/, '');
}

export function getBackendOrigin(): string {
  return backendOrigin;
}

const MIME: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export function listenStatic(options: {
  host: string;
  port: number;
  root: string;
}): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://${options.host}:${options.port}`);
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        proxyApi(req, res, url);
        return;
      }
      serveFile(options.root, url.pathname, res);
    });
    server.once('error', reject);
    server.listen(options.port, options.host, () => resolve(server));
  });
}

function proxyApi(req: http.IncomingMessage, res: http.ServerResponse, url: URL): void {
  const target = new URL(url.pathname + url.search, backendOrigin);
  const headers = { ...req.headers, host: target.host };
  delete headers['connection'];
  const proxyReq = http.request(
    {
      hostname: target.hostname,
      port: target.port,
      path: target.pathname + target.search,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on('error', () => {
    res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Bad Gateway');
  });
  req.pipe(proxyReq);
}

function serveFile(root: string, pathname: string, res: http.ServerResponse): void {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const rootPath = path.resolve(root);
  const candidate = path.resolve(rootPath, relative);
  const rel = path.relative(rootPath, candidate);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    res.writeHead(403);
    res.end();
    return;
  }
  const ext = path.extname(candidate);
  const fallback = !ext || ext === '.html';
  const filePath = existsSync(candidate) && statSync(candidate).isFile()
    ? candidate
    : fallback
      ? path.join(root, 'index.html')
      : '';
  if (!filePath || !existsSync(filePath)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }
  const type = MIME[path.extname(filePath)] ?? 'application/octet-stream';
  res.writeHead(200, { 'content-type': type });
  createReadStream(filePath).pipe(res);
}
