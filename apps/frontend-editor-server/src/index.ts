import { mkdir } from 'node:fs/promises';
import { workspaceRoot } from './disk';
import { loadBackendOrigin } from './remote';
import { listen } from './server';

const port = Number(process.env.PORT ?? 3010);

async function main() {
  await mkdir(workspaceRoot(), { recursive: true });
  await loadBackendOrigin();
  await listen(port);
  console.log(`frontend-editor-server listening on http://127.0.0.1:${port}`);
}

void main();

