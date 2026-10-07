import type { ProjectPageVersionDto, ProjectPageVersionMetaDto } from '@vanstack/shared';

export function retainProjectVersionCache() {
  return 0;
}

export function releaseProjectVersionCache(projectId: string, token: number) {
  void projectId;
  void token;
}

export async function readOwnerVersionCache(projectId: string, ownerKey: string): Promise<ProjectPageVersionDto[]> {
  void projectId;
  void ownerKey;
  return [];
}

export async function writeOwnerVersionCache(
  projectId: string,
  ownerKey: string,
  versions: ProjectPageVersionDto[],
): Promise<void> {
  void projectId;
  void ownerKey;
  void versions;
}

export async function putCachedVersion(projectId: string, ownerKey: string, version: ProjectPageVersionDto): Promise<void> {
  void projectId;
  void ownerKey;
  void version;
}

export async function clearProjectVersionCache(projectId: string): Promise<void> {
  void projectId;
}

export async function reconcileOwnerVersions(
  projectId: string,
  ownerKey: string,
  metas: ProjectPageVersionMetaDto[],
  fetchFull: (versionId: string) => Promise<ProjectPageVersionDto>,
): Promise<{ versions: ProjectPageVersionDto[]; changedIds: string[] }> {
  void projectId;
  void ownerKey;
  const versions: ProjectPageVersionDto[] = [];
  const changedIds: string[] = [];
  for (const meta of metas) {
    const full = await fetchFull(meta.id);
    versions.push(full);
    changedIds.push(full.id);
  }
  return { versions, changedIds };
}
