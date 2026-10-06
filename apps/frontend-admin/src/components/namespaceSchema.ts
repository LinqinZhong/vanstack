import type { NamespaceTypeFieldDto } from '@vanstack/shared';

const IDENT = /^[\p{L}_$][\p{L}\p{N}_$]*$/u;

export function fieldsToSource(name: string, fields: NamespaceTypeFieldDto[]): string {
  const body = fields.map((field) => fieldLine(field, 2)).join('\n');
  return `interface ${name || 'Type'} {\n${body}${body ? '\n' : ''}}\n`;
}

export function parseInterface(source: string): { name: string; fields: NamespaceTypeFieldDto[] } {
  const reader = new Reader(source);
  reader.skip();
  reader.eat('export');
  reader.expect('interface');
  const name = reader.ident();
  const fields = readBody(reader, 0);
  reader.skip();
  if (reader.rest().trim()) {
    throw new Error('invalid');
  }
  return { name, fields };
}

function fieldLine(field: NamespaceTypeFieldDto, indent: number): string {
  const pad = ' '.repeat(indent);
  const description = field.description.trim().replace(/\*\//g, '* /');
  const doc = description ? `${pad}/** ${description} */\n` : '';
  return `${doc}${pad}${formatName(field.name)}: ${typeText(field, indent)};`;
}

function typeText(field: Pick<NamespaceTypeFieldDto, 'type' | 'children'>, indent: number): string {
  if (field.type === 'array') {
    const item = field.children?.[0] ?? { type: 'string', children: undefined };
    return `${typeText(item, indent)}[]`;
  }
  if (field.type === 'object') {
    const pad = ' '.repeat(indent);
    const inner = (field.children ?? []).map((child) => fieldLine(child, indent + 2)).join('\n');
    return `{\n${inner}${inner ? '\n' : ''}${pad}}`;
  }
  return field.type || 'unknown';
}

function formatName(name: string): string {
  return IDENT.test(name) ? name : JSON.stringify(name);
}

function readBody(reader: Reader, depth: number): NamespaceTypeFieldDto[] {
  if (depth > 12) {
    throw new Error('invalid');
  }
  reader.expect('{');
  const fields: NamespaceTypeFieldDto[] = [];
  while (!reader.eat('}')) {
    const description = reader.doc();
    const name = reader.readName();
    reader.expect(':');
    const type = readType(reader, depth + 1);
    reader.eat(';');
    reader.eat(',');
    fields.push({
      id: crypto.randomUUID(),
      name,
      description,
      type: type.type,
      ...(type.children ? { children: type.children } : {}),
    });
  }
  return fields;
}

function readType(reader: Reader, depth: number): Pick<NamespaceTypeFieldDto, 'type' | 'children'> {
  if (depth > 12) {
    throw new Error('invalid');
  }
  reader.skip();
  let node: Pick<NamespaceTypeFieldDto, 'type' | 'children'>;
  if (reader.eat('(')) {
    node = readType(reader, depth + 1);
    reader.expect(')');
  } else if (reader.peek() === '{') {
    node = { type: 'object', children: readBody(reader, depth) };
  } else {
    node = { type: reader.ident() };
  }
  while (reader.eat('[')) {
    reader.expect(']');
    node = {
      type: 'array',
      children: [
        {
          id: crypto.randomUUID(),
          name: '',
          description: '',
          type: node.type,
          ...(node.children ? { children: node.children } : {}),
        },
      ],
    };
  }
  return node;
}

class Reader {
  private index = 0;
  private readonly source: string;

  constructor(source: string) {
    this.source = source;
  }

  rest(): string {
    return this.source.slice(this.index);
  }

  skip(): void {
    while (this.index < this.source.length) {
      const char = this.source[this.index];
      if (char != null && /\s/u.test(char)) {
        this.index += 1;
        continue;
      }
      if (this.source.startsWith('//', this.index)) {
        const next = this.source.indexOf('\n', this.index);
        this.index = next < 0 ? this.source.length : next + 1;
        continue;
      }
      if (this.source.startsWith('/*', this.index) && !this.source.startsWith('/**', this.index)) {
        const end = this.source.indexOf('*/', this.index + 2);
        if (end < 0) {
          throw new Error('invalid');
        }
        this.index = end + 2;
        continue;
      }
      break;
    }
  }

  peek(): string {
    this.skip();
    return this.source[this.index] ?? '';
  }

  eat(token: string): boolean {
    this.skip();
    if (!this.source.startsWith(token, this.index)) {
      return false;
    }
    this.index += token.length;
    return true;
  }

  expect(token: string): void {
    if (!this.eat(token)) {
      throw new Error('invalid');
    }
  }

  ident(): string {
    this.skip();
    const match = /^[\p{L}_$][\p{L}\p{N}_$]*/u.exec(this.source.slice(this.index));
    if (!match) {
      throw new Error('invalid');
    }
    this.index += match[0].length;
    return match[0];
  }

  readName(): string {
    this.skip();
    const quote = this.source[this.index];
    if (quote === '"' || quote === "'") {
      return this.readString();
    }
    return this.ident();
  }

  doc(): string {
    this.skip();
    if (!this.source.startsWith('/**', this.index)) {
      return '';
    }
    const end = this.source.indexOf('*/', this.index + 3);
    if (end < 0) {
      throw new Error('invalid');
    }
    const raw = this.source.slice(this.index + 3, end);
    this.index = end + 2;
    return raw
      .split('\n')
      .map((line) => line.replace(/^\s*\* ?/u, '').trim())
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  private readString(): string {
    const quote = this.source[this.index];
    if (quote !== '"' && quote !== "'") {
      throw new Error('invalid');
    }
    let value = '';
    this.index += 1;
    while (this.index < this.source.length) {
      const char = this.source[this.index];
      if (char === '\\') {
        const next = this.source[this.index + 1];
        if (next == null) {
          throw new Error('invalid');
        }
        value += next;
        this.index += 2;
        continue;
      }
      if (char === quote) {
        this.index += 1;
        return value;
      }
      value += char ?? '';
      this.index += 1;
    }
    throw new Error('invalid');
  }
}
