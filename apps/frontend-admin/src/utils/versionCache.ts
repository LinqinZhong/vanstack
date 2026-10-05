import type { ProjectPageVersionDto, ProjectPageVersionMetaDto } from '@vanstack/shared';
import { runStoreOn } from './draftStore';

const STORE = 'version-cache';
let leaveGen = 0;

export function retainProjectVersionCache() {
  return ++leaveGen;
}

export function releaseProjectVersionCache(projectId: string, token: number) {
  window.setTimeout(() => {
    if (leaveGen === token) {
      void clearProjectVersionCache(projectId);
    }
  }, 0);
}

type VersionCacheRecord = {
  key: string;
  projectId: string;
  ownerKey: string;
  versionId: string;
  lastModified: string;
  version: ProjectPageVersionDto;
};

function cacheKey(projectId: string, ownerKey: string, versionId: string) {
  return `${projectId}:${ownerKey}:${versionId}`;
}

export async function readOwnerVersionCache(projectId: string, ownerKey: string): Promise<ProjectPageVersionDto[]> {
  try {
    const rows = await runStoreOn<VersionCacheRecord[]>('version-cache', 'readonly', (store) =>
      store.index('byOwner').getAll([projectId, ownerKey]),
    );
    return (rows ?? [])
      .map((row) => row.version)
      .filter((version) => version && typeof version.document === 'object')
      .sort((a, b) => a.versionNo - b.versionNo);
  } catch {
    return [];
  }
}

export async function writeOwnerVersionCache(
  projectId: string,
  ownerKey: string,
  versions: ProjectPageVersionDto[],
): Promise<void> {
  const db = await runStoreOn<IDBValidKey[]>('version-cache', 'readwrite', (store) =>
    store.index('byOwner').getAllKeys([projectId, ownerKey]),
  );
  const keep = new Set(versions.map((version) => cacheKey(projectId, ownerKey, version.id)));
  await runStoreOn('version-cache', 'readwrite', (store) => {
    for (const key of db ?? []) {
      if (!keep.has(String(key))) {
        store.delete(key);
      }
    }
    for (const version of versions) {
      const record: VersionCacheRecord = {
        key: cacheKey(projectId, ownerKey, version.id),
        projectId,
        ownerKey,
        versionId: version.id,
        lastModified: version.lastModified,
        version,
      };
      store.put(record);
    }
    return store.get(cacheKey(projectId, ownerKey, versions[0]?.id ?? ''));
  });
}

export async function putCachedVersion(projectId: string, ownerKey: string, version: ProjectPageVersionDto): Promise<void> {
  const record: VersionCacheRecord = {
    key: cacheKey(projectId, ownerKey, version.id),
    projectId,
    ownerKey,
    versionId: version.id,
    lastModified: version.lastModified,
    version,
  };
  try {
    await runStoreOn(STORE, 'readwrite', (store) => store.put(record));
  } catch {
    return;
  }
}

export async function clearProjectVersionCache(projectId: string): Promise<void> {
  try {
    const keys = await runStoreOn<IDBValidKey[]>(STORE, 'readonly', (store) => store.index('byProject').getAllKeys(projectId));
    if (!keys?.length) {
      return;
    }
    await runStoreOn(STORE, 'readwrite', (store) => {
      for (const key of keys) {
        store.delete(key);
      }
      return store.get(keys[0]);
    });
  } catch {
    return;
  }
}

export async function reconcileOwnerVersions(
  projectId: string,
  ownerKey: string,
  metas: ProjectPageVersionMetaDto[],
  fetchFull: (versionId: string) => Promise<ProjectPageVersionDto>,
): Promise<{ versions: ProjectPageVersionDto[]; changedIds: string[] }> {
  const cached = await readOwnerVersionCache(projectId, ownerKey);
  const cachedById = new Map(cached.map((version) => [version.id, version]));
  const changedIds: string[] = [];
  const versions: ProjectPageVersionDto[] = [];
  for (const meta of metas) {
    const local = cachedById.get(meta.id);
    if (local?.lastModified && local.lastModified === meta.lastModified) {
      versions.push({
        ...local,
        versionNo: meta.versionNo,
        description: meta.description,
        lastModified: meta.lastModified,
      });
      continue;
    }
    const full = await fetchFull(meta.id);
    versions.push(full);
    changedIds.push(full.id);
  }
  await writeOwnerVersionCache(projectId, ownerKey, versions);
  return { versions, changedIds };
}
