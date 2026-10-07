import { readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import {
  EMPTY_PAGE_DOCUMENT,
  isPageMethodId,
  isWidgetEventId,
  normalizePageDocument,
  parseEventSource,
  type PageXmlDocument,
} from '@vanstack/xml';
import {
  ApiError,
  clearChange,
  markChange,
  mongoFile,
  newId,
  ossFile,
  projectDir,
  readChange,
  readJson,
  removeProjectDir,
  writeJson,
  type ChangeEntry,
} from './disk';

type ProjectRecord = {
  _id: string;
  name: string;
  key: string;
  description: string;
  currentVersionId: string | null;
  namespace?: Array<{ name: string; versionId: string }>;
  createdAt: string;
  updatedAt: string;
};

type PageRecord = {
  id: string;
  name: string;
  key: string;
  description: string;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProjectVersionRecord = {
  _id: string;
  projectId: string;
  projectKey: string;
  versionNo: number;
  description: string;
  pages: PageRecord[];
  langVersionId: string;
  assetVersionId: string;
  iconVersionId: string;
  createdAt: string;
  updatedAt: string;
};

type SnapshotRecord = PageXmlDocument & {
  _id: string;
  projectId: string;
  projectKey: string;
  pageId: string;
  pageKey: string;
  uses: number;
  createdAt?: string;
  updatedAt: string;
};

type ComponentRecord = {
  _id: string;
  projectId: string;
  projectKey: string;
  name: string;
  key: string;
  description: string;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
};

type ComponentVersionRecord = PageXmlDocument & {
  _id: string;
  projectId: string;
  projectKey: string;
  componentId: string;
  componentKey: string;
  versionNo: number;
  description?: string;
  createdAt?: string;
  updatedAt: string;
};

type LangRecord = {
  _id: string;
  projectId: string;
  projectKey: string;
  uses: number;
  langs: Array<{ key: string; name: string; dir: 'ltr' | 'rtl'; sortOrder: number }>;
  langValues: Array<{ groupKey: string; entryKey: string; langKey: string; value: string; sortOrder: number }>;
  updatedAt: string;
};

type LibraryFile = { name: string; key: string; size: number; contentType?: string };
type LibraryGroup = { name: string; files: LibraryFile[] };
type LibraryRecord = {
  _id: string;
  projectId: string;
  projectKey: string;
  uses: number;
  groups: LibraryGroup[];
  updatedAt: string;
};

type NamespaceVersion = {
  _id: string;
  projectId: string;
  projectKey: string;
  uses: number;
  types: unknown[];
  data: unknown[];
  updatedAt: string;
};

type FunctionRecord = {
  projectId: string;
  projectKey: string;
  id: string;
  code?: string;
  uses: number;
  updatedAt: string;
};

type EventRecord = {
  projectId: string;
  projectKey: string;
  id: string;
  source: string;
  uses: number;
  updatedAt: string;
};

const KEY_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

function now(): string {
  return new Date().toISOString();
}

function contentOf(record: PageXmlDocument): PageXmlDocument {
  return {
    widgets: record.widgets,
    ...(record.style ? { style: record.style } : {}),
    ...(record.data && record.data.length > 0 ? { data: record.data } : {}),
    ...(record.events ? { events: record.events } : {}),
    ...(record.methods && record.methods.length > 0 ? { methods: record.methods } : {}),
    ...(record.props && record.props.length > 0 ? { props: record.props } : {}),
    ...(record.query && record.query.length > 0 ? { query: record.query } : {}),
    ...(record.emits && record.emits.length > 0 ? { emits: record.emits } : {}),
    ...(record.testData ? { testData: record.testData } : {}),
  };
}

function applyDocument(version: PageXmlDocument, next: PageXmlDocument) {
  version.widgets = next.widgets;
  assign(version, 'style', next.style);
  assign(version, 'data', next.data && next.data.length > 0 ? next.data : undefined);
  assign(version, 'events', next.events);
  assign(version, 'methods', next.methods && next.methods.length > 0 ? next.methods : undefined);
  assign(version, 'props', next.props && next.props.length > 0 ? next.props : undefined);
  assign(version, 'query', next.query && next.query.length > 0 ? next.query : undefined);
  assign(version, 'emits', next.emits && next.emits.length > 0 ? next.emits : undefined);
  assign(version, 'testData', next.testData);
}

function assign(target: object, key: string, value: unknown) {
  if (value === undefined) {
    delete (target as Record<string, unknown>)[key];
    return;
  }
  (target as Record<string, unknown>)[key] = value;
}

function fileUrl(key: string): string {
  return `/api/files/content/${encodeURIComponent(key)}`;
}

export class LocalLowcode {
  async listProjects() {
    const { listProjectIds } = await import('./disk');
    const ids = await listProjectIds();
    const projects = [];
    for (const id of ids) {
      const project = await this.readProject(id);
      if (project) {
        projects.push(this.toProject(project));
      }
    }
    projects.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return projects;
  }

  async createProject(input: { name?: string; key?: string; description?: string }) {
    const name = requiredName(input.name);
    const key = requiredKey(input.key);
    if (await this.keyTaken(key)) {
      throw new ApiError(409, 'key already exists');
    }
    const id = newId();
    const stamp = now();
    const langId = newId();
    const assetId = newId();
    const iconId = newId();
    const versionId = newId();
    await mkdir(projectDir(id), { recursive: true });
    const project: ProjectRecord = {
      _id: id,
      name,
      key,
      description: input.description?.trim() ?? '',
      currentVersionId: versionId,
      namespace: [],
      createdAt: stamp,
      updatedAt: stamp,
    };
    await this.writeDoc(id, 'project.json', project);
    await this.writeDoc(id, `lang.version/${langId}.json`, emptyLang(id, key, langId, stamp));
    await this.writeDoc(id, `asset.version/${assetId}.json`, emptyLibrary(id, key, assetId, stamp));
    await this.writeDoc(id, `icon.version/${iconId}.json`, emptyLibrary(id, key, iconId, stamp));
    await this.writeDoc(id, `project.version/${versionId}.json`, {
      _id: versionId,
      projectId: id,
      projectKey: key,
      versionNo: 1,
      description: '',
      pages: [],
      langVersionId: langId,
      assetVersionId: assetId,
      iconVersionId: iconId,
      createdAt: stamp,
      updatedAt: stamp,
    } satisfies ProjectVersionRecord);
    return this.toProject(project);
  }

  async getProject(id: string) {
    return this.toProject(await this.requireProject(id));
  }

  async updateProject(id: string, input: { name?: string; key?: string; description?: string }) {
    const project = await this.requireProject(id);
    const previous = project.key;
    if (input.name != null) {
      project.name = requiredName(input.name);
    }
    if (input.key != null) {
      const key = requiredKey(input.key);
      if (key !== project.key && (await this.keyTaken(key, id))) {
        throw new ApiError(409, 'key already exists');
      }
      project.key = key;
    }
    if (input.description != null) {
      project.description = input.description.trim();
    }
    project.updatedAt = now();
    await this.writeDoc(id, 'project.json', project);
    if (project.key !== previous) {
      await this.rewriteProjectKey(id, project.key);
    }
    return this.toProject(project);
  }

  async deleteProject(id: string) {
    await this.requireProject(id);
    await removeProjectDir(id);
  }

  async changes(id: string) {
    await this.requireProject(id);
    return readChange(id);
  }

  async listVersions(id: string) {
    await this.requireProject(id);
    const rows = await this.readVersions(id);
    return rows.map(toVersionDto);
  }

  async createVersion(id: string, input: { source?: string; copyFromId?: string }) {
    const project = await this.requireProject(id);
    const existing = await this.readVersions(id);
    const versionNo = existing.reduce((max, version) => Math.max(max, version.versionNo), 0) + 1;
    const stamp = now();
    let saved: ProjectVersionRecord;
    if (input.source === 'copy') {
      const source = existing.find((version) => version._id === input.copyFromId);
      if (!source) {
        throw new ApiError(404, 'version not found');
      }
      saved = {
        ...source,
        _id: newId(),
        versionNo,
        description: '',
        pages: source.pages.map((page) => ({ ...page })),
        createdAt: stamp,
        updatedAt: stamp,
      };
      await this.retainShares(id, saved);
    } else {
      const langId = newId();
      const assetId = newId();
      const iconId = newId();
      await this.writeDoc(id, `lang.version/${langId}.json`, emptyLang(id, project.key, langId, stamp));
      await this.writeDoc(id, `asset.version/${assetId}.json`, emptyLibrary(id, project.key, assetId, stamp));
      await this.writeDoc(id, `icon.version/${iconId}.json`, emptyLibrary(id, project.key, iconId, stamp));
      saved = {
        _id: newId(),
        projectId: id,
        projectKey: project.key,
        versionNo,
        description: '',
        pages: [],
        langVersionId: langId,
        assetVersionId: assetId,
        iconVersionId: iconId,
        createdAt: stamp,
        updatedAt: stamp,
      };
    }
    await this.writeDoc(id, `project.version/${saved._id}.json`, saved);
    if (!project.currentVersionId) {
      project.currentVersionId = saved._id;
      project.updatedAt = stamp;
      await this.writeDoc(id, 'project.json', project);
    }
    return toVersionDto(saved);
  }

  async deleteVersion(id: string, versionId: string) {
    const project = await this.requireProject(id);
    const version = await this.requireVersion(id, versionId);
    await this.deleteDoc(id, `project.version/${version._id}.json`);
    await this.releaseShares(id, version);
    if (project.currentVersionId === version._id) {
      const rest = (await this.readVersions(id)).sort((a, b) => b.versionNo - a.versionNo);
      project.currentVersionId = rest[0]?._id ?? null;
      project.updatedAt = now();
      await this.writeDoc(id, 'project.json', project);
    }
  }

  async getLangs(id: string, versionId: string) {
    const version = await this.requireVersion(id, versionId);
    return catalogOf(await this.readLang(id, version.langVersionId));
  }

  async putLangs(id: string, versionId: string, input: { langs?: unknown[]; groups?: unknown[] }) {
    const project = await this.requireProject(id);
    const version = await this.requireVersion(id, versionId);
    const lang = await this.writableLang(id, version);
    const catalog = parseCatalog(input);
    lang.langs = catalog.langs.map((item, index) => ({ ...item, sortOrder: index }));
    lang.langValues = catalog.values;
    lang.updatedAt = now();
    await this.writeDoc(id, `lang.version/${lang._id}.json`, lang);
    if (project.currentVersionId === version._id) {
      await this.writeLangSnapshots(id, project, version, lang);
    }
    return catalogOf(lang);
  }

  async listPages(id: string, versionId: string) {
    const version = await this.requireVersion(id, versionId);
    return version.pages.map((page) => toPage(id, page));
  }

  async createPage(id: string, versionId: string, input: { name?: string; key?: string; description?: string }) {
    const project = await this.requireProject(id);
    const version = await this.requireVersion(id, versionId);
    const key = requiredKey(input.key);
    if (version.pages.some((page) => page.key === key)) {
      throw new ApiError(409, 'key already exists');
    }
    const stamp = now();
    const pageId = newId();
    const snapshotId = newId();
    const document = contentOf(normalizePageDocument(EMPTY_PAGE_DOCUMENT));
    const snapshot: SnapshotRecord = {
      _id: snapshotId,
      projectId: id,
      projectKey: project.key,
      pageId,
      pageKey: key,
      uses: 1,
      createdAt: stamp,
      updatedAt: stamp,
      ...document,
    };
    const page: PageRecord = {
      id: pageId,
      name: requiredName(input.name),
      key,
      description: input.description?.trim() ?? '',
      currentVersionId: snapshotId,
      createdAt: stamp,
      updatedAt: stamp,
    };
    version.pages.push(page);
    version.updatedAt = stamp;
    await this.writeDoc(id, `page.version/${snapshotId}.json`, snapshot);
    await this.writeDoc(id, `project.version/${version._id}.json`, version);
    return toPage(id, page);
  }

  async updatePage(
    id: string,
    versionId: string,
    pageId: string,
    input: { name?: string; key?: string; description?: string },
  ) {
    const version = await this.requireVersion(id, versionId);
    const page = pageIn(version, pageId);
    if (input.name != null) {
      page.name = requiredName(input.name);
    }
    if (input.key != null) {
      const key = requiredKey(input.key);
      if (version.pages.some((item) => item.id !== page.id && item.key === key)) {
        throw new ApiError(409, 'key already exists');
      }
      page.key = key;
    }
    if (input.description != null) {
      page.description = input.description.trim();
    }
    page.updatedAt = now();
    version.updatedAt = page.updatedAt;
    await this.writeDoc(id, `project.version/${version._id}.json`, version);
    if (page.currentVersionId) {
      const snapshot = await this.readSnapshot(id, page.currentVersionId);
      if (snapshot && snapshot.uses <= 1 && snapshot.pageKey !== page.key) {
        snapshot.pageKey = page.key;
        snapshot.updatedAt = page.updatedAt;
        await this.writeDoc(id, `page.version/${snapshot._id}.json`, snapshot);
      }
    }
    return toPage(id, page);
  }

  async deletePage(id: string, versionId: string, pageId: string) {
    const version = await this.requireVersion(id, versionId);
    const page = pageIn(version, pageId);
    version.pages = version.pages.filter((item) => item.id !== page.id);
    version.updatedAt = now();
    await this.writeDoc(id, `project.version/${version._id}.json`, version);
    if (page.currentVersionId) {
      await this.releaseSnapshot(id, version, page.currentVersionId);
    }
  }

  async getPageDocument(id: string, versionId: string, pageId: string) {
    const version = await this.requireVersion(id, versionId);
    const page = pageIn(version, pageId);
    const snapshot = await this.requireSnapshot(id, page);
    return toSnapshot(snapshot);
  }

  async updatePageDocument(id: string, versionId: string, pageId: string, input: { document?: unknown }) {
    const project = await this.requireProject(id);
    const version = await this.requireVersion(id, versionId);
    const page = pageIn(version, pageId);
    const originalId = page.currentVersionId;
    const snapshot = await this.writableSnapshot(id, version, page);
    const next = normalizePageDocument(input.document);
    applyDocument(snapshot, contentOf(next));
    snapshot.updatedAt = now();
    await this.writeDoc(id, `page.version/${snapshot._id}.json`, snapshot);
    if (project.currentVersionId === version._id) {
      const lang = await this.readLang(id, version.langVersionId);
      if (lang) {
        await this.writeLangSnapshots(id, project, version, lang);
      }
    }
    return { ...toSnapshot(snapshot), forked: snapshot._id !== originalId };
  }

  async listComponents(id: string) {
    await this.requireProject(id);
    const rows = await this.readComponents(id);
    return rows.map(toComponent);
  }

  async createComponent(id: string, input: { name?: string; key?: string; description?: string }) {
    const project = await this.requireProject(id);
    const key = requiredKey(input.key);
    const existing = await this.readComponents(id);
    if (existing.some((item) => item.key === key)) {
      throw new ApiError(409, 'key already exists');
    }
    const stamp = now();
    const componentId = newId();
    const versionId = newId();
    const document = contentOf(normalizePageDocument(EMPTY_PAGE_DOCUMENT));
    const component: ComponentRecord = {
      _id: componentId,
      projectId: id,
      projectKey: project.key,
      name: requiredName(input.name),
      key,
      description: input.description?.trim() ?? '',
      currentVersionId: versionId,
      createdAt: stamp,
      updatedAt: stamp,
    };
    const version: ComponentVersionRecord = {
      _id: versionId,
      projectId: id,
      projectKey: project.key,
      componentId,
      componentKey: key,
      versionNo: 1,
      description: '',
      createdAt: stamp,
      updatedAt: stamp,
      ...document,
    };
    await this.writeDoc(id, `component/${componentId}.json`, component);
    await this.writeDoc(id, `component.version/${versionId}.json`, version);
    return toComponent(component);
  }

  async updateComponent(id: string, componentId: string, input: { name?: string; key?: string; description?: string }) {
    const component = await this.requireComponent(id, componentId);
    if (input.name != null) {
      component.name = requiredName(input.name);
    }
    if (input.key != null) {
      const key = requiredKey(input.key);
      const existing = await this.readComponents(id);
      if (existing.some((item) => item._id !== component._id && item.key === key)) {
        throw new ApiError(409, 'key already exists');
      }
      component.key = key;
    }
    if (input.description != null) {
      component.description = input.description.trim();
    }
    component.updatedAt = now();
    await this.writeDoc(id, `component/${component._id}.json`, component);
    const versions = await this.readComponentVersions(id, component._id);
    for (const version of versions) {
      if (version.componentKey !== component.key) {
        version.componentKey = component.key;
        version.updatedAt = component.updatedAt;
        await this.writeDoc(id, `component.version/${version._id}.json`, version);
      }
    }
    return toComponent(component);
  }

  async deleteComponent(id: string, componentId: string) {
    const component = await this.requireComponent(id, componentId);
    const versions = await this.readComponentVersions(id, component._id);
    for (const version of versions) {
      await this.deleteDoc(id, `component.version/${version._id}.json`);
    }
    await this.deleteDoc(id, `component/${component._id}.json`);
  }

  async listComponentVersionMeta(id: string, componentId: string) {
    await this.requireComponent(id, componentId);
    const rows = await this.readComponentVersions(id, componentId);
    return rows.map((version) => ({
      id: version._id,
      pageId: componentId,
      versionNo: version.versionNo,
      description: version.description ?? '',
      lastModified: version.updatedAt,
    }));
  }

  async getComponentVersion(id: string, componentId: string, versionId: string) {
    const version = await this.requireComponentVersion(id, componentId, versionId);
    return toComponentVersion(version);
  }

  async updateComponentVersion(
    id: string,
    componentId: string,
    versionId: string,
    input: { document?: unknown; description?: string },
  ) {
    const component = await this.requireComponent(id, componentId);
    const version = await this.requireComponentVersion(id, componentId, versionId);
    if (input.description != null) {
      version.description = input.description.trim();
    }
    if (input.document != null) {
      applyDocument(version, contentOf(normalizePageDocument(input.document)));
    }
    version.updatedAt = now();
    await this.writeDoc(id, `component.version/${version._id}.json`, version);
    component.updatedAt = version.updatedAt;
    await this.writeDoc(id, `component/${component._id}.json`, component);
    return toComponentVersion(version);
  }

  async listGroups(id: string, versionId: string, kind: 'asset' | 'icon') {
    const library = await this.libraryOf(id, versionId, kind);
    return library.groups.map((group) => ({ name: group.name })).sort((a, b) => a.name.localeCompare(b.name));
  }

  async createGroup(id: string, versionId: string, kind: 'asset' | 'icon', name: string) {
    const group = assertGroupName(name);
    await this.editLibrary(id, versionId, kind, (library) => {
      if (library.groups.some((item) => item.name === group)) {
        throw new ApiError(409, 'group already exists');
      }
      library.groups.push({ name: group, files: [] });
    });
    return { name: group };
  }

  async renameGroup(id: string, versionId: string, kind: 'asset' | 'icon', fromName: string, toName: string) {
    const from = assertGroupName(fromName);
    const to = assertGroupName(toName);
    await this.editLibrary(id, versionId, kind, (library) => {
      const group = library.groups.find((item) => item.name === from);
      if (!group) {
        throw new ApiError(404, 'group not found');
      }
      if (from !== to && library.groups.some((item) => item.name === to)) {
        throw new ApiError(409, 'group already exists');
      }
      group.name = to;
    });
    return { name: to };
  }

  async deleteGroup(id: string, versionId: string, kind: 'asset' | 'icon', name: string) {
    const groupName = assertGroupName(name);
    const removed: string[] = [];
    await this.editLibrary(id, versionId, kind, (library) => {
      const index = library.groups.findIndex((item) => item.name === groupName);
      if (index < 0) {
        throw new ApiError(404, 'group not found');
      }
      removed.push(...library.groups[index].files.map((file) => file.key));
      library.groups.splice(index, 1);
    });
    for (const key of removed) {
      await this.removeObject(id, key);
    }
  }

  async listFiles(id: string, versionId: string, kind: 'asset' | 'icon', name: string) {
    const library = await this.libraryOf(id, versionId, kind);
    const group = library.groups.find((item) => item.name === assertGroupName(name));
    if (!group) {
      throw new ApiError(404, 'group not found');
    }
    return group.files
      .map((file) => ({ name: file.name, key: file.key, url: fileUrl(file.key), size: file.size }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async uploadFile(
    id: string,
    versionId: string,
    kind: 'asset' | 'icon',
    groupName: string,
    file: { originalName: string; mime: string; body: Buffer },
    displayName?: string,
  ) {
    const project = await this.requireProject(id);
    const group = assertGroupName(groupName);
    const fileName = assertFileName(uploadName(file.originalName, displayName), kind);
    const key = `lowcode/${project.key}/blobs/${newId()}/${fileName}`;
    await this.writeObject(id, key, file.body, file.mime || (kind === 'icon' ? 'image/svg+xml' : 'application/octet-stream'));
    try {
      await this.editLibrary(id, versionId, kind, (library) => {
        const target = library.groups.find((item) => item.name === group);
        if (!target) {
          throw new ApiError(404, 'group not found');
        }
        if (target.files.some((item) => item.name === fileName)) {
          throw new ApiError(409, 'file already exists');
        }
        target.files.push({ name: fileName, key, size: file.body.length, contentType: file.mime });
      });
    } catch (error) {
      await this.removeObject(id, key);
      throw error;
    }
    return { name: fileName, key, url: fileUrl(key), size: file.body.length };
  }

  async deleteFile(id: string, versionId: string, kind: 'asset' | 'icon', groupName: string, fileName: string) {
    const group = assertGroupName(groupName);
    const name = assertFileName(fileName, kind);
    let removed = '';
    await this.editLibrary(id, versionId, kind, (library) => {
      const target = library.groups.find((item) => item.name === group);
      const file = target?.files.find((item) => item.name === name);
      if (!target || !file) {
        throw new ApiError(404, 'file not found');
      }
      removed = file.key;
      target.files = target.files.filter((item) => item.name !== name);
    });
    if (removed) {
      await this.removeObject(id, removed);
    }
  }

  async listNamespaces(id: string) {
    const project = await this.requireProject(id);
    return (project.namespace ?? []).map((item) => ({ name: item.name, versionId: item.versionId }));
  }

  async createNamespace(id: string, name: string) {
    const project = await this.requireProject(id);
    const trimmed = namespaceName(name);
    const list = project.namespace ?? [];
    if (list.some((item) => item.name === trimmed)) {
      throw new ApiError(409, 'namespace already exists');
    }
    const stamp = now();
    const versionId = newId();
    await this.writeDoc(id, `namespace.version/${versionId}.json`, {
      _id: versionId,
      projectId: id,
      projectKey: project.key,
      uses: 1,
      types: [],
      data: [],
      updatedAt: stamp,
    } satisfies NamespaceVersion);
    project.namespace = [...list, { name: trimmed, versionId }];
    project.updatedAt = stamp;
    await this.writeDoc(id, 'project.json', project);
    return { name: trimmed, versionId };
  }

  async renameNamespace(id: string, name: string, nextName: string) {
    const project = await this.requireProject(id);
    const trimmed = namespaceName(nextName);
    const list = project.namespace ?? [];
    const index = list.findIndex((item) => item.name === name);
    if (index < 0) {
      throw new ApiError(404, 'namespace not found');
    }
    if (trimmed !== name && list.some((item) => item.name === trimmed)) {
      throw new ApiError(409, 'namespace already exists');
    }
    const next = list.map((item, itemIndex) => (itemIndex === index ? { ...item, name: trimmed } : item));
    project.namespace = next;
    project.updatedAt = now();
    await this.writeDoc(id, 'project.json', project);
    return next[index];
  }

  async deleteNamespace(id: string, name: string) {
    const project = await this.requireProject(id);
    const found = (project.namespace ?? []).find((item) => item.name === name);
    if (!found) {
      throw new ApiError(404, 'namespace not found');
    }
    project.namespace = (project.namespace ?? []).filter((item) => item.name !== name);
    project.updatedAt = now();
    await this.writeDoc(id, 'project.json', project);
    await this.deleteDoc(id, `namespace.version/${found.versionId}.json`);
  }

  async getNamespace(id: string, name: string) {
    const project = await this.requireProject(id);
    const found = (project.namespace ?? []).find((item) => item.name === name);
    if (!found) {
      throw new ApiError(404, 'namespace not found');
    }
    const version = await readJson<NamespaceVersion>(mongoFile(id, `namespace.version/${found.versionId}.json`));
    if (!version) {
      throw new ApiError(404, 'namespace not found');
    }
    return { name: found.name, versionId: version._id, types: version.types, data: version.data };
  }

  async putNamespace(id: string, name: string, input: { types?: unknown[]; data?: unknown[] }) {
    const project = await this.requireProject(id);
    const found = (project.namespace ?? []).find((item) => item.name === name);
    if (!found) {
      throw new ApiError(404, 'namespace not found');
    }
    const version = await readJson<NamespaceVersion>(mongoFile(id, `namespace.version/${found.versionId}.json`));
    if (!version) {
      throw new ApiError(404, 'namespace not found');
    }
    version.types = Array.isArray(input.types) ? input.types : [];
    version.data = Array.isArray(input.data) ? input.data : [];
    version.updatedAt = now();
    await this.writeDoc(id, `namespace.version/${version._id}.json`, version);
    return { name: found.name, versionId: version._id, types: version.types, data: version.data };
  }

  async getMethod(id: string, methodId: string) {
    await this.requireProject(id);
    if (!isPageMethodId(methodId)) {
      throw new ApiError(400, 'Invalid method id');
    }
    const current = await readJson<FunctionRecord>(mongoFile(id, `function/${methodId}.json`));
    if (typeof current?.code !== 'string') {
      throw new ApiError(404, 'method not found');
    }
    return { id: methodId, code: current.code, forked: false };
  }

  async putMethod(id: string, methodId: string, code: string) {
    const project = await this.requireProject(id);
    if (!isPageMethodId(methodId)) {
      throw new ApiError(400, 'Invalid method id');
    }
    const current = await readJson<FunctionRecord>(mongoFile(id, `function/${methodId}.json`));
    if ((current?.uses ?? 0) > 1) {
      const nextId = newId();
      await this.writeDoc(id, `function/${nextId}.json`, {
        projectId: id,
        projectKey: project.key,
        id: nextId,
        code,
        uses: 1,
        updatedAt: now(),
      } satisfies FunctionRecord);
      return { id: nextId, code, forked: true };
    }
    await this.writeDoc(id, `function/${methodId}.json`, {
      projectId: id,
      projectKey: project.key,
      id: methodId,
      code,
      uses: current?.uses ?? 0,
      updatedAt: now(),
    } satisfies FunctionRecord);
    return { id: methodId, code, forked: false };
  }

  async getEvent(id: string, eventId: string) {
    await this.requireProject(id);
    if (!isWidgetEventId(eventId)) {
      throw new ApiError(400, 'Invalid event id');
    }
    const current = await readJson<EventRecord>(mongoFile(id, `event/${eventId}.json`));
    if (!current) {
      throw new ApiError(404, 'event not found');
    }
    return { id: eventId, source: current.source, forked: false };
  }

  async putEvent(id: string, eventId: string, source: string) {
    const project = await this.requireProject(id);
    if (!isWidgetEventId(eventId)) {
      throw new ApiError(400, 'Invalid event id');
    }
    if (!parseEventSource(source)) {
      throw new ApiError(400, 'Invalid event script');
    }
    const current = await readJson<EventRecord>(mongoFile(id, `event/${eventId}.json`));
    if ((current?.uses ?? 0) > 1) {
      const nextId = newId();
      await this.writeDoc(id, `event/${nextId}.json`, {
        projectId: id,
        projectKey: project.key,
        id: nextId,
        source,
        uses: 1,
        updatedAt: now(),
      } satisfies EventRecord);
      return { id: nextId, source, forked: true };
    }
    await this.writeDoc(id, `event/${eventId}.json`, {
      projectId: id,
      projectKey: project.key,
      id: eventId,
      source,
      uses: current?.uses ?? 0,
      updatedAt: now(),
    } satisfies EventRecord);
    return { id: eventId, source, forked: false };
  }

  async deleteEvent(id: string, eventId: string) {
    await this.requireProject(id);
    if (!isWidgetEventId(eventId)) {
      throw new ApiError(400, 'Invalid event id');
    }
    const current = await readJson<EventRecord>(mongoFile(id, `event/${eventId}.json`));
    if (!current || (current.uses ?? 0) > 0) {
      return;
    }
    await this.deleteDoc(id, `event/${eventId}.json`);
  }

  private async writeDoc(projectId: string, relativePath: string, value: unknown) {
    await writeJson(mongoFile(projectId, relativePath), value);
    await markChange(projectId, { path: `mongo/${relativePath.replace(/\\/g, '/')}`, op: 'write' });
  }

  private async deleteDoc(projectId: string, relativePath: string) {
    await rm(mongoFile(projectId, relativePath), { force: true });
    await markChange(projectId, { path: `mongo/${relativePath.replace(/\\/g, '/')}`, op: 'delete' });
  }

  private async writeObject(projectId: string, key: string, body: Buffer, contentType: string) {
    const filePath = ossFile(projectId, key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, body);
    await rememberType(projectId, key, contentType);
    await markChange(projectId, { path: `oss/${key}`, op: 'write', contentType });
  }

  private async removeObject(projectId: string, key: string) {
    await rm(ossFile(projectId, key), { force: true });
    await markChange(projectId, { path: `oss/${key}`, op: 'delete' });
  }

  private async readProject(id: string) {
    return readJson<ProjectRecord>(mongoFile(id, 'project.json'));
  }

  private async requireProject(id: string) {
    const project = await this.readProject(id);
    if (!project) {
      throw new ApiError(404, 'project not found');
    }
    project.namespace ??= [];
    return project;
  }

  private async readVersions(id: string) {
    return readCollection<ProjectVersionRecord>(id, 'project.version');
  }

  private async requireVersion(id: string, versionId: string) {
    await this.requireProject(id);
    const version = await readJson<ProjectVersionRecord>(mongoFile(id, `project.version/${versionId}.json`));
    if (!version || version.projectId !== id) {
      throw new ApiError(404, 'version not found');
    }
    version.pages ??= [];
    return version;
  }

  private async readComponents(id: string) {
    return readCollection<ComponentRecord>(id, 'component');
  }

  private async requireComponent(id: string, componentId: string) {
    await this.requireProject(id);
    const component = await readJson<ComponentRecord>(mongoFile(id, `component/${componentId}.json`));
    if (!component || component.projectId !== id) {
      throw new ApiError(404, 'component not found');
    }
    return component;
  }

  private async readComponentVersions(id: string, componentId: string) {
    const rows = await readCollection<ComponentVersionRecord>(id, 'component.version');
    return rows.filter((row) => row.componentId === componentId).sort((a, b) => a.versionNo - b.versionNo);
  }

  private async requireComponentVersion(id: string, componentId: string, versionId: string) {
    const version = await readJson<ComponentVersionRecord>(mongoFile(id, `component.version/${versionId}.json`));
    if (!version || version.componentId !== componentId) {
      throw new ApiError(404, 'version not found');
    }
    return version;
  }

  private async readSnapshot(id: string, snapshotId: string) {
    return readJson<SnapshotRecord>(mongoFile(id, `page.version/${snapshotId}.json`));
  }

  private async requireSnapshot(id: string, page: PageRecord) {
    if (!page.currentVersionId) {
      throw new ApiError(404, 'page not found');
    }
    const snapshot = await this.readSnapshot(id, page.currentVersionId);
    if (!snapshot || snapshot.pageId !== page.id) {
      throw new ApiError(404, 'page not found');
    }
    return snapshot;
  }

  private async writableSnapshot(id: string, version: ProjectVersionRecord, page: PageRecord) {
    const snapshot = await this.requireSnapshot(id, page);
    if ((snapshot.uses ?? 1) <= 1) {
      return snapshot;
    }
    const stamp = now();
    const copy: SnapshotRecord = {
      ...snapshot,
      _id: newId(),
      uses: 1,
      pageKey: page.key,
      createdAt: stamp,
      updatedAt: stamp,
    };
    await this.writeDoc(id, `page.version/${copy._id}.json`, copy);
    page.currentVersionId = copy._id;
    page.updatedAt = stamp;
    version.updatedAt = stamp;
    await this.writeDoc(id, `project.version/${version._id}.json`, version);
    const still = version.pages.some((item) => item.currentVersionId === snapshot._id);
    if (!still) {
      snapshot.uses = Math.max(0, (snapshot.uses ?? 1) - 1);
      snapshot.updatedAt = stamp;
      await this.writeDoc(id, `page.version/${snapshot._id}.json`, snapshot);
    }
    return copy;
  }

  private async readLang(id: string, langId: string) {
    return readJson<LangRecord>(mongoFile(id, `lang.version/${langId}.json`));
  }

  private async writableLang(id: string, version: ProjectVersionRecord) {
    const current = await this.readLang(id, version.langVersionId);
    if (!current) {
      throw new ApiError(404, 'langs not found');
    }
    if ((current.uses ?? 1) <= 1) {
      return current;
    }
    const copy: LangRecord = {
      ...current,
      _id: newId(),
      uses: 1,
      langs: current.langs.map((lang) => ({ ...lang })),
      langValues: current.langValues.map((row) => ({ ...row })),
      updatedAt: now(),
    };
    await this.writeDoc(id, `lang.version/${copy._id}.json`, copy);
    current.uses = Math.max(0, (current.uses ?? 1) - 1);
    await this.writeDoc(id, `lang.version/${current._id}.json`, current);
    version.langVersionId = copy._id;
    version.updatedAt = now();
    await this.writeDoc(id, `project.version/${version._id}.json`, version);
    return copy;
  }

  private async libraryOf(id: string, versionId: string, kind: 'asset' | 'icon') {
    const version = await this.requireVersion(id, versionId);
    const libraryId = kind === 'asset' ? version.assetVersionId : version.iconVersionId;
    const library = await readJson<LibraryRecord>(mongoFile(id, `${kind}.version/${libraryId}.json`));
    if (!library) {
      throw new ApiError(404, 'library not found');
    }
    return library;
  }

  private async editLibrary(
    id: string,
    versionId: string,
    kind: 'asset' | 'icon',
    mutate: (library: LibraryRecord) => void,
  ) {
    const version = await this.requireVersion(id, versionId);
    const libraryId = kind === 'asset' ? version.assetVersionId : version.iconVersionId;
    const current = await readJson<LibraryRecord>(mongoFile(id, `${kind}.version/${libraryId}.json`));
    if (!current) {
      throw new ApiError(404, 'library not found');
    }
    let library = current;
    if ((current.uses ?? 1) > 1) {
      library = {
        ...current,
        _id: newId(),
        uses: 1,
        groups: current.groups.map((group) => ({ name: group.name, files: group.files.map((file) => ({ ...file })) })),
        updatedAt: now(),
      };
      current.uses = Math.max(0, (current.uses ?? 1) - 1);
      await this.writeDoc(id, `${kind}.version/${current._id}.json`, current);
      if (kind === 'asset') {
        version.assetVersionId = library._id;
      } else {
        version.iconVersionId = library._id;
      }
      version.updatedAt = now();
      await this.writeDoc(id, `project.version/${version._id}.json`, version);
    }
    mutate(library);
    library.updatedAt = now();
    await this.writeDoc(id, `${kind}.version/${library._id}.json`, library);
  }

  private async retainShares(id: string, version: ProjectVersionRecord) {
    await this.bump(id, `lang.version/${version.langVersionId}.json`, 1);
    await this.bump(id, `asset.version/${version.assetVersionId}.json`, 1);
    await this.bump(id, `icon.version/${version.iconVersionId}.json`, 1);
    const seen = new Set<string>();
    for (const page of version.pages) {
      if (!page.currentVersionId || seen.has(page.currentVersionId)) {
        continue;
      }
      seen.add(page.currentVersionId);
      await this.bump(id, `page.version/${page.currentVersionId}.json`, 1);
    }
  }

  private async releaseShares(id: string, version: ProjectVersionRecord) {
    const pages = version.pages;
    version.pages = [];
    await this.bump(id, `lang.version/${version.langVersionId}.json`, -1);
    await this.bump(id, `asset.version/${version.assetVersionId}.json`, -1);
    await this.bump(id, `icon.version/${version.iconVersionId}.json`, -1);
    for (const page of pages) {
      if (page.currentVersionId) {
        await this.releaseSnapshot(id, version, page.currentVersionId);
      }
    }
  }

  private async releaseSnapshot(id: string, version: ProjectVersionRecord, snapshotId: string) {
    const still = version.pages.some((page) => page.currentVersionId === snapshotId);
    if (still) {
      return;
    }
    const snapshot = await this.readSnapshot(id, snapshotId);
    if (!snapshot) {
      return;
    }
    snapshot.uses = Math.max(0, (snapshot.uses ?? 1) - 1);
    if (snapshot.uses <= 0) {
      await this.deleteDoc(id, `page.version/${snapshotId}.json`);
      return;
    }
    await this.writeDoc(id, `page.version/${snapshotId}.json`, snapshot);
  }

  private async bump(id: string, relativePath: string, delta: number) {
    const record = await readJson<{ uses?: number }>(mongoFile(id, relativePath));
    if (!record) {
      return;
    }
    record.uses = Math.max(0, (record.uses ?? 1) + delta);
    await this.writeDoc(id, relativePath, record);
  }

  private async writeLangSnapshots(id: string, project: ProjectRecord, version: ProjectVersionRecord, lang: LangRecord) {
    const catalog = catalogOf(lang);
    if (catalog.langs.length === 0) {
      return;
    }
    for (const page of version.pages) {
      for (const item of catalog.langs) {
        const values: Record<string, string> = {};
        for (const group of catalog.groups) {
          for (const entry of group.entries) {
            const text = entry.values[item.key];
            if (text) {
              values[`${group.key}.${entry.key}`] = text;
            }
          }
        }
        const key = `lowcode/${project.key}/lang/${page.key}-v${version.versionNo}-${item.key}.json`;
        const body = Buffer.from(
          JSON.stringify({ key: item.key, name: item.name, dir: item.dir, values }),
          'utf8',
        );
        await this.writeObject(id, key, body, 'application/json');
      }
    }
  }

  private async keyTaken(key: string, exceptId?: string) {
    const { listProjectIds } = await import('./disk');
    for (const id of await listProjectIds()) {
      if (id === exceptId) {
        continue;
      }
      const project = await this.readProject(id);
      if (project?.key === key) {
        return true;
      }
    }
    return false;
  }

  private async rewriteProjectKey(id: string, projectKey: string) {
    const folders = [
      'project.version',
      'page.version',
      'component',
      'component.version',
      'function',
      'event',
      'lang.version',
      'asset.version',
      'icon.version',
      'namespace.version',
    ];
    for (const folder of folders) {
      const rows = await readCollection<Record<string, unknown> & { projectKey?: string }>(id, folder);
      for (const row of rows) {
        if (row.projectKey === projectKey) {
          continue;
        }
        row.projectKey = projectKey;
        const fileId = typeof row._id === 'string' ? row._id : typeof row.id === 'string' ? row.id : '';
        if (!fileId) {
          continue;
        }
        await this.writeDoc(id, `${folder}/${fileId}.json`, row);
      }
    }
  }

  private toProject(project: ProjectRecord) {
    return {
      id: project._id,
      name: project.name,
      key: project.key,
      description: project.description,
      currentVersionId: project.currentVersionId ?? null,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }
}

async function readCollection<T>(projectId: string, folder: string): Promise<T[]> {
  const { readdir } = await import('node:fs/promises');
  let names: string[] = [];
  try {
    names = await readdir(mongoFile(projectId, folder));
  } catch {
    return [];
  }
  const rows: T[] = [];
  for (const name of names) {
    if (!name.endsWith('.json')) {
      continue;
    }
    const row = await readJson<T>(mongoFile(projectId, `${folder}/${name}`));
    if (row) {
      rows.push(row);
    }
  }
  return rows;
}

async function rememberType(projectId: string, key: string, contentType: string) {
  const file = path.join(projectDir(projectId), 'content-types.json');
  const current = (await readJson<Record<string, string>>(file)) ?? {};
  current[key] = contentType;
  await writeJson(file, current);
}

export async function contentTypeOf(projectId: string, key: string): Promise<string> {
  const map = await readJson<Record<string, string>>(path.join(projectDir(projectId), 'content-types.json'));
  return map?.[key] ?? 'application/octet-stream';
}

function emptyLang(projectId: string, projectKey: string, id: string, stamp: string): LangRecord {
  return { _id: id, projectId, projectKey, uses: 1, langs: [], langValues: [], updatedAt: stamp };
}

function emptyLibrary(projectId: string, projectKey: string, id: string, stamp: string): LibraryRecord {
  return { _id: id, projectId, projectKey, uses: 1, groups: [], updatedAt: stamp };
}

function toVersionDto(version: ProjectVersionRecord) {
  return {
    id: version._id,
    projectId: version.projectId,
    versionNo: version.versionNo,
    description: version.description ?? '',
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
    lastModified: version.updatedAt,
  };
}

function toPage(projectId: string, page: PageRecord) {
  return {
    id: page.id,
    projectId,
    name: page.name,
    key: page.key,
    description: page.description,
    currentVersionId: page.currentVersionId,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };
}

function toSnapshot(snapshot: SnapshotRecord) {
  return {
    id: snapshot._id,
    pageId: snapshot.pageId,
    forked: false,
    document: contentOf(snapshot),
    updatedAt: snapshot.updatedAt,
    lastModified: snapshot.updatedAt,
  };
}

function toComponent(component: ComponentRecord) {
  return {
    id: component._id,
    projectId: component.projectId,
    name: component.name,
    key: component.key,
    description: component.description,
    currentVersionId: component.currentVersionId,
    createdAt: component.createdAt,
    updatedAt: component.updatedAt,
  };
}

function toComponentVersion(version: ComponentVersionRecord) {
  return {
    id: version._id,
    pageId: version.componentId,
    versionNo: version.versionNo,
    description: version.description ?? '',
    document: contentOf(version),
    createdAt: version.createdAt ?? version.updatedAt,
    updatedAt: version.updatedAt,
    lastModified: version.updatedAt,
  };
}

function pageIn(version: ProjectVersionRecord, pageId: string) {
  const page = version.pages.find((item) => item.id === pageId);
  if (!page) {
    throw new ApiError(404, 'page not found');
  }
  return page;
}

function requiredName(value: string | undefined) {
  const name = value?.trim() ?? '';
  if (!name) {
    throw new ApiError(400, 'name is required');
  }
  return name;
}

function requiredKey(value: string | undefined) {
  const key = value?.trim() ?? '';
  if (!KEY_PATTERN.test(key)) {
    throw new ApiError(400, 'invalid key');
  }
  return key;
}

function namespaceName(name: string) {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 64 || /[\s/\\]/.test(trimmed)) {
    throw new ApiError(400, 'invalid namespace name');
  }
  return trimmed;
}

function assertGroupName(name: string) {
  const trimmed = safeDecode(name).trim();
  if (!trimmed || trimmed.length > 64 || trimmed === '.' || trimmed === '..' || trimmed.startsWith('.') || /[\\/]/.test(trimmed)) {
    throw new ApiError(400, 'invalid group name');
  }
  return trimmed;
}

function assertFileName(name: string, kind: 'asset' | 'icon') {
  const trimmed = safeDecode(name).trim().replace(/[\\/]/g, '');
  if (!trimmed || trimmed === '.' || trimmed === '..' || trimmed === '.keep' || trimmed.length > 200) {
    throw new ApiError(400, 'invalid file name');
  }
  if (kind === 'icon' && !/\.svg$/i.test(trimmed)) {
    throw new ApiError(400, 'only svg files are allowed');
  }
  return trimmed;
}

function uploadName(originalName: string, displayName?: string) {
  const original = originalName.replace(/[\\/]/g, '').trim();
  const originalExt = original.includes('.') ? original.slice(original.lastIndexOf('.')) : '';
  const raw = (displayName ?? '').trim();
  if (!raw) {
    return original;
  }
  if (raw.includes('.') || !originalExt) {
    return raw;
  }
  return `${raw}${originalExt}`;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function catalogOf(record: LangRecord | null) {
  const langs = [...(record?.langs ?? [])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((row) => ({ key: row.key, name: row.name, dir: row.dir === 'rtl' ? 'rtl' as const : 'ltr' as const }));
  const groups: Array<{ key: string; entries: Array<{ key: string; values: Record<string, string> }> }> = [];
  const groupMap = new Map<string, (typeof groups)[number]>();
  for (const row of [...(record?.langValues ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)) {
    let group = groupMap.get(row.groupKey);
    if (!group) {
      group = { key: row.groupKey, entries: [] };
      groupMap.set(row.groupKey, group);
      groups.push(group);
    }
    let entry = group.entries.find((item) => item.key === row.entryKey);
    if (!entry) {
      entry = { key: row.entryKey, values: {} };
      group.entries.push(entry);
    }
    entry.values[row.langKey] = row.value;
  }
  return { langs, groups };
}

function parseCatalog(input: { langs?: unknown[]; groups?: unknown[] }) {
  const langs = (input.langs ?? []).map((item) => {
    const row = asRecord(item);
    const key = String(row.key ?? '').trim();
    if (!key) {
      throw new ApiError(400, 'invalid lang');
    }
    return { key, name: String(row.name ?? key), dir: row.dir === 'rtl' ? 'rtl' as const : 'ltr' as const };
  });
  const values: LangRecord['langValues'] = [];
  (input.groups ?? []).forEach((groupValue, groupIndex) => {
    const group = asRecord(groupValue);
    const groupKey = String(group.key ?? '').trim();
    const entries = Array.isArray(group.entries) ? group.entries : [];
    entries.forEach((entryValue, entryIndex) => {
      const entry = asRecord(entryValue);
      const entryKey = String(entry.key ?? '').trim();
      const map = asRecord(entry.values);
      for (const [langKey, text] of Object.entries(map)) {
        if (typeof text === 'string') {
          values.push({
            groupKey,
            entryKey,
            langKey,
            value: text,
            sortOrder: groupIndex * 10000 + entryIndex,
          });
        }
      }
    });
  });
  return { langs, groups: catalogOf({ langValues: values, langs: langs.map((lang, index) => ({ ...lang, sortOrder: index })) } as LangRecord).groups, values };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new ApiError(400, 'invalid payload');
  }
  return value as Record<string, unknown>;
}

export async function materializeBundle(projectId: string, bundle: Record<string, unknown>, objects: Array<{ key: string; body: Buffer; contentType: string }>) {
  const root = projectDir(projectId);
  await mkdir(root, { recursive: true });
  const project = bundle.project;
  if (!project || typeof project !== 'object') {
    throw new ApiError(400, 'invalid bundle');
  }
  await writeJson(mongoFile(projectId, 'project.json'), project);
  const folders: Array<[string, string]> = [
    ['projectVersions', 'project.version'],
    ['pageVersions', 'page.version'],
    ['components', 'component'],
    ['componentVersions', 'component.version'],
    ['functions', 'function'],
    ['events', 'event'],
    ['langVersions', 'lang.version'],
    ['assetVersions', 'asset.version'],
    ['iconVersions', 'icon.version'],
    ['namespaceVersions', 'namespace.version'],
  ];
  for (const [field, folder] of folders) {
    const rows = Array.isArray(bundle[field]) ? (bundle[field] as Array<Record<string, unknown>>) : [];
    for (const row of rows) {
      const fileId = typeof row._id === 'string' ? row._id : typeof row.id === 'string' ? row.id : '';
      if (!fileId) {
        continue;
      }
      await writeJson(mongoFile(projectId, `${folder}/${fileId}.json`), row);
    }
  }
  const types: Record<string, string> = {};
  for (const object of objects) {
    const filePath = ossFile(projectId, object.key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, object.body);
    types[object.key] = object.contentType;
  }
  await writeJson(path.join(root, 'content-types.json'), types);
  await clearChange(projectId);
}

export async function findLocalObject(key: string): Promise<{ body: Buffer; contentType: string } | null> {
  const { listProjectIds } = await import('./disk');
  for (const id of await listProjectIds()) {
    const found = await localObject(id, key);
    if (found) {
      return found;
    }
  }
  return null;
}

async function localObject(projectId: string, key: string): Promise<{ body: Buffer; contentType: string } | null> {
  try {
    const body = await readFile(ossFile(projectId, key));
    return { body, contentType: await contentTypeOf(projectId, key) };
  } catch {
    return null;
  }
}

export async function changedFiles(projectId: string): Promise<ChangeEntry[]> {
  return (await readChange(projectId)).entries;
}
