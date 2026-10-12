import { api } from '../apis/api';
import { resolveAssetUrl } from '../components/AssetLibraryPanel';

/** 稳定的字体族名，用于 @font-face 与控件 style.fontFamily 的映射。 */
export function fontFamilyFor(file: { key: string }): string {
  return `vanstack-font-${file.key.replace(/[^a-zA-Z0-9]/g, '')}`;
}

export type FontCatalogEntry = {
  family: string;
  label: string;
  url: string;
};

let entries: FontCatalogEntry[] = [];
let generation = 0;
const listeners = new Set<(list: FontCatalogEntry[]) => void>();

export function getFontCatalog(): FontCatalogEntry[] {
  return entries;
}

export function subscribeFontCatalog(listener: (list: FontCatalogEntry[]) => void) {
  listeners.add(listener);
  listener(entries);
  return () => {
    listeners.delete(listener);
  };
}

export async function refreshFontCatalog(projectId: string, versionId: string) {
  const gen = ++generation;
  const files = await api.listFonts(projectId, versionId);
  if (gen !== generation) {
    return entries;
  }
  entries = files.map((file) => ({
    family: fontFamilyFor(file),
    label: file.name.replace(/\.[^.]+$/, '') || file.name,
    url: resolveAssetUrl(file.url),
  }));
  for (const listener of listeners) {
    listener(entries);
  }
  return entries;
}