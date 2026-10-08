const T_CALL = /^\$t\("([^".]+)\.([^".]+)"\)$/;
const ICON_CALL = /^\$icon\((['"])([^'"]+)\1\)$/;

/** 字符串值本身就是 `$t("分组.条目")` 或 `$icon('分组.名称')`。 */
export function isRuntimeCall(value: string): boolean {
  return T_CALL.test(value) || ICON_CALL.test(value);
}

export function tryParseDataLiteral(source: string): unknown | undefined {
  try {
    return parseDataLiteral(source);
  } catch {
    return undefined;
  }
}

/**
 * 解析 JSON，并允许值的位置写 `$t("分组.条目")` 与 `$icon('分组.名称')`。
 * 调用会收成对应的源码字符串，方便再格式化回去。
 */
export function parseDataLiteral(source: string): unknown {
  const parser = new Parser(source);
  const value = parser.parseValue();
  parser.skip();
  if (!parser.done()) {
    throw new Error('trailing');
  }
  return value;
}

/** 把字面量格式化成 JSON。运行时调用保持原样，不包进引号。 */
export function formatDataLiteral(value: unknown, space = 0): string {
  return formatValue(value, space, 0);
}

class Parser {
  private index = 0;
  private source: string;

  constructor(source: string) {
    this.source = source;
  }

  done() {
    return this.index >= this.source.length;
  }

  parseValue(): unknown {
    this.skip();
    const char = this.peek();
    if (char === '{') {
      return this.parseObject();
    }
    if (char === '[') {
      return this.parseArray();
    }
    if (char === '"' || char === "'") {
      return this.parseString();
    }
    if (this.startsWith('$t(') || this.startsWith('$icon(')) {
      return this.parseCall();
    }
    if (this.keyword('true')) {
      return true;
    }
    if (this.keyword('false')) {
      return false;
    }
    if (this.keyword('null')) {
      return null;
    }
    if (char === '-' || isDigit(char)) {
      return this.parseNumber();
    }
    throw new Error('value');
  }

  private parseObject(): Record<string, unknown> {
    this.expect('{');
    const result: Record<string, unknown> = {};
    this.skip();
    if (this.peek() === '}') {
      this.index += 1;
      return result;
    }
    while (true) {
      this.skip();
      const key = this.parseKey();
      this.skip();
      this.expect(':');
      result[key] = this.parseValue();
      this.skip();
      if (this.peek() === ',') {
        this.index += 1;
        this.skip();
        if (this.peek() === '}') {
          this.index += 1;
          break;
        }
        continue;
      }
      this.expect('}');
      break;
    }
    return result;
  }

  private parseArray(): unknown[] {
    this.expect('[');
    const result: unknown[] = [];
    this.skip();
    if (this.peek() === ']') {
      this.index += 1;
      return result;
    }
    while (true) {
      result.push(this.parseValue());
      this.skip();
      if (this.peek() === ',') {
        this.index += 1;
        this.skip();
        if (this.peek() === ']') {
          this.index += 1;
          break;
        }
        continue;
      }
      this.expect(']');
      break;
    }
    return result;
  }

  private parseKey(): string {
    this.skip();
    const char = this.peek();
    if (char === '"' || char === "'") {
      return this.parseString();
    }
    const match = /^[\p{ID_Start}$_][\p{ID_Continue}$]*/u.exec(this.source.slice(this.index));
    if (!match) {
      throw new Error('key');
    }
    this.index += match[0].length;
    return match[0];
  }

  private parseString(): string {
    const quote = this.peek();
    if (quote !== '"' && quote !== "'") {
      throw new Error('string');
    }
    this.index += 1;
    let value = '';
    while (!this.done()) {
      const char = this.peek();
      if (char === quote) {
        this.index += 1;
        return value;
      }
      if (char === '\\') {
        this.index += 1;
        const escaped = this.peek();
        this.index += 1;
        if (escaped === 'u') {
          const hex = this.source.slice(this.index, this.index + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
            throw new Error('unicode');
          }
          value += String.fromCharCode(Number.parseInt(hex, 16));
          this.index += 4;
          continue;
        }
        const mapped: Record<string, string> = { b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', '\\': '\\', '/': '/' };
        value += mapped[escaped] ?? escaped;
        continue;
      }
      if (char === '\n' || char === '\r') {
        throw new Error('newline');
      }
      value += char;
      this.index += 1;
    }
    throw new Error('unterminated');
  }

  private parseCall(): string {
    const name = this.startsWith('$t(') ? '$t' : '$icon';
    this.index += name.length + 1;
    this.skip();
    const quote = this.peek();
    if (quote !== '"' && quote !== "'") {
      throw new Error('call');
    }
    const arg = this.parseString();
    this.skip();
    this.expect(')');
    if (name === '$t') {
      if (!/^[^".]+\.[^".]+$/.test(arg)) {
        throw new Error('t');
      }
      return `$t("${arg}")`;
    }
    if (!arg.trim()) {
      throw new Error('icon');
    }
    const wrapped = quote === "'" ? `'${arg}'` : `"${arg}"`;
    return `$icon(${wrapped})`;
  }

  private parseNumber(): number {
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(this.source.slice(this.index));
    if (!match) {
      throw new Error('number');
    }
    this.index += match[0].length;
    return Number(match[0]);
  }

  private keyword(word: string) {
    if (!this.startsWith(word)) {
      return false;
    }
    const next = this.source[this.index + word.length] ?? '';
    if (/[\p{ID_Continue}$]/u.test(next)) {
      return false;
    }
    this.index += word.length;
    return true;
  }

  skip() {
    while (!this.done() && /\s/u.test(this.peek())) {
      this.index += 1;
    }
  }

  private expect(char: string) {
    if (this.peek() !== char) {
      throw new Error(char);
    }
    this.index += 1;
  }

  private startsWith(text: string) {
    return this.source.startsWith(text, this.index);
  }

  private peek() {
    return this.source[this.index] ?? '';
  }
}

function formatValue(value: unknown, space: number, depth: number): string {
  if (typeof value === 'string' && isRuntimeCall(value)) {
    return value;
  }
  if (value === null || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value) ?? 'null';
  }
  const gap = space > 0 ? ' ' : '';
  const pad = space > 0 ? `\n${' '.repeat(space * (depth + 1))}` : '';
  const end = space > 0 ? `\n${' '.repeat(space * depth)}` : '';
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]';
    }
    return `[${value.map((item) => pad + formatValue(item, space, depth + 1)).join(',')}${end}]`;
  }
  if (isPlain(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return '{}';
    }
    const body = keys.map((key) => `${pad}${JSON.stringify(key)}:${gap}${formatValue(value[key], space, depth + 1)}`);
    return `{${body.join(',')}${end}}`;
  }
  return 'null';
}

function isPlain(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isDigit(char: string) {
  return char >= '0' && char <= '9';
}
