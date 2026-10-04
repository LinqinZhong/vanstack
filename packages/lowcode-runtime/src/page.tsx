import { createElement, useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  buildPageDataScope,
  pageI18nDir,
  parsePageXml,
  pickPageLocale,
  resolveWidgetTree,
  type BindingScope,
  type PageI18n,
  type PageWidget,
  type WidgetStateLayer,
} from '@vanstack/xml';
import { pageCss, pageCssText } from './css';
import { widgetElement } from './elements';
import { HOVER_STATE_NAME, resolveRuntimeOwnState, widgetHasHoverState } from './hover';
import { expandLoopTree, widgetInstanceKey, widgetInstanceMeta } from './loop';
import type { WidgetHoverHandlers } from './widget-render';

export type PageViewing =
  | Array<{ ownerId: string; state: string | null }>
  | { ownerId: string; state: string | null }
  | null;

export type LowcodePageProps = {
  xml: string;
  editing: boolean;
  tableLayout?: boolean;
  locale?: string;
  catalog?: PageI18n;
  viewing: PageViewing;
  dynamicTextLabel?: string;
};

const EMPTY_SCOPE: BindingScope = { data: Object.create(null) as Record<string, unknown> };

export function LowcodePage({ xml, editing, tableLayout, locale, catalog, viewing, dynamicTextLabel }: LowcodePageProps): ReactElement {
  const page = useMemo(() => parsePageXml(xml), [xml]);
  const [hoverInstanceKeys, setHoverInstanceKeys] = useState<string[]>([]);

  useEffect(() => {
    setHoverInstanceKeys([]);
  }, [xml, editing]);

  const dataScope = useMemo(() => buildPageDataScope(page.data), [page.data]);
  const { widgets, stateLayers } = useMemo(() => {
    const sink = new WeakMap<object, WidgetStateLayer[]>();
    const expanded = expandLoopTree(page.widgets, { data: dataScope, aliases: {} }, editing);
    const resolved = resolveWidgetTree(expanded, editing ? viewing : null, {
      appliedStateFor: editing ? undefined : (widget) => resolveRuntimeOwnState(widget, hoverInstanceKeys),
      stateLayersSink: sink,
    });
    return { widgets: resolved, stateLayers: sink };
  }, [page.widgets, viewing, dataScope, editing, hoverInstanceKeys]);
  const currentLocale = locale || pickPageLocale(catalog);
  const dir = pageI18nDir(catalog, currentLocale);
  const styleText = useMemo(() => pageCssText(page.widgets), [page.widgets]);

  function hoverFor(widget: PageWidget): WidgetHoverHandlers | undefined {
    if (editing || !widgetHasHoverState(widget)) {
      return undefined;
    }
    const key = widgetInstanceKey(widget);
    return {
      onMouseEnter: () => {
        setHoverInstanceKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
      },
      onMouseLeave: () => {
        setHoverInstanceKeys((prev) => prev.filter((id) => id !== key));
      },
    };
  }

  function render(widget: PageWidget, options?: { summarizeCopy?: boolean }): ReactElement {
    const meta = widgetInstanceMeta(widget);
    const summarizeCopy = Boolean(options?.summarizeCopy);
    return widgetElement(widget, {
      editing,
      tableLayout: Boolean(tableLayout),
      animate: !editing,
      catalog,
      locale: currentLocale,
      evaluateBindings: !editing,
      bindingScope: meta?.scope ?? EMPTY_SCOPE,
      instanceKey: meta?.key ?? widget.id,
      hoverFor,
      summarizeCopy,
      dynamicTextLabel,
      render: (child, childOptions) => render(child, childOptions ?? options),
      stateLayers,
    });
  }

  return createElement(
    'div',
    {
      className: 'lowcode-page',
      dir,
      'data-hover-active': hoverInstanceKeys.length > 0 ? HOVER_STATE_NAME : undefined,
      style: { ...pageCss(page.style), direction: dir },
    },
    createElement('style', {
      key: 'lowcode-page-style',
      dangerouslySetInnerHTML: { __html: styleText },
    }),
    widgets.map((widget) => render(widget)),
  );
}
