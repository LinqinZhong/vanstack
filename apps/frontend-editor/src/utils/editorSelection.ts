const STORAGE_KEY = 'vanstack.admin.editor.selection';

type ProjectSelection = {
  pageId?: string;
  componentId?: string;
  versions?: Record<string, string>;
};

type SelectionStore = Record<string, ProjectSelection>;

function readStore(): SelectionStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed as SelectionStore;
  } catch {
    return {};
  }
}

function writeStore(store: SelectionStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function projectEntry(store: SelectionStore, projectId: string): ProjectSelection {
  return store[projectId] ?? {};
}

export function getRememberedPageId(projectId: string): string | null {
  return readStore()[projectId]?.pageId ?? null;
}

export function getRememberedVersionId(projectId: string, pageId: string): string | null {
  return readStore()[projectId]?.versions?.[pageId] ?? null;
}

export function getRememberedComponentId(projectId: string): string | null {
  return readStore()[projectId]?.componentId ?? null;
}

export function rememberComponentId(projectId: string, componentId: string) {
  const store = readStore();
  store[projectId] = { ...projectEntry(store, projectId), componentId };
  writeStore(store);
}

export function forgetComponentSelection(projectId: string, componentId: string) {
  const store = readStore();
  const current = projectEntry(store, projectId);
  const versions = { ...(current.versions ?? {}) };
  delete versions[`component:${componentId}`];
  const next: ProjectSelection = { ...current, versions };
  if (current.componentId === componentId) {
    delete next.componentId;
  }
  store[projectId] = next;
  writeStore(store);
}

export function rememberPageId(projectId: string, pageId: string) {
  const store = readStore();
  store[projectId] = { ...projectEntry(store, projectId), pageId };
  writeStore(store);
}

export function rememberVersionId(projectId: string, pageId: string, versionId: string) {
  const store = readStore();
  const current = projectEntry(store, projectId);
  store[projectId] = {
    ...current,
    versions: { ...(current.versions ?? {}), [pageId]: versionId },
  };
  writeStore(store);
}

export function forgetPageSelection(projectId: string, pageId: string) {
  const store = readStore();
  const current = projectEntry(store, projectId);
  if (!current.pageId && !current.versions?.[pageId]) {
    return;
  }
  const versions = { ...(current.versions ?? {}) };
  delete versions[pageId];
  const next: ProjectSelection = { versions };
  if (current.pageId && current.pageId !== pageId) {
    next.pageId = current.pageId;
  }
  store[projectId] = next;
  writeStore(store);
}

export function pickRememberedId<T extends { id: string }>(
  items: T[],
  rememberedId: string | null,
  fallbackId?: string | null,
): T | undefined {
  return (
    items.find((item) => item.id === rememberedId) ??
    items.find((item) => item.id === fallbackId) ??
    items[0]
  );
}
