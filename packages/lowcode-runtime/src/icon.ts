type IconFn = (path: string) => string;

/** 安装 `$icon('分组.名称')`，返回图标文件地址。没有对应图标时原样返回路径。 */
export function installPageIcons(icons: Readonly<Record<string, string>> | undefined) {
  const table = icons ?? {};
  const host = globalThis as { $icon?: IconFn };
  host.$icon = (path: string) => {
    const key = String(path ?? '').trim();
    return table[key] ?? key;
  };
}
