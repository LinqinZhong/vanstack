export function startingPageHtml(): string {
  return `<!doctype html>
<html lang="zh">
  <head>
    <meta charset="UTF-8" />
    <title>Vanstack</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        background: #111827;
        color: #f9fafb;
      }
    </style>
  </head>
  <body>
    <p>正在启动后端，请稍候…</p>
  </body>
</html>`;
}

export function errorPageHtml(message: string): string {
  const escaped = escapeHtml(message);
  return `<!doctype html>
<html lang="zh">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vanstack</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        background: #111827;
        color: #f9fafb;
      }
      main {
        max-width: 40rem;
        padding: 2rem;
        line-height: 1.6;
      }
      h1 { font-size: 1.5rem; margin: 0 0 0.75rem; }
      p { margin: 0 0 0.75rem; }
      .hint { color: #9ca3af; font-size: 0.95rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>无法启动桌面应用</h1>
      <p>${escaped}</p>
      <p class="hint">后端仍需本机 Node.js &gt;= 20 以独立进程运行。请安装 Node 后重试，或先执行 pnpm start:desktop。</p>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
