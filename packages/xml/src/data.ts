import type { ComponentProp, PageDataType, PageVariable } from './page';

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 纯表达式走 `return (expr)`。带语句的函数体原样执行，由函数自己 return。 */
export function isDataExpression(expr: string): boolean {
  try {
    new Function('$data', '$props', '$query', `"use strict"; return (${expr.trim()});`);
    return true;
  } catch {
    return false;
  }
}

export function evaluateDataExpression(
  expr: string,
  data: Record<string, unknown>,
  props: Record<string, unknown> = Object.create(null),
  query: Record<string, unknown> = Object.create(null),
): unknown {
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
  const trimmed = expr.trim();
  const program = isDataExpression(trimmed) ? `"use strict"; return (${trimmed});` : `"use strict";\n${trimmed}`;
  return new Function('$data', '$props', '$query', program)(scope, props, query);
}

export function readVariableValue(
  variable: PageVariable,
  data: Record<string, unknown>,
  props: Record<string, unknown> = Object.create(null),
  query: Record<string, unknown> = Object.create(null),
): unknown {
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
    return evaluateDataExpression(variable.value || defaultPageDataValue(variable.type), data, props, query);
  } catch {
    return variable.type === 'arr' ? [] : {};
  }
}

/** 用 testData 覆盖同名入参或变量的 value。没有对应键时保持原值。 */
export function applyTestValues<T extends { name: string; value: string }>(
  items: T[] | undefined,
  values: Record<string, string> | undefined,
): T[] | undefined {
  if (!items || !values) {
    return items;
  }
  return items.map((item) =>
    Object.prototype.hasOwnProperty.call(values, item.name) ? { ...item, value: values[item.name] } : item,
  );
}

export function buildPropsRecord(
  props: ComponentProp[] | undefined,
  query: Record<string, unknown> = Object.create(null),
): Record<string, unknown> {
  const record: Record<string, unknown> = Object.create(null);
  for (const prop of props ?? []) {
    record[prop.name] = readVariableValue(
      { type: prop.type, name: prop.name, value: prop.value },
      Object.create(null),
      record,
      query,
    );
  }
  return record;
}

export function buildPageDataScope(
  variables: PageVariable[] | undefined,
  untilIndex?: number,
  props: Record<string, unknown> = Object.create(null),
  query: Record<string, unknown> = Object.create(null),
): Record<string, unknown> {
  const list = variables ?? [];
  const data: Record<string, unknown> = Object.create(null);
  const end = untilIndex == null ? list.length : Math.max(0, Math.min(untilIndex, list.length));
  for (let i = 0; i < end; i += 1) {
    const variable = list[i];
    data[variable.name] = readVariableValue(variable, data, props, query);
  }
  return data;
}

function isComputedData(variable: PageVariable): boolean {
  return variable.computed === true && (variable.type === 'arr' || variable.type === 'obj');
}

function snapshotLiteral(value: unknown, type: 'arr' | 'obj'): string | null {
  const normalized = type === 'arr' ? (Array.isArray(value) ? value : []) : isPlainObject(value) ? value : {};
  try {
    return JSON.stringify(normalized) ?? null;
  } catch {
    return null;
  }
}

/**
 * 未开计算属性的数组和对象，只按创建时的 `$props`、`$query` 和变量初始值求值一次。
 * `overrides` 只替换被写入的非计算变量。
 * 计算属性按当前变量值和 `liveProps` 重新求值。
 */
export function resolvePageData(
  variables: PageVariable[] | undefined,
  overrides?: Readonly<Record<string, string>>,
  props: Record<string, unknown> = Object.create(null),
  liveProps: Record<string, unknown> = props,
  query: Record<string, unknown> = Object.create(null),
): Record<string, unknown> {
  const list = variables ?? [];
  const initial = buildPageDataScope(list, undefined, props, query);
  const hasComputed = list.some(isComputedData);
  if (!overrides && !hasComputed) {
    return initial;
  }
  const data: Record<string, unknown> = Object.create(null);
  let changed = false;
  for (const variable of list) {
    if (isComputedData(variable)) {
      changed = true;
      data[variable.name] = readVariableValue(variable, data, liveProps, query);
      continue;
    }
    if (overrides && Object.prototype.hasOwnProperty.call(overrides, variable.name)) {
      changed = true;
      data[variable.name] = readVariableValue(
        { ...variable, value: overrides[variable.name] },
        initial,
        props,
        query,
      );
      continue;
    }
    data[variable.name] = initial[variable.name];
  }
  return changed ? data : initial;
}

/** 预览文档里把数组/对象收成创建时的字面量，避免之后重算时读到被覆盖的变量。 */
export function presentRuntimeData(
  variables: PageVariable[] | undefined,
  overrides: Readonly<Record<string, string>> | undefined,
  props: Record<string, unknown> = Object.create(null),
): PageVariable[] | undefined {
  if (!variables) {
    return variables;
  }
  const initial = buildPageDataScope(variables, undefined, props);
  let changed = false;
  const next = variables.map((variable) => {
    if (isComputedData(variable)) {
      return variable;
    }
    const hasOverride = Boolean(overrides && Object.prototype.hasOwnProperty.call(overrides, variable.name));
    if (variable.type !== 'arr' && variable.type !== 'obj') {
      if (!hasOverride || overrides![variable.name] === variable.value) {
        return variable;
      }
      changed = true;
      return { ...variable, value: overrides![variable.name] };
    }
    const evaluated = hasOverride
      ? readVariableValue({ ...variable, value: overrides![variable.name] }, initial, props)
      : initial[variable.name];
    const stored = snapshotLiteral(evaluated, variable.type);
    if (stored == null || stored === variable.value) {
      return variable;
    }
    changed = true;
    return { ...variable, value: stored };
  });
  return changed ? next : variables;
}

export function validateDataLiteral(
  expr: string,
  type: 'arr' | 'obj',
  data: Record<string, unknown> = {},
  props: Record<string, unknown> = Object.create(null),
  query: Record<string, unknown> = Object.create(null),
): boolean {
  try {
    const result = evaluateDataExpression(expr, data, props, query);
    if (type === 'arr') {
      return Array.isArray(result);
    }
    return isPlainObject(result);
  } catch {
    return false;
  }
}
