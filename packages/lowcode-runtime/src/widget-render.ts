import type { ReactElement } from 'react';
import {
  isI18nCopyExpr,
  resolveCopyBinding,
  resolveI18nCopy,
  type BindingScope,
  type PageI18n,
  type PageWidget,
  type WidgetStateLayer,
} from '@vanstack/xml';
import type { WidgetCssOptions } from './css';

export type WidgetHoverHandlers = {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
};

export type WidgetRenderContext = {
  editing: boolean;
  animate: boolean;
  catalog: PageI18n | undefined;
  locale?: string;
  evaluateBindings: boolean;
  bindingScope: BindingScope;
  instanceKey: string;
  hoverFor: (widget: PageWidget) => WidgetHoverHandlers | undefined;
  render: (widget: PageWidget) => ReactElement;
  stateLayers?: WeakMap<object, WidgetStateLayer[]>;
};

export function widgetCssOptions(ctx: WidgetRenderContext): WidgetCssOptions {
  return {
    animate: ctx.animate,
    evaluateBindings: ctx.evaluateBindings,
    bindingScope: ctx.bindingScope,
  };
}

export function resolveWidgetCopy(raw: string, ctx: WidgetRenderContext): string {
  if (isI18nCopyExpr(raw)) {
    return resolveI18nCopy(raw, ctx.catalog, ctx.locale);
  }
  if (!ctx.evaluateBindings) {
    return raw;
  }
  return resolveCopyBinding(raw, ctx.bindingScope);
}

export function widgetStateAttr(widget: PageWidget, ctx: WidgetRenderContext): string | undefined {
  const layers = ctx.stateLayers?.get(widget);
  if (!layers || layers.length === 0) {
    return undefined;
  }
  return layers.map((layer) => layer.name).join(' ');
}
