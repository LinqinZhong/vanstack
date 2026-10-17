import { api } from '../apis/api';
import { resolveAssetUrl } from '../components/AssetLibraryPanel';

/** 资源库文件在脚本里写成 `分组.文件名`。 */
export function assetPath(group: string, fileName: string) {
  return `${group}.${fileName}`;
}

type Listener = (catalog: Record<string, string>) => void;
type AssetFn = (path: string) => string;

let catalog: Record<string, string> = {};
let generation = 0;
const listeners = new Set<Listener>();

export function getAssetCatalog() {
  return catalog;
}

export function assetCatalogGeneration() {
  return generation;
}

function publishAssetFn() {
  const host = globalThis as { $asset?: AssetFn };
  host.$asset = (path: string) => {
    const key = String(path ?? '').trim();
    return catalog[key] ?? key;
  };
}

publishAssetFn();

export function subscribeAssetCatalog(listener: Listener) {
  listeners.add(listener);
  listener(catalog);
  return () => {
    listeners.delete(listener);
  };
}

export async function refreshAssetCatalog(projectId: string, versionId: string) {
  const gen = ++generation;
  const groups = await api.listAssetGroups(projectId, versionId);
  const lists = await Promise.all(groups.map((group) => api.listAssetFiles(projectId, versionId, group.name)));
  if (gen !== generation) {
    return catalog;
  }
  const next: Record<string, string> = {};
  groups.forEach((group, index) => {
    for (const file of lists[index] ?? []) {
      next[assetPath(group.name, file.name)] = resolveAssetUrl(file.url);
    }
  });
  catalog = next;
  publishAssetFn();
  for (const listener of listeners) {
    listener(catalog);
  }
  return catalog;
}