import { createElement, useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  pageI18nDir,
  parsePageXml,
  pickPageLocale,
  resolveWidgetTree,
  type PageI18n,
  type PageWidget,
} from '@vanstack/xml';
import { pageCss } from './css';
import { widgetElement } from './elements';
import { HOVER_STATE_NAME, mergeHoverViewing, widgetHasHoverState } from './hover';
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

export function LowcodePage({ xml, editing, locale, catalog, viewing }: LowcodePageProps): ReactElement {
  const page = useMemo(() => parsePageXml(xml), [xml]);
  const [hoverOwnerIds, setHoverOwnerIds] = useState<string[]>([]);

  useEffect(() => {
    setHoverOwnerIds([]);
  }, [xml, editing]);

  const effectiveViewing = useMemo(
    () => (editing ? viewing : mergeHoverViewing(viewing, hoverOwnerIds)),
    [editing, viewing, hoverOwnerIds],
  );
  const widgets = useMemo(() => resolveWidgetTree(page.widgets, effectiveViewing), [page.widgets, effectiveViewing]);
  const currentLocale = locale || pickPageLocale(catalog);
  const dir = pageI18nDir(catalog, currentLocale);

  function hoverFor(widget: PageWidget): WidgetHoverHandlers | undefined {
    if (editing || !widgetHasHoverState(widget)) {
      return undefined;
    }
    return {
      onMouseEnter: () => {
        setHoverOwnerIds((prev) => (prev.includes(widget.id) ? prev : [...prev, widget.id]));
      },
      onMouseLeave: () => {
        setHoverOwnerIds((prev) => prev.filter((id) => id !== widget.id));
      },
    };
  }

  function render(widget: PageWidget): ReactElement {
    return widgetElement(widget, {
      editing,
      animate: !editing,
      catalog,
      locale: currentLocale,
      hoverFor,
      render,
    });
  }

  return createElement(
    'div',
    {
      className: 'lowcode-page',
      dir,
      'data-hover-active': hoverOwnerIds.length > 0 ? HOVER_STATE_NAME : undefined,
      style: { ...pageCss(page.style), direction: dir },
    },
    widgets.map((widget) => render(widget)),
  );
}
