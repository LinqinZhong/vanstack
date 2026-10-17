import {
  buildPropsRecord,
  compactLoop,
  evaluateBindingExpression,
  isCopyBinding,
  isLoopConfigured,
  loopIndexName,
  loopItemName,
  resolveCopyValue,
  setWidgetRuntimeMeta,
  getWidgetRuntimeMeta,
  type BindingScope,
  type ComponentProp,
  type ComponentSlot,
  type PageWidget,
  type ScopeAssign,
  type WidgetLoop,
  type WidgetSlotOverrideMeta,
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

/** 组件实例向外层页面提供的插槽上下文。 */
export type SlotExpandContext = {
  /** 组件声明的插槽，用来取参数默认值。 */
  defs?: ComponentSlot[];
  /** 外层传入的插槽参数（已求值）。 */
  args?: Record<string, Record<string, unknown>>;
  /** 外层覆盖的插槽内容（已加前缀）。 */
  content?: Record<string, PageWidget[]>;
  /** 覆盖内容渲染时使用的外层上下文。 */
  outer?: {
    scope: BindingScope;
    assignScope?: ScopeAssign;
    commitModelValue?: (name: string, value: string, done?: boolean) => void;
    emit?: (name: string, ...args: unknown[]) => void;
  };
};

export type SlotOverrideMeta = WidgetSlotOverrideMeta;

/**
 * 插槽覆盖内容挂在控件的 runtime meta 上（而不是独立 WeakMap）：
 * resolveWidgetNode 会克隆每个控件并调用 copyWidgetRuntimeMeta 复制 meta，
 * 独立 WeakMap 的映射在克隆后会丢失，导致插槽内容永远渲染不出来。
 */
export function slotOverrideMeta(widget: object): SlotOverrideMeta | undefined {
  return getWidgetRuntimeMeta(widget)?.slotOverride;
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

/**
 * 插槽出参默认值：写成 `$(表达式)`（或 `$props.x` 这类路径绑定）时按组件内部作用域求值，
 * 其余字面量沿用 buildPropsRecord 按类型转换的语义。
 */
export function resolveSlotParamDefaults(
  params: ComponentProp[] | undefined,
  scope: BindingScope,
): Record<string, unknown> {
  const record = buildPropsRecord(params, scope.query);
  for (const param of params ?? []) {
    if (isCopyBinding(param.value)) {
      record[param.name] = resolveCopyValue(param.value, scope);
    }
  }
  return record;
}

function materialize(
  widget: PageWidget,
  scope: BindingScope,
  key: string,
  editing: boolean,
  slotCtx?: SlotExpandContext,
): PageWidget {
  const next = { ...widget };
  let finalScope = scope;
  let slotOverride: WidgetSlotOverrideMeta | undefined;
  if (next.type === 'slot' && slotCtx) {
    const def = slotCtx.defs?.find((item) => item.id === next.slotId);
    const defaults = resolveSlotParamDefaults(def?.params, scope);
    const overrides = slotCtx.args?.[next.slotId];
    const params: Record<string, unknown> = { ...defaults, ...(overrides ?? {}) };
    finalScope = { ...scope, slot: params };
    const content = slotCtx.content?.[next.slotId];
    if (content && content.length > 0 && slotCtx.outer) {
      slotOverride = {
        content,
        scope: { ...slotCtx.outer.scope, slot: params },
        outer: slotCtx.outer,
      };
    }
    // 插槽的存在/显示/可见（含组件定义中各状态下的配置）必须原样保留：
    // 组件实例化后由 resolveWidgetTree 按当前状态叠加 presence，
    // 默认态删除的插槽不应在实例中被强制显示。
  }
  if ('children' in next && Array.isArray(next.children)) {
    next.children = expandLoopTree(next.children, finalScope, editing, key, slotCtx);
  }
  setWidgetRuntimeMeta(next, { scope: finalScope, key, ...(slotOverride ? { slotOverride } : {}) });
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
  slotCtx?: SlotExpandContext,
): PageWidget[] {
  const result: PageWidget[] = [];
  for (const widget of widgets) {
    const loop = loopForRender(widget, editing);
    if (loop) {
      const items = resolveLoopItems(loop, scope);
      if (items.length === 0 && editing) {
        result.push(materialize(widget, scope, joinInstanceKey(keyPrefix, widget.id), editing, slotCtx));
        continue;
      }
      items.forEach((item, index) => {
        const unique = uniqueKeyOf(item, loop.key, index);
        const token = unique === String(index) ? String(index) : `${unique}-${index}`;
        const nextScope: BindingScope = {
          data: scope.data,
          props: scope.props,
          query: scope.query,
          slot: scope.slot,
          aliases: {
            ...scope.aliases,
            [loopItemName(loop)]: item,
            [loopIndexName(loop)]: index,
            $item: item,
            $index: index,
          },
        };
        result.push(materialize(widget, nextScope, joinInstanceKey(keyPrefix, widget.id, token), editing, slotCtx));
      });
      continue;
    }
    result.push(materialize(widget, scope, joinInstanceKey(keyPrefix, widget.id), editing, slotCtx));
  }
  return result;
}
