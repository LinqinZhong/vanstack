import { createElement, useRef, type CSSProperties, type ReactElement } from 'react';
import {
  applyTestValues,
  buildPropsRecord,
  resolvePageData,
  isCopyBinding,
  propModelName,
  resolveCopyValue,
  resolveWidgetTree,
  type BindingScope,
  type ComponentProp,
  type PageStyle,
  type PageWidget,
  type PageXmlDocument,
} from '@vanstack/xml';
import { cssMeasure, cssText, dynamicStyleCss, flexItemCss, hiddenCss, mergeCss, pageCssText, widgetClassName, type WidgetCssOptions } from '../css';
import { resolveRuntimeOwnState } from '../hover';
import { expandLoopTree, widgetInstanceKey } from '../loop';
import { widgetCssOptions, widgetStateAttr, type WidgetRenderContext } from '../widget-render';

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
  if (type === 'str') {
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
  if (type === 'str') {
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
  evaluate: boolean,
) {
  const variables = (data ?? []).map((variable) => `${variable.name}\0${variable.type}\0${variable.value}`).join('\n');
  const propText = (props ?? []).map((prop) => `${prop.name}\0${prop.type}\0${prop.value}`).join('\n');
  const argText = Object.entries(args ?? {})
    .map(([name, value]) => `${name}=${value}`)
    .join('\n');
  return `${variables}\0${propText}\0${argText}\0${evaluate ? 1 : 0}`;
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
  const definedProps = ctx.useComponentTestData
    ? applyTestValues(nested?.props, nested?.testData?.props)
    : nested?.props;
  const query = ctx.bindingScope.query;
  const propsScope = buildPropsRecord(
    propsWithArgs(definedProps, widget.args, ctx.bindingScope, ctx.evaluateBindings),
    query,
  );
  const dataKey = `${componentDataKey(nested?.data, definedProps, widget.args, ctx.evaluateBindings)}\0${ctx.useComponentTestData ? 1 : 0}`;
  const createdRef = useRef<{ key: string; props: Record<string, unknown> } | null>(null);
  if (!createdRef.current || createdRef.current.key !== dataKey) {
    createdRef.current = { key: dataKey, props: propsScope };
  }
  const dataScope = resolvePageData(
    nested?.data,
    ctx.useComponentTestData ? nested?.testData?.data : undefined,
    createdRef.current.props,
    propsScope,
    query,
  );
  const scope = { data: dataScope, props: propsScope, query };
  const options = widgetCssOptions(ctx);
  const prefix = `${widget.id}__`;
  const expanded = nested
    ? expandLoopTree(prefixTree(nested.widgets, prefix), scope, false, widgetInstanceKey(widget))
    : [];
  const innerWidgets = nested
    ? resolveWidgetTree(
        expanded,
        null,
        ctx.editing
          ? undefined
          : {
              appliedStateFor: (child) => resolveRuntimeOwnState(child, ctx.hoverInstanceKeys ?? []),
              stateLayersSink: ctx.stateLayers,
            },
      )
    : [];

  const nestedStack = [...stack, widget.componentId];
  const dataArg = /^\$data\.([\p{ID_Start}$_][\p{ID_Continue}$]*)$/u;
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
        innerWidgets.length === 0 ? { minHeight: '72px', alignItems: 'center', justifyContent: 'center' } : undefined,
        dynamicStyleCss(widget.style, options),
        flexItemCss(widget.item, options),
        widget.item?.flexShrink == null ? { flexShrink: 0 } : undefined,
        widget.style?.height == null ? { minHeight: 'min-content' } : undefined,
        hiddenCss(widget.hidden, ctx.editing),
      ),
      onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
      onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
    },
    nested ? createElement('style', { dangerouslySetInnerHTML: { __html: pageCssText(innerWidgets) } }) : null,
    innerWidgets.length > 0
      ? innerWidgets.map((child) =>
          ctx.render(child, {
            componentStack: nestedStack,
            commitModelValue: commitNestedModel,
            instantiate: true,
          }),
        )
      : widget.name || widget.componentKey,
  );
}

export function renderComponent(
  widget: Extract<PageWidget, { type: 'component' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  return createElement(ComponentView, { key: ctx.instanceKey, widget, ctx });
}
