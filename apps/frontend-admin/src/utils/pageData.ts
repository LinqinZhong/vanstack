import type { PageDataType, PageVariable } from '@vanstack/xml';

export const PAGE_DATA_TYPE_OPTIONS: Array<{ value: PageDataType; label: string }> = [
  { value: 'num', label: 'Number' },
  { value: 'str', label: 'String' },
  { value: 'bool', label: 'Boolean' },
  { value: 'arr', label: 'Array' },
  { value: 'obj', label: 'Object' },
  { value: 'widget', label: 'Widget' },
];

export const WIDGET_DATA_DRAG_TYPE = 'application/x-vanstack-widget-id';
export const WIDGET_DATA_DRAG_PREFIX = 'vanstack-widget:';

export function writeWidgetDrag(dataTransfer: DataTransfer, widgetId: string) {
  dataTransfer.setData(WIDGET_DATA_DRAG_TYPE, widgetId);
  dataTransfer.setData('text/plain', `${WIDGET_DATA_DRAG_PREFIX}${widgetId}`);
}

export function readWidgetDragId(dataTransfer: DataTransfer): string | null {
  const mime = dataTransfer.getData(WIDGET_DATA_DRAG_TYPE).trim();
  if (mime) {
    return mime;
  }
  const text = dataTransfer.getData('text/plain');
  if (text.startsWith(WIDGET_DATA_DRAG_PREFIX)) {
    return text.slice(WIDGET_DATA_DRAG_PREFIX.length);
  }
  return null;
}

export function isWidgetDrag(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(WIDGET_DATA_DRAG_TYPE);
}

export function defaultPageDataValue(type: PageDataType): string {
  if (type === 'num') {
    return '0';
  }
  if (type === 'str' || type === 'widget') {
    return '';
  }
  if (type === 'bool') {
    return '0';
  }
  if (type === 'arr') {
    return '[]';
  }
  return '{}';
}

export function nextVariableName(variables: PageVariable[]): string {
  const used = new Set(variables.map((variable) => variable.name));
  let index = 1;
  while (used.has(`var${index}`)) {
    index += 1;
  }
  return `var${index}`;
}

export function isJsIdentifier(name: string): boolean {
  if (!/^[\p{ID_Start}$_][\p{ID_Continue}$]*$/u.test(name)) {
    return false;
  }
  try {
    // Reserved words are IdentifierName but cannot wrap `function name(){}`.
    new Function(`function ${name}(){}`);
    return true;
  } catch {
    return false;
  }
}

export function parseReturnExpression(source: string): string | null {
  const trimmed = source.trim();
  const match = /^return\s+([\s\S]*)$/.exec(trimmed);
  if (!match) {
    return null;
  }
  const expr = match[1].trim().replace(/;+\s*$/, '');
  return expr || null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function evaluateDataExpression(expr: string, data: Record<string, unknown>): unknown {
  const scope = new Proxy(data, {
    get(target, prop) {
      if (typeof prop !== 'string') {
        return undefined;
      }
      if (!Object.prototype.hasOwnProperty.call(target, prop)) {
        throw new Error(`Unknown data variable: ${prop}`);
      }
      return target[prop];
    },
  });
  return new Function('$data', `"use strict"; return (${expr});`)(scope);
}

export function readVariableValue(variable: PageVariable, data: Record<string, unknown>): unknown {
  if (variable.type === 'num') {
    const parsed = Number(variable.value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (variable.type === 'str' || variable.type === 'widget') {
    return variable.value;
  }
  if (variable.type === 'bool') {
    return variable.value === '1';
  }
  try {
    return evaluateDataExpression(variable.value || defaultPageDataValue(variable.type), data);
  } catch {
    return variable.type === 'arr' ? [] : {};
  }
}

export function buildPageDataScope(variables: PageVariable[], untilIndex: number): Record<string, unknown> {
  const data: Record<string, unknown> = Object.create(null);
  const end = Math.max(0, Math.min(untilIndex, variables.length));
  for (let i = 0; i < end; i += 1) {
    const variable = variables[i];
    data[variable.name] = readVariableValue(variable, data);
  }
  return data;
}

export function validateDataLiteral(
  expr: string,
  type: 'arr' | 'obj',
  data: Record<string, unknown> = {},
): boolean {
  try {
    const result = evaluateDataExpression(expr, data);
    if (type === 'arr') {
      return Array.isArray(result);
    }
    return isPlainObject(result);
  } catch {
    return false;
  }
}

export function moveVariable(variables: PageVariable[], from: number, to: number): PageVariable[] {
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= variables.length ||
    to >= variables.length
  ) {
    return variables;
  }
  const next = [...variables];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function collectDataRefs(value: string): string[] {
  return [...new Set(findDataRefRanges(value).map((ref) => ref.name))];
}

export function findDataRefRanges(value: string): Array<{ name: string; from: number; to: number }> {
  const refs: Array<{ name: string; from: number; to: number }> = [];
  for (const match of value.matchAll(/\$data\.([\p{ID_Start}$_][\p{ID_Continue}$]*)/gu)) {
    const name = match[1];
    const index = match.index ?? 0;
    refs.push({ name, from: index, to: index + match[0].length });
  }
  for (const match of value.matchAll(/\$data\[['"]([^'"]+)['"]\]/g)) {
    const name = match[1];
    const index = match.index ?? 0;
    refs.push({ name, from: index, to: index + match[0].length });
  }
  return refs;
}

export function orderRespectsDataDeps(variables: PageVariable[]): boolean {
  const names = new Set(variables.map((variable) => variable.name));
  const seen = new Set<string>();
  for (const variable of variables) {
    for (const ref of collectDataRefs(variable.value)) {
      if (names.has(ref) && !seen.has(ref)) {
        return false;
      }
    }
    seen.add(variable.name);
  }
  return true;
}

export function canMoveVariable(variables: PageVariable[], from: number, to: number): boolean {
  const next = moveVariable(variables, from, to);
  return next === variables || orderRespectsDataDeps(next);
}
