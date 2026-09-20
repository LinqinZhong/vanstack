import { isJsIdentifier, ownedStateIds, type PageWidget } from './page';

export type BindingScope = {
  data: Record<string, unknown>;
  aliases?: Record<string, unknown>;
};

const EXPR_BINDING = /^\s*\$\(([\s\S]*)\)\s*$/;
const PATH_BINDING =
  /^\s*\$([\p{ID_Start}$_][\p{ID_Continue}$]*)((?:\.[\p{ID_Start}$_][\p{ID_Continue}$]*)*)\s*$/u;

function readPath(root: unknown, parts: string[]): unknown {
  let current = root;
  for (const key of parts) {
    if (current == null || (typeof current !== 'object' && typeof current !== 'function')) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export function bindingToString(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}

export function evaluateBindingExpression(expr: string, scope: BindingScope): unknown {
  const aliases = scope.aliases ?? {};
  const names = Object.keys(aliases).filter(isJsIdentifier);
  const values = names.map((name) => aliases[name]);
  return new Function('data', ...names, `"use strict"; return (${expr});`)(scope.data, ...values);
}

function aliasValue(scope: BindingScope, dollarName: string, plainName: string): unknown {
  const aliases = scope.aliases ?? {};
  if (Object.prototype.hasOwnProperty.call(aliases, dollarName)) {
    return aliases[dollarName];
  }
  return aliases[plainName];
}

export function evaluateStateFunction(body: string, scope: BindingScope): unknown {
  return new Function(
    '$data',
    '$item',
    '$index',
    `"use strict";\n${body}`,
  )(scope.data, aliasValue(scope, '$item', 'item'), aliasValue(scope, '$index', 'index'));
}

export function resolveStateFnId(widget: PageWidget, scope?: BindingScope): string | null {
  const body = widget.stateFn?.trim();
  if (!body) {
    return null;
  }
  try {
    const result = evaluateStateFunction(body, scope ?? { data: Object.create(null) as Record<string, unknown> });
    if (result == null) {
      return null;
    }
    const id = String(result).trim();
    if (!id || id === 'initial') {
      return null;
    }
    return ownedStateIds(widget).includes(id) ? id : null;
  } catch {
    return null;
  }
}

export function isCopyBinding(raw: string): boolean {
  const trimmed = raw.trim();
  return Boolean(trimmed) && (EXPR_BINDING.test(trimmed) || PATH_BINDING.test(trimmed));
}

export function resolveCopyBinding(raw: string, scope: BindingScope): string {
  const exprMatch = EXPR_BINDING.exec(raw);
  if (exprMatch) {
    try {
      return bindingToString(evaluateBindingExpression(exprMatch[1], scope));
    } catch {
      return '';
    }
  }

  const pathMatch = PATH_BINDING.exec(raw);
  if (!pathMatch) {
    return raw;
  }

  const head = pathMatch[1];
  const parts = pathMatch[2] ? pathMatch[2].slice(1).split('.').filter(Boolean) : [];
  try {
    if (head === 'data') {
      if (parts.length === 0) {
        return bindingToString(scope.data);
      }
      const [name, ...rest] = parts;
      if (!Object.prototype.hasOwnProperty.call(scope.data, name)) {
        return '';
      }
      return bindingToString(readPath(scope.data[name], rest));
    }
    const aliases = scope.aliases ?? {};
    if (!Object.prototype.hasOwnProperty.call(aliases, head)) {
      return '';
    }
    return bindingToString(readPath(aliases[head], parts));
  } catch {
    return '';
  }
}
