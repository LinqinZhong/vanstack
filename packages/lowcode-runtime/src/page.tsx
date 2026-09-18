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
} from '@vanstack/xml';
import { pageCss } from './css';
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
  locale?: string;
  catalog?: PageI18n;
  viewing: PageViewing;
};

const EMPTY_SCOPE: BindingScope = { data: Object.create(null) as Record<string, unknown> };

export function LowcodePage({ xml, editing, locale, catalog, viewing }: LowcodePageProps): ReactElement {
  const page = useMemo(() => parsePageXml(xml), [xml]);
  const [hoverInstanceKeys, setHoverInstanceKeys] = useState<string[]>([]);

  useEffect(() => {
    setHoverInstanceKeys([]);
  }, [xml, editing]);

  const dataScope = useMemo(() => buildPageDataScope(page.data), [page.data]);
  const widgets = useMemo(() => {
    const expanded = expandLoopTree(page.widgets, { data: dataScope, aliases: {} }, editing);
    return resolveWidgetTree(expanded, editing ? viewing : null, {
      appliedNameFor: editing ? undefined : (widget) => resolveRuntimeOwnState(widget, hoverInstanceKeys),
    });
  }, [page.widgets, viewing, dataScope, editing, hoverInstanceKeys]);
  const currentLocale = locale || pickPageLocale(catalog);
  const dir = pageI18nDir(catalog, currentLocale);

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

  function render(widget: PageWidget): ReactElement {
    const meta = widgetInstanceMeta(widget);
    return widgetElement(widget, {
      editing,
      animate: !editing,
      catalog,
      locale: currentLocale,
      evaluateBindings: !editing,
      bindingScope: meta?.scope ?? EMPTY_SCOPE,
      instanceKey: meta?.key ?? widget.id,
      hoverFor,
      render,
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
    widgets.map((widget) => render(widget)),
  );
}
