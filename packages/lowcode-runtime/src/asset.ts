type AssetFn = (path: string) => string;

/** 安装 `$asset('分组.文件名')`，返回资源库文件地址。没有对应资源时原样返回路径。 */
export function installPageAssets(assets: Readonly<Record<string, string>> | undefined) {
  const table = assets ?? {};
  const host = globalThis as { $asset?: AssetFn };
  host.$asset = (path: string) => {
    const key = String(path ?? '').trim();
    return table[key] ?? key;
  };
}