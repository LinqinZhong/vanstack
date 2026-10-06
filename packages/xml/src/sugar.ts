export type ScopeBucket = 'data' | 'props' | 'query';

export type ScopeAssignCall = {
  bucket: ScopeBucket;
  name: string;
  setter: string;
};

export type ScopeAssign = (bucket: ScopeBucket, name: string, value: unknown) => void;

const FIELD = /^[\p{ID_Start}$_][\p{ID_Continue}$]*/u;

/** React 状态 setter：`current` → `setCurrent`。 */
export function scopeSetterName(name: string): string {
  return `set${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

/**
 * `$data.xxx(值)`、`$props.xxx(值)`、`$query.xxx(值)` 编译成 `setXxx(值)`。
 * 读取形式 `$data.xxx` 保持不变。
 */
export function compileScopeSugar(source: string): { code: string; calls: ScopeAssignCall[] } {
  const calls: ScopeAssignCall[] = [];
  return { code: rewrite(source, calls), calls };
}

type Mode = 'code' | 'line' | 'block' | 'sq' | 'dq' | 'template';

function rewrite(source: string, calls: ScopeAssignCall[]): string {
  let out = '';
  let i = 0;
  let mode: Mode = 'code';
  const interp: number[] = [];
  while (i < source.length) {
    const ch = source[i] ?? '';
    if (mode === 'line') {
      out += ch;
      i += 1;
      if (ch === '\n') {
        mode = interp.length > 0 ? 'code' : 'code';
      }
      continue;
    }
    if (mode === 'block') {
      if (ch === '*' && source[i + 1] === '/') {
        out += '*/';
        i += 2;
        mode = 'code';
        continue;
      }
      out += ch;
      i += 1;
      continue;
    }
    if (mode === 'sq' || mode === 'dq') {
      const quote = mode === 'sq' ? "'" : '"';
      if (ch === '\\') {
        out += source.slice(i, i + 2);
        i += 2;
        continue;
      }
      out += ch;
      i += 1;
      if (ch === quote) {
        mode = 'code';
      }
      continue;
    }
    if (mode === 'template') {
      if (ch === '\\') {
        out += source.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (ch === '`') {
        out += ch;
        i += 1;
        mode = 'code';
        continue;
      }
      if (ch === '$' && source[i + 1] === '{') {
        out += '${';
        i += 2;
        interp.push(1);
        mode = 'code';
        continue;
      }
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '/' && source[i + 1] === '/') {
      out += '//';
      i += 2;
      mode = 'line';
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      out += '/*';
      i += 2;
      mode = 'block';
      continue;
    }
    if (ch === "'") {
      out += ch;
      i += 1;
      mode = 'sq';
      continue;
    }
    if (ch === '"') {
      out += ch;
      i += 1;
      mode = 'dq';
      continue;
    }
    if (ch === '`') {
      out += ch;
      i += 1;
      mode = 'template';
      continue;
    }
    if (interp.length > 0) {
      if (ch === '{') {
        interp[interp.length - 1] += 1;
      } else if (ch === '}') {
        interp[interp.length - 1] -= 1;
        if (interp[interp.length - 1] === 0) {
          interp.pop();
          out += ch;
          i += 1;
          mode = 'template';
          continue;
        }
      }
    }
    if (ch === '$' && !isIdentChar(source[i - 1])) {
      const hit = matchCall(source, i);
      if (hit) {
        calls.push({ bucket: hit.bucket, name: hit.name, setter: hit.setter });
        out += `${hit.setter}(`;
        i = hit.next;
        continue;
      }
    }
    out += ch;
    i += 1;
  }
  return out;
}

function matchCall(
  source: string,
  start: number,
): { bucket: ScopeBucket; name: string; setter: string; next: number } | null {
  const bucketMatch = /^(data|props|query)\./u.exec(source.slice(start + 1));
  if (!bucketMatch) {
    return null;
  }
  const nameAt = start + 1 + bucketMatch[0].length;
  const nameMatch = FIELD.exec(source.slice(nameAt));
  if (!nameMatch) {
    return null;
  }
  let cursor = nameAt + nameMatch[0].length;
  while (cursor < source.length && /[\t\n\r ]/u.test(source[cursor] ?? '')) {
    cursor += 1;
  }
  if (source[cursor] !== '(') {
    return null;
  }
  const bucket = bucketMatch[1] as ScopeBucket;
  const name = nameMatch[0];
  return { bucket, name, setter: scopeSetterName(name), next: cursor + 1 };
}

function isIdentChar(ch: string | undefined): boolean {
  return Boolean(ch && /[\p{ID_Continue}$]/u.test(ch));
}
