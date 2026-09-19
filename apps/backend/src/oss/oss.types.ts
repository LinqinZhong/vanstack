export interface StoredObject {
  key: string;
  url: string;
}

export interface ListedObject {
  key: string;
  size: number;
}

export abstract class OssStorage {
  abstract putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<StoredObject>;

  abstract getObject(key: string): Promise<{ body: Buffer; contentType: string } | null>;

  abstract deleteObject(key: string): Promise<void>;

  abstract listObjects(prefix: string): Promise<ListedObject[]>;

  abstract getPublicUrl(key: string): string;

  ensureReady(): Promise<void> {
    return Promise.resolve();
  }
}
