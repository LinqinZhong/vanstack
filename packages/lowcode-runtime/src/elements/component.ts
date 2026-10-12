import { createElement, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import {
  applyTestValues,
  buildPropsRecord,
  resolvePageData,
  isCopyBinding,
  propModelName,
  resolveCopyValue,
  resolveWidgetTree,
  stripDataDrivenPresenceGates,
  type BindingScope,
  type ComponentProp,
  type ComponentSlot,
  type PageStyle,
  type PageWidget,
  type PageXmlDocument,
  type ScopeAssign,
} from '@vanstack/xml';
import { cssMeasure, cssText, dynamicStyleCss, flexItemCss, hiddenCss, mergeCss, pageCssText, presenceCss, widgetClassName, widgetPaintKey, type WidgetCssOptions } from '../css';
import { resolveRuntimeOwnState } from '../hover';
import { expandLoopTree, widgetInstanceKey } from '../loop';
import { formatStoredValue } from '../stored';
import { runEventIds } from '../events';
import { widgetCssOptions, widgetStateAttr, type WidgetRenderContext, type WidgetViewing } from '../widget-render';

/**
 * 组件编辑态下，状态栏「根控件」的查看状态以实例 id 为宿主发送，
 * 而内部树控件是 `${实例id}__${模板id}` 的 prefixed id，需要重映射后才能命中根控件。
 */
function remapInstanceViewing(viewing: WidgetViewing, instanceId: string, rootId: string | undefined): WidgetViewing {
  if (!viewing || !rootId) {
    return viewing;
  }
  const list = Array.isArray(viewing) ? viewing : [viewing];
  const mapped = list.map((item) =>
    item.ownerId === instanceId ? { ...item, ownerId: `${instanceId}__${rootId}` } : item,
  );
  // 进入组件编辑时残留的根控件项（`{instanceId}: null`）被重映射后，
  // 会与选中插槽后写入的继承态项（`{instanceId}__rootId}: stateId`）撞成同一 ownerId。
  // `ownerActiveState` 用 `viewing.find` 命中顺序靠前项，空值会遮蔽显式选择，
  // 因此按 ownerId 去重并让非空 state 优先。
  const byOwner = new Map<string, { ownerId: string; state: string | null }>();
  for (const item of mapped) {
    const existing = byOwner.get(item.ownerId);
    if (!existing || item.state != null) {
      byOwner.set(item.ownerId, item);
    }
  }
  const deduped = Array.from(byOwner.values());
  return Array.isArray(viewing) ? deduped : deduped[0];
}

function prefixTree(widgets: PageWidget[], prefix: string): PageWidget[] {
  return widgets.map((widget) => {
    const id = `${prefix}${widget.id}`;
    if ('children' in widget && widget.children) {
      return { ...widget, id, children: prefixTree(widget.children, prefix) };
    }
    return { ...widget, id };
  });
}

function frameStyle(style: PageStyle | undefined, options: WidgetCssOptions): CSSProperties {
  const css: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    boxSizing: 'border-box',
    maxWidth: '100%',
  };
  const background = cssText(style?.background, options);
  if (background) {
    css.background = background;
  }
  const paddingTop = cssMeasure(style?.paddingTop, options);
  const paddingRight = cssMeasure(style?.paddingRight, options);
  const paddingBottom = cssMeasure(style?.paddingBottom, options);
  const paddingLeft = cssMeasure(style?.paddingLeft, options);
  if (paddingTop) {
    css.paddingTop = paddingTop;
  }
  if (paddingRight) {
    css.paddingRight = paddingRight;
  }
  if (paddingBottom) {
    css.paddingBottom = paddingBottom;
  }
  if (paddingLeft) {
    css.paddingLeft = paddingLeft;
  }
  return css;
}

function storeResolvedProp(type: ComponentProp['type'], value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (type === 'str' || type === 'icon' || type === 'image') {
    return typeof value === 'string' ? value : String(value);
  }
  if (type === 'num') {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? String(parsed) : null;
  }
  if (type === 'bool') {
    if (value === true || value === '1' || value === 'true') {
      return '1';
    }
    if (value === false || value === '0' || value === 'false') {
      return '0';
    }
    return null;
  }
  if (type === 'arr') {
    return Array.isArray(value) ? JSON.stringify(value) : null;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }
  return null;
}

function literalPropValue(type: ComponentProp['type'], raw: string): string | null {
  if (type === 'str' || type === 'icon' || type === 'image') {
    return raw;
  }
  if (type === 'bool') {
    const lower = raw.toLowerCase();
    if (lower === '1' || lower === 'true') {
      return '1';
    }
    if (lower === '0' || lower === 'false') {
      return '0';
    }
    return null;
  }
  if (type === 'num') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? String(parsed) : null;
  }
  return raw;
}

/** 插槽参数的字面量按声明类型转成实际值。 */
function literalSlotValue(type: ComponentProp['type'] | undefined, raw: string): unknown {
  if (!type || type === 'str' || type === 'icon' || type === 'image') {
    return raw;
  }
  if (type === 'bool') {
    const lower = raw.toLowerCase();
    if (lower === '1' || lower === 'true') {
      return true;
    }
    if (lower === '0' || lower === 'false') {
      return false;
    }
    return undefined;
  }
  if (type === 'num') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** 在外层作用域里求值组件实例上的插槽参数。 */
function evaluateSlotArgs(
  slotArgs: Record<string, Record<string, string>> | undefined,
  defs: ComponentSlot[] | undefined,
  scope: BindingScope,
  evaluate: boolean,
): Record<string, Record<string, unknown>> | undefined {
  if (!slotArgs) {
    return undefined;
  }
  const out: Record<string, Record<string, unknown>> = {};
  for (const [slotId, args] of Object.entries(slotArgs)) {
    const def = defs?.find((item) => item.id === slotId);
    const values: Record<string, unknown> = {};
    for (const [param, text] of Object.entries(args)) {
      const raw = text.trim();
      if (!raw) {
        continue;
      }
      if (isCopyBinding(raw)) {
        if (evaluate) {
          const value = resolveCopyValue(raw, scope);
          if (value !== undefined) {
            values[param] = value;
          }
        }
        continue;
      }
      const paramDef = def?.params?.find((item) => item.name === param);
      const value = literalSlotValue(paramDef?.type, raw);
      if (value !== undefined) {
        values[param] = value;
      }
    }
    if (Object.keys(values).length > 0) {
      out[slotId] = values;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function slotArgsText(slotArgs: Record<string, Record<string, string>> | undefined): string {
  if (!slotArgs) {
    return '';
  }
  return Object.entries(slotArgs)
    .map(([name, args]) => `${name}\x01${Object.entries(args).map(([key, value]) => `${key}=${value}`).join('\x02')}`)
    .join('\n');
}

function propsWithArgs(
  props: ComponentProp[] | undefined,
  args: Record<string, string> | undefined,
  parent: BindingScope,
  evaluate: boolean,
): ComponentProp[] | undefined {
  if (!props?.length || !args) {
    return props;
  }
  return props.map((prop) => {
    const raw = args[prop.name]?.trim();
    if (!raw) {
      return prop;
    }
    if (isCopyBinding(raw)) {
      if (!evaluate) {
        return prop;
      }
      const stored = storeResolvedProp(prop.type, resolveCopyValue(raw, parent));
      return stored == null ? prop : { ...prop, value: stored };
    }
    const stored = literalPropValue(prop.type, raw);
    return stored == null ? prop : { ...prop, value: stored };
  });
}

function componentDataKey(
  data: PageXmlDocument['data'],
  props: PageXmlDocument['props'],
  args: Record<string, string> | undefined,
  slotArgs: Record<string, Record<string, string>> | undefined,
  evaluate: boolean,
) {
  const variables = (data ?? []).map((variable) => `${variable.name}\0${variable.type}\0${variable.value}`).join('\n');
  const propText = (props ?? []).map((prop) => `${prop.name}\0${prop.type}\0${prop.value}`).join('\n');
  const argText = Object.entries(args ?? {})
    .map(([name, value]) => `${name}=${value}`)
    .join('\n');
  return `${variables}\0${propText}\0${argText}\0${slotArgsText(slotArgs)}\0${evaluate ? 1 : 0}`;
}

function ComponentView({
  widget,
  ctx,
}: {
  widget: Extract<PageWidget, { type: 'component' }>;
  ctx: WidgetRenderContext;
}) {
  const stack = ctx.componentStack ?? [];
  const doc = ctx.components?.[widget.componentId];
  const nested = doc && !stack.includes(widget.componentId) ? doc : undefined;
  // 组件编辑态下：正在编辑的组件实例（widget.id === componentEditId）无视实例入参/编辑覆盖，
  // 直接使用组件自身的 testData；其余嵌套组件（loop 内子组件等）用 loop 传入的 args，
  // 避免它们被全局 componentEditing 误伤成自身 testData。
  const editingThis = Boolean(ctx.componentEditing) && widget.id === ctx.componentEditId;
  const useTestProps = editingThis
    ? true
    : Boolean(ctx.useComponentTestData) && !widget.editProps && !ctx.componentEditing;
  const definedProps = useTestProps
    ? applyTestValues(nested?.props, nested?.testData?.props)
    : nested?.props;
  const evaluateArgs = editingThis ? false : (ctx.evaluateBindings || Boolean(widget.editProps));
  const query = ctx.bindingScope.query;
  const dataKey = `${componentDataKey(nested?.data, definedProps, widget.args, widget.slotArgs, evaluateArgs)}\0${useTestProps ? 1 : 0}`;
  const [writesStamp, setWritesStamp] = useState(dataKey);
  const [writes, setWrites] = useState<Record<string, string>>({});
  if (writesStamp !== dataKey) {
    setWritesStamp(dataKey);
    setWrites({});
  }
  const activeWrites = writesStamp === dataKey ? writes : {};
  const instanceArgs = editingThis ? undefined : widget.args;
  const writtenProps = applyPropWrites(propsWithArgs(definedProps, instanceArgs, ctx.bindingScope, evaluateArgs), activeWrites);
  const propsScope = buildPropsRecord(writtenProps, query);
  const createdRef = useRef<{ key: string; props: Record<string, unknown> } | null>(null);
  const childCache = useRef<{ key: string; nodes: Array<ReactElement | null> } | null>(null);
  if (!createdRef.current || createdRef.current.key !== dataKey) {
    createdRef.current = { key: dataKey, props: propsScope };
  }
  const dataWrites = dataWritesFrom(activeWrites);
  const testData = ctx.useComponentTestData ? nested?.testData?.data : undefined;
  const dataOverride = { ...testData, ...dataWrites };
  const dataScope = resolvePageData(
    nested?.data,
    Object.keys(dataOverride).length > 0 ? dataOverride : undefined,
    createdRef.current.props,
    propsScope,
    query,
  );
  const scope = { data: dataScope, props: propsScope, query, aliases: { ...ctx.bindingScope.aliases } };
  const options = widgetCssOptions(ctx);
  const prefix = `${widget.id}__`;
  const template = nested ? prefixTree(nested.widgets, prefix) : [];
  const prefixedSlotContent = widget.slotContent
    ? Object.fromEntries(
        Object.entries(widget.slotContent).map(([name, widgets]) => [name, prefixTree(widgets, `${prefix}slot-${name}__`)]),
      )
    : undefined;
  const paintSource = prefixedSlotContent ? [...template, ...Object.values(prefixedSlotContent).flat()] : template;
  const nestedStyle = paintSource.length > 0 ? pageCssText(paintSource) : '';
  const slotArgValues = evaluateSlotArgs(widget.slotArgs, nested?.slots, ctx.bindingScope, evaluateArgs);
  const nestedStack = [...stack, widget.componentId];
  const dataArg = /^\$data\.([\p{ID_Start}$_][\p{ID_Continue}$]*)$/u;
  const assignScope: ScopeAssign = (bucket, name, value) => {
    if (bucket === 'query') {
      ctx.assignScope?.(bucket, name, value);
      return;
    }
    const stored = formatStoredValue(value);
    if (bucket === 'props') {
      if (!definedProps?.some((prop) => prop.name === name)) {
        return;
      }
      propsScope[name] = value;
      setWrites((prev) => (prev[`$props.${name}`] === stored ? prev : { ...prev, [`$props.${name}`]: stored }));
      const target = dataArg.exec(widget.args?.[name]?.trim() ?? '');
      if (target) {
        ctx.assignScope?.('data', target[1], value);
      } else if (definedProps.some((prop) => prop.name === name && prop.bind)) {
        ctx.assignScope?.('props', name, value);
      }
      return;
    }
    const variable = nested?.data?.find((item) => item.name === name);
    if (!variable || (variable.computed && (variable.type === 'arr' || variable.type === 'obj'))) {
      return;
    }
    dataScope[name] = value;
    setWrites((prev) => (prev[name] === stored ? prev : { ...prev, [name]: stored }));
  };
  const emitEvent = (name: string, ...args: unknown[]) => {
    if (!nested?.emits?.some((item) => item.name === name)) {
      return;
    }
    const ids = widget.events?.[name];
    if (!ids?.length || !ctx.loadWidgetEvent) {
      return;
    }
    void runEventIds(ctx.loadWidgetEvent, ids, args, {
      data: ctx.bindingScope.data,
      props: ctx.bindingScope.props,
      query: ctx.bindingScope.query,
      aliases: ctx.bindingScope.aliases,
      assign: ctx.assignScope,
      emit: ctx.emit,
    });
  };
  function commitNestedModel(name: string, value: string, done?: boolean) {
    const propName = propModelName(name);
    if (!propName) {
      ctx.commitModelValue?.(name, value, done);
      return;
    }
    const target = dataArg.exec(widget.args?.[propName]?.trim() ?? '');
    if (target) {
      ctx.commitModelValue?.(target[1], value, done);
    }
  }

  // childKey 必须覆盖内部树求值实际依赖的动态值：
  // - propsValueKey：入参绑定在外层作用域的求值结果 + 组件内部对入参的写入。
  //   dataKey 只含有 args 的表达式文本，外层数据变化时它不变，仅靠它会命中旧缓存。
  // - dataWritesValueKey：组件事件对内部 data 变量的写入。
  // - queryValueKey：$query 变化同样需要让内部树重新求值。
  const propsValueKey = (writtenProps ?? [])
    .map((prop) => `${prop.name}\0${prop.type}\0${prop.value}`)
    .join('\n');
  const slotValueKey = slotArgValues
    ? Object.entries(slotArgValues)
        .map(([name, values]) => `${name}\x01${Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value) ?? ''}`).join('\x02')}`)
        .join('\n')
    : '';
  const dataWritesValueKey = Object.entries(dataWrites)
    .map(([name, value]) => `${name}\0${value}`)
    .join('\n');
  const queryValueKey = JSON.stringify(query ?? {});
  const viewingKey = ctx.viewing
    ? (Array.isArray(ctx.viewing) ? ctx.viewing : [ctx.viewing])
        .map((item) => `${item.ownerId}\0${item.state ?? ''}`)
        .join('\n')
    : '';
  const childKey = [
    widgetPaintKey(paintSource),
    dataKey,
    writesStamp,
    ctx.editing ? '1' : '0',
    ctx.slotChrome ? '1' : '0',
    ctx.componentEditing ? '1' : '0',
    (ctx.hoverInstanceKeys ?? []).join(','),
    ctx.locale ?? '',
    viewingKey,
    propsValueKey,
    slotValueKey,
    dataWritesValueKey,
    queryValueKey,
  ].join('\0');
  if (!childCache.current || childCache.current.key !== childKey) {
    // 先展开循环，再按每一项求 state()。样式仍用模板，避免某一项的状态写进共用 class。
    const slotExpand = nested
      ? {
          defs: nested.slots,
          args: slotArgValues,
          content: prefixedSlotContent,
          outer: {
            scope: ctx.bindingScope,
            assignScope: ctx.assignScope,
            commitModelValue: ctx.commitModelValue,
            emit: ctx.emit,
          },
        }
      : undefined;
    const expanded = nested ? expandLoopTree(template, scope, false, widgetInstanceKey(widget), slotExpand) : [];
    const innerWidgets = nested
      ? resolveWidgetTree(
          // 组件编辑态下显示与数据解耦：剔除引用绑定的存在/显示/可见闸门（常量闸门保留），
          // 显隐只由状态栏选中的查看状态（delta presence）驱动。
          editingThis ? stripDataDrivenPresenceGates(expanded) : expanded,
          remapInstanceViewing(ctx.viewing ?? null, widget.id, nested.widgets[0]?.id),
          {
            // 组件编辑态下不自动求值 stateFn：状态激活只来自状态栏选择。
            appliedStateFor: editingThis
              ? undefined
              : (child) => resolveRuntimeOwnState(child, ctx.editing ? [] : (ctx.hoverInstanceKeys ?? [])),
            stateLayersSink: ctx.stateLayers,
            locale: ctx.locale,
          },
        )
      : [];
    childCache.current = {
      key: childKey,
      nodes: innerWidgets.map((child) =>
        ctx.render(child, {
          componentStack: nestedStack,
          commitModelValue: commitNestedModel,
          assignScope,
          instantiate: true,
          emit: emitEvent,
        }),
      ),
    };
  }
  const innerNodes = childCache.current.nodes;

  return createElement(
    'div',
    {
      key: ctx.instanceKey,
      className: `lowcode-component ${widgetClassName(widget.id)}`,
      'data-widget-id': widget.id,
      'data-widget-type': 'component',
      'data-state': widgetStateAttr(widget, ctx),
      style: mergeCss(
        frameStyle(nested?.style, { ...options, bindingScope: scope }),
        innerNodes.length === 0 ? { minHeight: '72px', alignItems: 'center', justifyContent: 'center' } : undefined,
        dynamicStyleCss(widget.style, options),
        flexItemCss(widget.item, options),
        widget.item?.flexShrink == null ? { flexShrink: 0 } : undefined,
        widget.style?.height == null ? { minHeight: 'min-content' } : undefined,
        hiddenCss(widget.hidden, ctx.editing),
        presenceCss(widget, options),
      ),
      onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
      onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
    },
    nested ? createElement('style', { dangerouslySetInnerHTML: { __html: nestedStyle } }) : null,
    innerNodes.length > 0 ? innerNodes : widget.name || widget.componentKey,
  );
}

function applyPropWrites(
  props: ReturnType<typeof propsWithArgs>,
  writes: Record<string, string>,
) {
  if (!props) {
    return props;
  }
  return props.map((prop) => {
    const stored = writes[`$props.${prop.name}`];
    return stored === undefined ? prop : { ...prop, value: stored };
  });
}

function dataWritesFrom(writes: Record<string, string>): Record<string, string> {
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(writes)) {
    if (!key.startsWith('$props.')) {
      data[key] = value;
    }
  }
  return data;
}

export function renderComponent(
  widget: Extract<PageWidget, { type: 'component' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  return createElement(ComponentView, { key: ctx.instanceKey, widget, ctx });
}
