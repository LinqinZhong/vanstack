import type { PageDataType, PageVariable } from './page';

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

export function buildPageDataScope(
  variables: PageVariable[] | undefined,
  untilIndex?: number,
): Record<string, unknown> {
  const list = variables ?? [];
  const data: Record<string, unknown> = Object.create(null);
  const end = untilIndex == null ? list.length : Math.max(0, Math.min(untilIndex, list.length));
  for (let i = 0; i < end; i += 1) {
    const variable = list[i];
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
