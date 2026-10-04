import { createElement, type ReactElement, type ReactNode } from 'react';
import {
  describeCopyBinding,
  isI18nCopyExpr,
  resolveCopyBinding,
  resolveI18nCopy,
  type BindingScope,
  type PageI18n,
  type PageVariable,
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
  tableLayout?: boolean;
  animate: boolean;
  catalog: PageI18n | undefined;
  locale?: string;
  evaluateBindings: boolean;
  bindingScope: BindingScope;
  instanceKey: string;
  hoverFor: (widget: PageWidget) => WidgetHoverHandlers | undefined;
  render: (widget: PageWidget, options?: { summarizeCopy?: boolean }) => ReactElement;
  summarizeCopy?: boolean;
  dynamicTextLabel?: string;
  stateLayers?: WeakMap<object, WidgetStateLayer[]>;
  pageData?: PageVariable[];
  modelOverrides?: Readonly<Record<string, string>>;
  commitModelValue?: (name: string, value: string, done?: boolean) => void;
  loadWidgetEvent?: (id: string) => Promise<string | null>;
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

const DYNAMIC_TEXT = '动态文本';

function placeCopyTip(tip: HTMLElement, clientX: number, clientY: number) {
  const margin = 8;
  const width = tip.offsetWidth;
  const height = tip.offsetHeight;
  const maxX = Math.max(margin, window.innerWidth - width - margin);
  const maxY = Math.max(margin, window.innerHeight - height - margin);
  tip.style.left = `${Math.min(Math.max(margin, clientX + 12), maxX)}px`;
  tip.style.top = `${Math.min(Math.max(margin, clientY + 16), maxY)}px`;
}

function copyTipHandlers(source: string) {
  let tip: HTMLDivElement | null = null;
  const clear = () => {
    tip?.remove();
    tip = null;
  };
  return {
    onMouseEnter(event: { clientX: number; clientY: number }) {
      document.querySelectorAll('.lowcode-dynamic-copy-tip').forEach((node) => node.remove());
      tip = document.createElement('div');
      tip.className = 'lowcode-dynamic-copy-tip';
      tip.textContent = source;
      document.body.append(tip);
      placeCopyTip(tip, event.clientX, event.clientY);
    },
    onMouseMove(event: { clientX: number; clientY: number }) {
      if (tip) {
        placeCopyTip(tip, event.clientX, event.clientY);
      }
    },
    onMouseLeave: clear,
  };
}

/** 编辑态不求值时，把绑定收成短标签；静态文案保持原文。 */
export function displayWidgetCopy(raw: string, ctx: WidgetRenderContext, summarize: boolean): ReactNode {
  if (!summarize) {
    return resolveWidgetCopy(raw, ctx);
  }
  const described = describeCopyBinding(raw);
  if (described.kind === 'expr') {
    return createElement(
      'span',
      {
        className: 'lowcode-dynamic-copy',
        title: described.source,
        ...copyTipHandlers(described.source),
      },
      ctx.dynamicTextLabel || DYNAMIC_TEXT,
    );
  }
  if (described.kind === 'path') {
    return described.field;
  }
  return resolveWidgetCopy(raw, ctx);
}

export function widgetStateAttr(widget: PageWidget, ctx: WidgetRenderContext): string | undefined {
  const layers = ctx.stateLayers?.get(widget);
  if (!layers || layers.length === 0) {
    return undefined;
  }
  return layers.map((layer) => layer.id).join(' ');
}
