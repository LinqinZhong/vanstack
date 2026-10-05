import { createElement, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  buildPropsRecord,
  resolvePageData,
  normalizeInputModelValue,
  propModelName,
  validateDataLiteral,
  pageI18nDir,
  pickPageLocale,
  resolveWidgetTree,
  type BindingScope,
  type PageI18n,
  type PageVariable,
  type PageWidget,
  type PageXmlDocument,
  type WidgetStateLayer,
} from '@vanstack/xml';
import { pageCss, pageCssText, pageScrollCss } from './css';
import { widgetElement } from './elements';
import { HOVER_STATE_NAME, resolveRuntimeOwnState, widgetHasHoverState } from './hover';
import { expandLoopTree, widgetInstanceKey, widgetInstanceMeta } from './loop';
import { setPageQuery } from './navigate';
import { usePageToast } from './toast';
import { pointEventPayload, runEventIds, timeEventPayload, type WidgetEventLoader } from './events';
import type { WidgetHoverHandlers } from './widget-render';

export type PageViewing =
  | Array<{ ownerId: string; state: string | null }>
  | { ownerId: string; state: string | null }
  | null;

export type LowcodePageProps = {
  page: PageXmlDocument;
  editing: boolean;
  tableLayout?: boolean;
  locale?: string;
  catalog?: PageI18n;
  viewing: PageViewing;
  dynamicTextLabel?: string;
  onModelValue?: (name: string, value: string, done?: boolean) => void;
  loadWidgetEvent?: WidgetEventLoader;
  pageId?: string | null;
  query?: Record<string, unknown>;
  components?: Record<string, PageXmlDocument>;
  centerContent?: boolean;
  useComponentTestData?: boolean;
};

const EMPTY_SCOPE: BindingScope = { data: Object.create(null) as Record<string, unknown> };
const EMPTY_QUERY: Record<string, unknown> = {};

function pageDataKey(data: PageVariable[] | undefined) {
  return (data ?? [])
    .map((variable) => `${variable.name}\0${variable.type}\0${variable.value}\0${variable.computed ? 1 : 0}`)
    .join('\n');
}

export function LowcodePage({ page, editing, tableLayout, locale, catalog, viewing, dynamicTextLabel, onModelValue, loadWidgetEvent, pageId, query, components, centerContent, useComponentTestData }: LowcodePageProps): ReactElement {
  const pageQuery = query ?? EMPTY_QUERY;
  const loaderRef = useRef(loadWidgetEvent);
  loaderRef.current = loadWidgetEvent;
  const eventsRef = useRef(page.events);
  eventsRef.current = page.events;
  const [hoverInstanceKeys, setHoverInstanceKeys] = useState<string[]>([]);
  const dataKey = pageDataKey(page.data);
  const [appliedDataKey, setAppliedDataKey] = useState(dataKey);
  const [modelOverrides, setModelOverrides] = useState<Record<string, string>>({});
  if (appliedDataKey !== dataKey) {
    setAppliedDataKey(dataKey);
    setModelOverrides((prev) => {
      const active = document.activeElement;
      const activeName = active instanceof HTMLElement ? active.dataset.modelName : undefined;
      if (!activeName || !Object.prototype.hasOwnProperty.call(prev, activeName)) {
        return {};
      }
      const incoming = page.data?.find((variable) => variable.name === activeName)?.value;
      if (prev[activeName] === incoming) {
        return {};
      }
      return { [activeName]: prev[activeName] };
    });
  }

  useEffect(() => {
    setHoverInstanceKeys([]);
  }, [page, editing]);

  useLayoutEffect(() => {
    if (editing) {
      return undefined;
    }
    setPageQuery(pageQuery);
    return () => {
      setPageQuery(EMPTY_QUERY);
    };
  }, [editing, pageQuery]);

  useEffect(() => {
    if (editing) {
      return undefined;
    }
    const loader = loaderRef.current;
    const events = eventsRef.current;
    let cancelled = false;
    const run = async (name: string, arg: unknown) => {
      if (cancelled || !loader) {
        return;
      }
      const ids = events?.[name];
      if (!ids?.length) {
        return;
      }
      await runEventIds(loader, ids, [arg], pageQuery);
    };
    void (async () => {
      await run('init', timeEventPayload());
      await run('beforeload', timeEventPayload());
      await run('load', timeEventPayload());
      await run('beforeshow', timeEventPayload());
      await run('show', timeEventPayload());
    })();
    return () => {
      cancelled = true;
      const leave = timeEventPayload();
      const before = events?.beforeleave;
      const left = events?.left;
      if (!loader || (!before?.length && !left?.length)) {
        return;
      }
      void (async () => {
        if (before?.length) {
          await runEventIds(loader, before, [leave], pageQuery);
        }
        if (left?.length) {
          await runEventIds(loader, left, [leave], pageQuery);
        }
      })();
    };
  }, [editing, pageId, pageQuery]);

  function runPageTouch(name: 'touchstart' | 'touchmove' | 'touchend', event: unknown) {
    if (editing) {
      return;
    }
    const loader = loaderRef.current;
    const ids = eventsRef.current?.[name];
    if (!loader || !ids?.length) {
      return;
    }
    void runEventIds(loader, ids, [pointEventPayload(event)]);
  }

  const propsScope = useMemo(() => {
    const live = (page.props ?? []).map((prop) => {
      const key = `$props.${prop.name}`;
      if (!Object.prototype.hasOwnProperty.call(modelOverrides, key)) {
        return prop;
      }
      return { ...prop, value: modelOverrides[key] };
    });
    return buildPropsRecord(live, pageQuery);
  }, [page.props, modelOverrides, pageQuery]);
  const dataProps = useMemo(() => buildPropsRecord(page.props, pageQuery), [page.props, pageQuery]);
  const dataOverrides = useMemo(() => {
    const overrides: Record<string, string> = Object.create(null);
    let any = false;
    for (const variable of page.data ?? []) {
      if (!Object.prototype.hasOwnProperty.call(modelOverrides, variable.name)) {
        continue;
      }
      any = true;
      const raw = modelOverrides[variable.name];
      overrides[variable.name] =
        variable.type === 'num' ? (normalizeInputModelValue('number', raw) ?? variable.value) : raw;
    }
    return any ? overrides : undefined;
  }, [page.data, modelOverrides]);
  const dataScope = useMemo(
    () => resolvePageData(page.data, dataOverrides, dataProps, propsScope, pageQuery),
    [page.data, dataOverrides, dataProps, propsScope, pageQuery],
  );
  const { widgets, stateLayers } = useMemo(() => {
    const sink = new WeakMap<object, WidgetStateLayer[]>();
    const expanded = expandLoopTree(page.widgets, { data: dataScope, props: propsScope, query: pageQuery, aliases: {} }, editing);
    const resolved = resolveWidgetTree(expanded, editing ? viewing : null, {
      appliedStateFor: editing ? undefined : (widget) => resolveRuntimeOwnState(widget, hoverInstanceKeys),
      stateLayersSink: sink,
    });
    return { widgets: resolved, stateLayers: sink };
  }, [page.widgets, viewing, dataScope, propsScope, pageQuery, editing, hoverInstanceKeys]);
  const toast = usePageToast();
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

  function commitModelValue(name: string, value: string, done?: boolean) {
    const propName = propModelName(name);
    if (propName) {
      const prop = page.props?.find((item) => item.name === propName && item.bind);
      if (!prop) {
        return;
      }
      const stored =
        prop.type === 'num'
          ? normalizeInputModelValue('number', value)
          : prop.type === 'bool'
            ? value === '1' || value === 'true'
              ? '1'
              : '0'
            : prop.type === 'str'
              ? value
              : prop.type === 'arr' && validateDataLiteral(value, 'arr')
                ? value
                : prop.type === 'obj' && validateDataLiteral(value, 'obj')
                  ? value
                  : null;
      if (stored == null) {
        return;
      }
      const key = `$props.${propName}`;
      setModelOverrides((prev) => (prev[key] === stored ? prev : { ...prev, [key]: stored }));
      if (prop.value !== stored || done) {
        onModelValue?.(key, stored, done);
      }
      return;
    }
    const variable = page.data?.find((item) => item.name === name);
    if (!variable || (variable.computed && (variable.type === 'arr' || variable.type === 'obj'))) {
      return;
    }
    if (variable.type === 'arr') {
      if (!validateDataLiteral(value, 'arr')) {
        return;
      }
      setModelOverrides((prev) => (prev[name] === value ? prev : { ...prev, [name]: value }));
      if (variable.value !== value || done) {
        onModelValue?.(name, value, done);
      }
      return;
    }
    if (variable.type !== 'str' && variable.type !== 'num' && variable.type !== 'bool') {
      return;
    }
    if (variable.type === 'bool') {
      const stored = value === '1' || value === 'true' ? '1' : '0';
      setModelOverrides((prev) => (prev[name] === stored ? prev : { ...prev, [name]: stored }));
      if (variable.value !== stored || done) {
        onModelValue?.(name, stored, done);
      }
      return;
    }
    const stored = variable.type === 'num' ? normalizeInputModelValue('number', value) : value;
    if (stored == null) {
      return;
    }
    const shown = variable.type === 'num' && !done ? value : stored;
    setModelOverrides((prev) => (prev[name] === shown ? prev : { ...prev, [name]: shown }));
    const deferEmptyNumber = variable.type === 'num' && value.trim() === '' && !done;
    if (!deferEmptyNumber && (variable.value !== stored || done)) {
      onModelValue?.(name, stored, done);
    }
  }

  function render(
    widget: PageWidget,
    options?: {
      summarizeCopy?: boolean;
      componentStack?: string[];
      commitModelValue?: (name: string, value: string, done?: boolean) => void;
      /** 组件被放到别的页面上时，内部按入参求值并展开循环。 */
      instantiate?: boolean;
    },
  ): ReactElement {
    const meta = widgetInstanceMeta(widget);
    const summarizeCopy = Boolean(options?.summarizeCopy);
    const componentStack = options?.componentStack ?? [];
    const commit = options?.commitModelValue ?? commitModelValue;
    const instantiate = Boolean(options?.instantiate);
    return widgetElement(widget, {
      editing,
      tableLayout: Boolean(tableLayout),
      animate: instantiate || !editing,
      catalog,
      locale: currentLocale,
      evaluateBindings: instantiate || !editing,
      bindingScope: meta?.scope ?? EMPTY_SCOPE,
      instanceKey: meta?.key ?? widget.id,
      hoverInstanceKeys,
      hoverFor,
      summarizeCopy,
      dynamicTextLabel,
      pageData: page.data,
      modelOverrides,
      commitModelValue: commit,
      loadWidgetEvent,
      components,
      componentStack,
      useComponentTestData: Boolean(useComponentTestData),
      render: (child, childOptions) =>
        render(child, {
          summarizeCopy: childOptions?.summarizeCopy ?? summarizeCopy,
          componentStack: childOptions?.componentStack ?? componentStack,
          commitModelValue: childOptions?.commitModelValue ?? commit,
          instantiate: childOptions?.instantiate ?? instantiate,
        }),
      stateLayers,
    });
  }

  const bindingOptions = {
    evaluateBindings: !editing,
    bindingScope: { data: dataScope, props: propsScope, query: pageQuery },
  };
  return createElement(
    'div',
    {
      className: 'lowcode-page',
      dir,
      'data-hover-active': hoverInstanceKeys.length > 0 ? HOVER_STATE_NAME : undefined,
      style: {
        ...pageCss(page.style, editing, bindingOptions),
        direction: dir,
      },
      onTouchStart: editing ? undefined : (event: unknown) => runPageTouch('touchstart', event),
      onTouchMove: editing ? undefined : (event: unknown) => runPageTouch('touchmove', event),
      onTouchEnd: editing ? undefined : (event: unknown) => runPageTouch('touchend', event),
    },
    createElement('style', {
      key: 'lowcode-page-style',
      dangerouslySetInnerHTML: { __html: styleText },
    }),
    createElement(
      'div',
      {
        className: 'lowcode-page-scroll',
        style: {
          ...pageScrollCss(page.style, editing, bindingOptions),
          ...(centerContent ? { alignItems: 'center', justifyContent: 'center' } : null),
        },
      },
      widgets.map((widget) => render(widget)),
    ),
    toast,
  );
}
