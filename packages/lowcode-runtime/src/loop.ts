import {
  compactLoop,
  evaluateBindingExpression,
  isLoopConfigured,
  loopIndexName,
  loopItemName,
  setWidgetRuntimeMeta,
  getWidgetRuntimeMeta,
  type BindingScope,
  type PageWidget,
  type WidgetLoop,
} from '@vanstack/xml';

export type WidgetInstanceMeta = {
  scope: BindingScope;
  key: string;
};

export function widgetInstanceMeta(widget: PageWidget): WidgetInstanceMeta | undefined {
  return getWidgetRuntimeMeta(widget);
}

export function widgetInstanceKey(widget: PageWidget): string {
  return getWidgetRuntimeMeta(widget)?.key ?? widget.id;
}

function readPath(root: unknown, path: string): unknown {
  const parts = path.split('.').map((part) => part.trim()).filter(Boolean);
  let current = root;
  for (const key of parts) {
    if (current == null || (typeof current !== 'object' && typeof current !== 'function')) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function uniqueKeyOf(item: unknown, path: string, index: number): string {
  const value = readPath(item, path);
  if (value == null || value === '') {
    return String(index);
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  try {
    return JSON.stringify(value) ?? String(index);
  } catch {
    return String(index);
  }
}

function resolveLoopItems(loop: WidgetLoop, scope: BindingScope): unknown[] {
  let value: unknown;
  if (loop.from === 'data') {
    value = Object.prototype.hasOwnProperty.call(scope.data, loop.source) ? scope.data[loop.source] : undefined;
  } else if (loop.from === 'props') {
    const props = scope.props ?? {};
    value = Object.prototype.hasOwnProperty.call(props, loop.source) ? props[loop.source] : undefined;
  } else {
    try {
      value = evaluateBindingExpression(loop.source, scope);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value : [];
}

function joinInstanceKey(prefix: string, widgetId: string, unique?: string): string {
  const base = prefix ? `${prefix}/${widgetId}` : widgetId;
  return unique == null ? base : `${base}-${unique}`;
}

function materialize(widget: PageWidget, scope: BindingScope, key: string, editing: boolean): PageWidget {
  const next = { ...widget };
  if ('children' in next && Array.isArray(next.children)) {
    next.children = expandLoopTree(next.children, scope, editing, key);
  }
  setWidgetRuntimeMeta(next, { scope, key });
  return next;
}

/** 编辑态默认只留一份模板。勾了「编辑时显示入参」的组件要按循环展开，入参里的 `$item` 才能求值。 */
function loopForRender(widget: PageWidget, editing: boolean): WidgetLoop | undefined {
  const loop = compactLoop(widget.loop);
  if (!loop || !isLoopConfigured(loop)) {
    return undefined;
  }
  if (!editing || (widget.type === 'component' && widget.editProps)) {
    return loop;
  }
  return undefined;
}

export function expandLoopTree(
  widgets: PageWidget[],
  scope: BindingScope,
  editing: boolean,
  keyPrefix = '',
): PageWidget[] {
  const result: PageWidget[] = [];
  for (const widget of widgets) {
    const loop = loopForRender(widget, editing);
    if (loop) {
      const items = resolveLoopItems(loop, scope);
      if (items.length === 0 && editing) {
        result.push(materialize(widget, scope, joinInstanceKey(keyPrefix, widget.id), editing));
        continue;
      }
      items.forEach((item, index) => {
        const unique = uniqueKeyOf(item, loop.key, index);
        const token = unique === String(index) ? String(index) : `${unique}-${index}`;
        const nextScope: BindingScope = {
          data: scope.data,
          props: scope.props,
          query: scope.query,
          aliases: {
            ...scope.aliases,
            [loopItemName(loop)]: item,
            [loopIndexName(loop)]: index,
            $item: item,
            $index: index,
          },
        };
        result.push(materialize(widget, nextScope, joinInstanceKey(keyPrefix, widget.id, token), editing));
      });
      continue;
    }
    result.push(materialize(widget, scope, joinInstanceKey(keyPrefix, widget.id), editing));
  }
  return result;
}
