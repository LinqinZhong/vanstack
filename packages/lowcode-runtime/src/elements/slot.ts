import { createElement, type ReactElement } from 'react';
import { resolveWidgetTree, type PageWidget } from '@vanstack/xml';
import { dynamicStyleCss, flexItemCss, hiddenCss, mergeCss, presenceCss, widgetClassName } from '../css';
import { resolveRuntimeOwnState } from '../hover';
import { expandLoopTree, resolveSlotParamDefaults, slotOverrideMeta, widgetInstanceKey } from '../loop';
import { widgetCssOptions, widgetStateAttr, type WidgetRenderContext } from '../widget-render';

/** 把插槽入参求值结果序列化成 DOM 属性，供编辑器预览态读取展示（函数/大整数转字符串，保证可序列化）。 */
function serializeSlotParams(values: Record<string, unknown>): string {
  try {
    return JSON.stringify(values, (_key, value) => {
      const kind = typeof value;
      if (kind === 'bigint' || kind === 'function' || kind === 'symbol') {
        return String(value);
      }
      return value;
    });
  } catch {
    return '';
  }
}

export function renderSlot(
  widget: Extract<PageWidget, { type: 'slot' }>,
  ctx: WidgetRenderContext,
): ReactElement | null {
  const options = widgetCssOptions(ctx);
  const override = slotOverrideMeta(widget);
  let children: Array<ReactElement | null>;
  if (override) {
    // 外层页面覆盖了插槽内容：用外层作用域（叠加插槽参数）展开并渲染。
    const expanded = expandLoopTree(override.content, override.scope, false, widgetInstanceKey(widget));
    const resolved = resolveWidgetTree(expanded, ctx.viewing ?? null, {
      appliedStateFor: (child) => resolveRuntimeOwnState(child, ctx.editing ? [] : (ctx.hoverInstanceKeys ?? [])),
      stateLayersSink: ctx.stateLayers,
      locale: ctx.locale,
    });
    children = resolved.map((child) =>
      ctx.render(child, {
        componentStack: ctx.componentStack,
        commitModelValue: override.outer.commitModelValue,
        assignScope: override.outer.assignScope,
        instantiate: true,
        emit: override.outer.emit,
      }),
    );
  } else {
    // 插槽 children 是组件定义期的「调试节点」：组件定义编辑态默认显示占位符（隐藏调试节点），
    // 仅当进入该插槽的调试态（slotDebugId 命中）时显示；组件定义预览态（!editing）也显示。
    // 组件实例使用时不走此分支（实例模板已剔除插槽 children，改用 slotContent 覆盖内容）。
    const deferDebugChildren = Boolean(ctx.editing && ctx.slotChrome && ctx.slotDebugId !== widget.id);
    children = deferDebugChildren ? [] : widget.children.map((child) => ctx.render(child));
  }
  // 插槽 chrome 仅由 slotChrome 驱动：组件编辑态画布与组件定义编辑器（含其「预览」tab）
  // 显示占位/名称；外部页面使用组件实例时 slotChrome=false，不渲染占位符。
  // 组件定义预览态 editing=false，因此不能依赖 ctx.editing。
  const showChrome = Boolean(ctx.slotChrome);
  // 组件定义编辑器的预览态（slotChrome 且非编辑态）：把当前实例解析后的插槽入参挂到 DOM 上，
  // 供编辑器点击插槽时在「数据」面板里展示「声明 + 当前实例解析值」。
  const slotParamValues =
    ctx.slotChrome && !ctx.editing && !ctx.componentEditing
      ? (() => {
          const def = ctx.slotDefs?.find((item) => item.id === widget.slotId);
          if (!def?.params?.length) {
            return undefined;
          }
          return serializeSlotParams(resolveSlotParamDefaults(def.params, ctx.bindingScope));
        })()
      : undefined;
  const hasContent = children.some((child) => child != null);
  // 非组件编辑态下，空插槽仅用于占位，不应产生任何 DOM（不占空间、不显示）。
  if (!showChrome && !hasContent) {
    return null;
  }
  const isEmpty = showChrome && !hasContent;
  // 插槽调试态：页面根节点整体 visibility:hidden（保留布局，插槽仍按真实布局尺寸落位），
  // 只有被调试的插槽内部内容显示出来。循环会把同一插槽实例化多份，只让第一份显示，
  // 否则画布上会出现多份重复的调试内容。
  const debugTarget = ctx.slotDebugId === widget.id;
  const debugSeenKey = `debug:${widget.id}`;
  const showDebug = debugTarget && !ctx.slotChromeSeen?.has(debugSeenKey);
  if (showDebug) {
    ctx.slotChromeSeen?.add(debugSeenKey);
  }
  // 同类型（同 slotId）的插槽占位只保留第一个完整 chrome，其余降级为不可点选的占位框：
  // 循环/多次实例化会让同一插槽声明在画布上出现多份，逐个展示图标与名称会喧宾夺主。
  // 只有渲染 chrome 占位（isEmpty）时才登记，避免把有内容的插槽也算作已出现。
  let placeholderOnly = false;
  if (isEmpty && widget.slotId) {
    const seen = ctx.slotChromeSeen;
    if (seen) {
      if (seen.has(widget.slotId)) {
        placeholderOnly = true;
      } else {
        seen.add(widget.slotId);
      }
    }
  }
  // 占位符语义：插槽不是容器，只是占位符。组件定义里给插槽设置的尺寸只有一个作用——
  // 标示占位符的大小（仅组件编辑态的空插槽使用）。插槽被添加元素后占位符即被内容
  // 直接替换：插槽盒子 display:contents 完全消失，子元素直接成为插槽父级的子项参与
  // 布局（flex item / 普通流），元素大小只由元素自身决定，与插槽定义无关。
  // 插槽 DOM 仍保留 data-state / class 等结构属性：状态 CSS 用后代选择器级联，
  // display:contents 不影响后代匹配；visibility 可经它继承，display:none 仍移除整棵子树。
  const ownStyleCss = isEmpty ? dynamicStyleCss(widget.style, options) : undefined;
  const itemCss = isEmpty ? flexItemCss(widget.item, options) : undefined;
  if (placeholderOnly) {
    // 非首位占位：保留灰底与尺寸用于占位，但剥离 data-widget-id / data-widget-type="slot" /
    // data-slot-id 等 slot 语义属性（组件编辑态点选白名单依赖它们），因此鼠标点不中、
    // 不参与悬停高亮，点击等同于画布空白。
    return createElement('div', {
      key: ctx.instanceKey,
      className: 'lowcode-slot is-slot-placeholder',
      style: mergeCss(
        {
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          maxWidth: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        },
        ownStyleCss,
        itemCss,
        widget.item?.flexShrink == null ? { flexShrink: 0 } : undefined,
        widget.style?.height == null ? { minHeight: 'min-content' } : undefined,
        hiddenCss(widget.hidden, ctx.editing),
        presenceCss(widget, options),
        { background: 'rgba(0, 0, 0, 0.06)', minHeight: '72px', minWidth: '72px' },
      ),
    });
  }
  const slotName = showChrome && isEmpty ? widget.name?.trim() : '';
  const plugIcon = showChrome && isEmpty
    ? createElement('svg', { key: 'slot-plug', width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'rgba(0,0,0,0.35)', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
        createElement('path', { d: 'M9 2v6' }),
        createElement('path', { d: 'M15 2v6' }),
        createElement('path', { d: 'M6 8h12v3a6 6 0 0 1-12 0V8z' }),
        createElement('path', { d: 'M12 17v5' }),
      )
    : null;
  // 名称标签只服务于空占位符（跟在插头图标下方）；插槽被内容替换后不再渲染，
  // 否则 display:contents 下它会变成插槽父级的一个布局子项。
  const nameTag = slotName
    ? createElement(
        'span',
        { key: 'slot-name', className: 'lowcode-slot-name is-empty' },
        slotName,
      )
    : null;
  const body: Array<ReactElement | null> = isEmpty
    ? ([plugIcon, nameTag].filter(Boolean) as ReactElement[])
    : children;
  return createElement(
    'div',
    {
      key: ctx.instanceKey,
      className: `lowcode-slot ${widgetClassName(widget.id)}`,
      'data-widget-id': widget.id,
      'data-widget-type': 'slot',
      'data-slot-id': widget.slotId,
      'data-slot-params': slotParamValues,
      'data-state': widgetStateAttr(widget, ctx),
      style: isEmpty
        ? mergeCss(
            {
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
              maxWidth: '100%',
              alignItems: 'center',
              justifyContent: 'center',
            },
            ownStyleCss,
            itemCss,
            widget.item?.flexShrink == null ? { flexShrink: 0 } : undefined,
            widget.style?.height == null ? { minHeight: 'min-content' } : undefined,
            hiddenCss(widget.hidden, ctx.editing),
            presenceCss(widget, options),
            // 空插槽仅显示插头图标（16px），尺寸过小无法点选；仅在组件编辑态（此时才 isEmpty）出现。
            // 给最小可点击尺寸，参照 component.ts 空组件 minHeight: '72px' 的模式。
            { background: 'rgba(0, 0, 0, 0.06)', minHeight: '72px', minWidth: '72px' },
            // 被调试的插槽本身没有调试子节点时，仍需显示占位符，否则调试画布会全空白。
            showDebug ? { visibility: 'visible' } : undefined,
          )
        : mergeCss(
            // 占位符已被内容替换：插槽不生成盒子，只做状态/隐藏语义的透传节点。
            { display: 'contents' },
            hiddenCss(widget.hidden, ctx.editing),
            presenceCss(widget, options),
            // 插槽调试态：页面根节点整体 visibility:hidden（保留真实布局），
            // 只有被调试的这个插槽子树以 visible 覆盖继承值，于是画布上只显示插槽内部内容。
            showDebug ? { visibility: 'visible' } : undefined,
          ),
      onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
      onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
    },
    body,
  );
}
