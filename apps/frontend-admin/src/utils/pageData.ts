import type { PageDataType, PageVariable } from '@vanstack/xml';
import {
  buildPageDataScope,
  defaultPageDataValue,
  evaluateDataExpression,
  isDataExpression,
  isJsIdentifier,
  readVariableValue,
  validateDataLiteral,
} from '@vanstack/xml';

export {
  buildPageDataScope,
  defaultPageDataValue,
  evaluateDataExpression,
  isDataExpression,
  isJsIdentifier,
  readVariableValue,
  validateDataLiteral,
};

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

export function nextVariableName(variables: PageVariable[]): string {
  const used = new Set(variables.map((variable) => variable.name));
  let index = 1;
  while (used.has(`var${index}`)) {
    index += 1;
  }
  return `var${index}`;
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

/** 编辑器里是函数体。纯 `return 表达式` 仍只存表达式，带语句的整段函数体原样保存。 */
export function dataEditorDraft(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return `return ${fallback}`;
  }
  return isDataExpression(trimmed) ? `return ${trimmed}` : trimmed;
}

export function dataEditorStored(draft: string): string | null {
  const trimmed = draft.trim();
  if (!trimmed) {
    return null;
  }
  const expr = parseReturnExpression(trimmed);
  if (expr && isDataExpression(expr)) {
    return expr;
  }
  return trimmed;
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
