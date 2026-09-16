export interface StoredObject {
  key: string;
  url: string;
}

export abstract class OssStorage {
  abstract putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<StoredObject>;

  abstract getObject(key: string): Promise<{ body: Buffer; contentType: string } | null>;

  abstract deleteObject(key: string): Promise<void>;

  abstract getPublicUrl(key: string): string;

  ensureReady(): Promise<void> {
    return Promise.resolve();
  }
}
