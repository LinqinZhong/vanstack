import { api } from '../apis/api';
import { resolveAssetUrl } from '../components/AssetLibraryPanel';

/** 图标在控件 src 里写成 `分组.名称`，名称不含 .svg。 */
export function iconPath(group: string, fileName: string) {
  return `${group}.${fileName.replace(/\.svg$/i, '')}`;
}

type Listener = (catalog: Record<string, string>) => void;
type IconFn = (path: string) => string;

let catalog: Record<string, string> = {};
let generation = 0;
const listeners = new Set<Listener>();

export function getIconCatalog() {
  return catalog;
}

export function iconCatalogGeneration() {
  return generation;
}

function publishIconFn() {
  const host = globalThis as { $icon?: IconFn };
  host.$icon = (path: string) => {
    const key = String(path ?? '').trim();
    return catalog[key] ?? key;
  };
}

publishIconFn();

export function subscribeIconCatalog(listener: Listener) {
  listeners.add(listener);
  listener(catalog);
  return () => {
    listeners.delete(listener);
  };
}

export async function refreshIconCatalog(projectId: string, versionId: string) {
  const gen = ++generation;
  const groups = await api.listIconGroups(projectId, versionId);
  const lists = await Promise.all(groups.map((group) => api.listIconFiles(projectId, versionId, group.name)));
  if (gen !== generation) {
    return catalog;
  }
  const next: Record<string, string> = {};
  groups.forEach((group, index) => {
    for (const file of lists[index] ?? []) {
      next[iconPath(group.name, file.name)] = resolveAssetUrl(file.url);
    }
  });
  catalog = next;
  publishIconFn();
  for (const listener of listeners) {
    listener(catalog);
  }
  return catalog;
}
