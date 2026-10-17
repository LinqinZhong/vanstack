import { createElement, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  buildPropsRecord,
  resolvePageData,
  DEFAULT_COMPONENT_DESIGN_SIZE,
  normalizeInputModelValue,
  propModelName,
  validateDataLiteral,
  pageI18nDir,
  pickPageLocale,
  PAGE_ROOT_STATE_OWNER_ID,
  pageStateRootWidget,
  resolvePageStyleWithStates,
  resolveStateFnId,
  resolveWidgetTree,
  type BindingScope,
  type ComponentProp,
  type PageI18n,
  type PageVariable,
  type PageWidget,
  type PageXmlDocument,
  type ScopeAssign,
  type WidgetStateLayer,
} from '@vanstack/xml';
import { libraryPaintKey, pageCss, pageCssText, pageScrollCss, widgetPaintKey } from './css';
import { bindDrawerHandles, drawerRailMetrics } from './elements/drawer';
import { bindComponentInstances, buildSelf, initMethodLocal, runMethodCode, type ComponentInstance } from './methods';
import { bindOverlayScrollbar } from './overlay-scrollbar';
import { widgetElement } from './elements';
import { HOVER_STATE_NAME, resolveRuntimeOwnState, widgetHasHoverState } from './hover';
import { expandLoopTree, widgetInstanceKey, widgetInstanceMeta } from './loop';
import { setPageQuery } from './navigate';
import { installPageAssets } from './asset';
import { installPageIcons } from './icon';
import { installPageI18n } from './i18n';
import { usePageToast } from './toast';
import { pointEventPayload, runEventIds, timeEventPayload, type ScriptScope, type WidgetEventLoader } from './events';
import { formatStoredValue } from './stored';
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
  onQueryValue?: (name: string, value: unknown) => void;
  loadWidgetEvent?: WidgetEventLoader;
  /** 按 id 取方法体代码：组件「控件」变量通过实例调用暴露方法时使用。 */
  loadFunction?: (id: string) => Promise<string | null>;
  pageId?: string | null;
  query?: Record<string, unknown>;
  components?: Record<string, PageXmlDocument>;
  centerContent?: boolean;
  useComponentTestData?: boolean;
  /** 组件编辑态：仅此时渲染组件实例内的插槽 chrome。 */
  slotChrome?: boolean;
  /** 组件定义编辑器：正在调试的插槽 id（隔离显示其内部调试节点）。 */
  slotDebugId?: string | null;
  /** 组件编辑态：实例内部树与数据解耦，显示只由查看状态驱动。 */
  componentEditing?: boolean;
  /** 组件编辑态下正在编辑的组件实例 id。 */
  componentEditId?: string | null;
  icons?: Readonly<Record<string, string>>;
  assets?: Readonly<Record<string, string>>;
  animationsKey?: string;
  onCommit?: () => void;
};

const EMPTY_SCOPE: BindingScope = { data: Object.create(null) as Record<string, unknown> };
const EMPTY_QUERY: Record<string, unknown> = {};

function pageDataKey(data: PageVariable[] | undefined) {
  return (data ?? [])
    .map((variable) => `${variable.name}\0${variable.type}\0${variable.value}\0${variable.computed ? 1 : 0}`)
    .join('\n');
}

function pagePropsKey(props: ComponentProp[] | undefined) {
  return (props ?? [])
    .map((prop) => `${prop.name}\0${prop.type}\0${prop.value}`)
    .join('\n');
}

function widgetChildren(widget: PageWidget): PageWidget[] | undefined {
  return (widget as PageWidget & { children?: PageWidget[] }).children;
}

/**
 * 组件定义编辑器的插槽调试态：被调试的插槽必须始终可见。
 * 插槽本身或它的某个祖先若被状态显隐规则关掉（「存在与显示」落在 existsFn/displayFn/visibleFn 上，
 * 包括状态叠加得出的 removed/hidden/occupy，例如模板里某个容器 `exists` 为 `return false`），
 * 整棵子树会直接不进渲染树或被 display:none，调试画布就会全空。
 * 这里把「根 → 被调试插槽」这条链上所有控件的存在与显示配置剥掉；按 id 收集，
 * 循环展开出的同 id 多份实例一并覆盖。插槽自身的可见性由 slot.ts 的调试分支强制为 visible。
 */
function stripDebugPathPresenceGates(widgets: PageWidget[], slotDebugId: string): void {
  const pathIds = new Set<string>();
  let found = false;
  const visit = (list: PageWidget[], chain: string[]): void => {
    for (const widget of list) {
      const next = [...chain, widget.id];
      if (widget.id === slotDebugId) {
        found = true;
        next.forEach((id) => pathIds.add(id));
        return;
      }
      const children = widgetChildren(widget);
      if (children?.length) {
        visit(children, next);
        if (found) {
          return;
        }
      }
    }
  };
  visit(widgets, []);
  if (!found) {
    return;
  }
  const strip = (list: PageWidget[]): void => {
    for (const widget of list) {
      if (pathIds.has(widget.id)) {
        delete widget.existsFn;
        delete widget.displayFn;
        delete widget.visibleFn;
      }
      const children = widgetChildren(widget);
      if (children?.length) {
        strip(children);
      }
    }
  };
  strip(widgets);
}

export function LowcodePage({ page, editing, tableLayout, locale, catalog, viewing, dynamicTextLabel, onModelValue, onQueryValue, loadWidgetEvent, loadFunction, pageId, query, components, centerContent, useComponentTestData, slotChrome, slotDebugId, componentEditing, componentEditId, icons, assets, animationsKey, onCommit }: LowcodePageProps): ReactElement {
  installPageIcons(icons);
  installPageAssets(assets);
  const currentLocale = locale || pickPageLocale(catalog);
  installPageI18n(catalog, currentLocale);
  const pageQuery = query ?? EMPTY_QUERY;
  const loaderRef = useRef(loadWidgetEvent);
  loaderRef.current = loadWidgetEvent;
  const functionLoaderRef = useRef(loadFunction);
  functionLoaderRef.current = loadFunction;
  const componentInstancesRef = useRef<Map<string, ComponentInstance>>(new Map());
  const scriptScopeRef = useRef<ScriptScope>({});
  const eventsRef = useRef(page.events);
  eventsRef.current = page.events;
  const [hoverInstanceKeys, setHoverInstanceKeys] = useState<string[]>([]);
  const [openDrawerIds, setOpenDrawerIds] = useState<string[]>([]);
  const [editRail, setEditRail] = useState({ tail: 0, column: 0 });
  const pageRef = useRef<HTMLDivElement>(null);
  const treeCache = useRef<{ key: string; flow: Array<ReactElement | null>; drawers: Array<ReactElement | null> } | null>(null);
  const dataKey = pageDataKey(page.data);
  const [appliedDataKey, setAppliedDataKey] = useState(dataKey);
  const [modelOverrides, setModelOverrides] = useState<Record<string, string>>({});
  const incomingQueryStamp = JSON.stringify(pageQuery);
  const [queryStamp, setQueryStamp] = useState(incomingQueryStamp);
  const [queryOverrides, setQueryOverrides] = useState<Record<string, unknown>>({});
  if (queryStamp !== incomingQueryStamp) {
    setQueryStamp(incomingQueryStamp);
    setQueryOverrides({});
  }
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

  useEffect(() => {
    if (editing) {
      setModelOverrides({});
      setQueryOverrides({});
    }
  }, [editing]);

  const liveQuery = useMemo(
    () => (queryStamp === incomingQueryStamp ? { ...pageQuery, ...queryOverrides } : pageQuery),
    [pageQuery, queryOverrides, queryStamp, incomingQueryStamp],
  );

  useLayoutEffect(() => {
    if (editing) {
      return undefined;
    }
    setPageQuery(liveQuery);
    return () => {
      setPageQuery(EMPTY_QUERY);
    };
  }, [editing, liveQuery]);

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
      await runEventIds(loader, ids, [arg], scriptScopeRef.current);
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
          await runEventIds(loader, before, [leave], scriptScopeRef.current);
        }
        if (left?.length) {
          await runEventIds(loader, left, [leave], scriptScopeRef.current);
        }
      })();
    };
  }, [editing, pageId]);

  function runPageTouch(name: 'touchstart' | 'touchmove' | 'touchend', event: unknown) {
    if (editing) {
      return;
    }
    const loader = loaderRef.current;
    const ids = eventsRef.current?.[name];
    if (!loader || !ids?.length) {
      return;
    }
    void runEventIds(loader, ids, [pointEventPayload(event)], scriptScopeRef.current);
  }

  const propsScope = useMemo(() => {
    const live = (page.props ?? []).map((prop) => {
      const key = `$props.${prop.name}`;
      if (!Object.prototype.hasOwnProperty.call(modelOverrides, key)) {
        return prop;
      }
      return { ...prop, value: modelOverrides[key] };
    });
    return buildPropsRecord(live, liveQuery);
  }, [page.props, modelOverrides, liveQuery]);
  const dataProps = useMemo(() => buildPropsRecord(page.props, liveQuery), [page.props, liveQuery]);
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
    () => resolvePageData(page.data, dataOverrides, dataProps, propsScope, liveQuery),
    [page.data, dataOverrides, dataProps, propsScope, liveQuery],
  );
  const setDrawerOpen = (id: string, open: boolean) => {
    setOpenDrawerIds((prev) => {
      const has = prev.includes(id);
      if (open) {
        return has ? prev : [...prev, id];
      }
      return has ? prev.filter((item) => item !== id) : prev;
    });
  };
  bindDrawerHandles(dataScope, page.data, page.widgets, (id, method) => setDrawerOpen(id, method === 'show'));
  bindComponentInstances(dataScope, page.data, page.widgets, components, componentInstancesRef.current);
  const assignScope = (bucket: 'data' | 'props' | 'query', name: string, value: unknown) => {
    if (bucket === 'query') {
      liveQuery[name] = value;
      setQueryOverrides((prev) => (prev[name] === value ? prev : { ...prev, [name]: value }));
      onQueryValue?.(name, value);
      return;
    }
    const stored = formatStoredValue(value);
    if (bucket === 'props') {
      const prop = page.props?.find((item) => item.name === name);
      if (!prop) {
        return;
      }
      propsScope[name] = value;
      const key = `$props.${name}`;
      setModelOverrides((prev) => (prev[key] === stored ? prev : { ...prev, [key]: stored }));
      if (prop.bind) {
        onModelValue?.(key, stored, true);
      }
      return;
    }
    const variable = page.data?.find((item) => item.name === name);
    if (!variable || (variable.computed && (variable.type === 'arr' || variable.type === 'obj'))) {
      return;
    }
    dataScope[name] = value;
    commitModelValue(name, stored, true);
  };
  // 页面自己的方法：脚本里用 `$this.xxx()` 调用，在页面作用域里执行，`$local` 为方法级单例。
  const pageMethodLocalRef = useRef<Map<string, Record<string, unknown>>>(new Map());
  function invokePageMethod(name: string, args: unknown[]): unknown {
    const method = page.methods?.find((item) => item.name === name);
    const loader = functionLoaderRef.current;
    if (!method || !loader) {
      return undefined;
    }
    let local = pageMethodLocalRef.current.get(method.id);
    if (!local) {
      local = initMethodLocal(method.data);
      pageMethodLocalRef.current.set(method.id, local);
    }
    const store = local;
    return (async () => {
      const code = await loader(method.id);
      if (!code) {
        return undefined;
      }
      return runMethodCode(
        code,
        method.params.map((param) => param.name),
        { data: dataScope, props: propsScope, local: store, assign: assignScope, self: pageSelf },
        args,
      );
    })();
  }
  const pageSelf = buildSelf(page.methods, invokePageMethod);
  scriptScopeRef.current = { data: dataScope, props: propsScope, query: liveQuery, assign: assignScope, self: pageSelf };
  const pageViewingStateIds = useMemo(() => {
    const list = Array.isArray(viewing) ? viewing : viewing ? [viewing] : [];
    return list.filter((entry) => entry.ownerId === PAGE_ROOT_STATE_OWNER_ID).map((entry) => entry.state);
  }, [viewing]);
  // 文档级全局状态：查看态显式选择优先；编辑态不自动求值 stateFn（只按选中状态预览）。
  const pageGlobalStateId = useMemo(() => {
    const explicit = pageViewingStateIds.find((id): id is string => Boolean(id));
    if (explicit) {
      return explicit;
    }
    if (editing) {
      return null;
    }
    return resolveStateFnId(pageStateRootWidget(page), { data: dataScope, props: propsScope, query: liveQuery });
  }, [pageViewingStateIds, editing, page, dataScope, propsScope, liveQuery]);
  const paintKey = widgetPaintKey(page.widgets);
  const { widgets, stateLayers } = useMemo(() => {
    const sink = new WeakMap<object, WidgetStateLayer[]>();
    const slotExpand = page.slots?.length ? { defs: page.slots } : undefined;
    const expanded = expandLoopTree(page.widgets, { data: dataScope, props: propsScope, query: liveQuery, aliases: {} }, editing, '', slotExpand);
    const resolved = resolveWidgetTree(expanded, editing ? viewing : null, {
      appliedStateFor: editing ? undefined : (widget) => resolveRuntimeOwnState(widget, hoverInstanceKeys),
      stateLayersSink: sink,
      locale: currentLocale,
      // 全局状态作为最外层后代层叠加到所有控件，使「全局状态下修改的节点样式」生效（编辑态与发布态一致）。
      rootGlobalState: pageGlobalStateId,
    });
    // 插槽调试态：保证被调试插槽及其祖先不被状态显隐规则关掉，否则调试画布会全空。
    if (editing && slotDebugId) {
      stripDebugPathPresenceGates(resolved, slotDebugId);
    }
    return { widgets: resolved, stateLayers: sink };
  }, [paintKey, page.slots, viewing, dataScope, propsScope, liveQuery, editing, hoverInstanceKeys, currentLocale, pageGlobalStateId, slotDebugId]);
  const drawerBoardIndexes = new Map<string, number>();
  {
    let index = 0;
    for (const widget of widgets) {
      if (widget.type === 'drawer') {
        drawerBoardIndexes.set(widget.id, index);
        index += 1;
      }
    }
  }
  const toast = usePageToast();
  const dir = pageI18nDir(catalog, currentLocale);
  const styleText = useMemo(() => pageCssText(page.widgets, currentLocale, { animations: !editing }), [page.widgets, currentLocale, editing, animationsKey]);
  const pageRootStyle = useMemo(
    () => resolvePageStyleWithStates(
      { style: page.style, states: page.states, stateFn: page.stateFn, hoverStateId: page.hoverStateId },
      [pageGlobalStateId],
      currentLocale,
    ),
    [page.style, page.states, page.stateFn, page.hoverStateId, pageGlobalStateId, currentLocale],
  );

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
            : prop.type === 'str' || prop.type === 'icon' || prop.type === 'image'
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
    if (
      variable.type !== 'str' &&
      variable.type !== 'icon' &&
      variable.type !== 'image' &&
      variable.type !== 'num' &&
      variable.type !== 'bool'
    ) {
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
      assignScope?: ScopeAssign;
      /** 组件被放到别的页面上时，内部按入参求值并展开循环。 */
      instantiate?: boolean;
      emit?: (name: string, ...args: unknown[]) => void;
      /** 子树脚本的 `$this`：当前文档自己的方法集合。 */
      self?: Record<string, unknown>;
      /** 组件编辑态下已出现过 chrome 的插槽 slotId 集合。 */
      slotChromeSeen?: Set<string>;
    },
  ): ReactElement | null {
    const meta = widgetInstanceMeta(widget);
    const summarizeCopy = Boolean(options?.summarizeCopy);
    const componentStack = options?.componentStack ?? [];
    const commit = options?.commitModelValue ?? commitModelValue;
    const assign = options?.assignScope ?? assignScope;
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
      assignScope: assign,
      emit: options?.emit,
      self: options?.self ?? pageSelf,
      slotChromeSeen: options?.slotChromeSeen,
      loadWidgetEvent,
      loadFunction: functionLoaderRef.current,
      componentInstances: componentInstancesRef.current,
      components,
      componentStack,
      useComponentTestData: Boolean(useComponentTestData),
      slotChrome: Boolean(slotChrome),
      slotDebugId: slotDebugId ?? null,
      componentEditing: Boolean(componentEditing),
      slotDefs: page.slots,
      componentEditId: componentEditId ?? null,
      viewing,
      icons,
      drawerBoardIndex: drawerBoardIndexes.get(widget.id),
      drawerBoardColumn: editRail.column,
      drawerOpen: openDrawerIds.includes(widget.id),
      hideDrawer: () => setDrawerOpen(widget.id, false),
      render: (child, childOptions) =>
        render(child, {
          summarizeCopy: childOptions?.summarizeCopy ?? summarizeCopy,
          componentStack: childOptions?.componentStack ?? componentStack,
          commitModelValue: childOptions?.commitModelValue ?? commit,
          assignScope: childOptions?.assignScope ?? assign,
          instantiate: childOptions?.instantiate ?? instantiate,
          emit: childOptions?.emit ?? options?.emit,
          self: childOptions?.self ?? options?.self,
          slotChromeSeen: childOptions?.slotChromeSeen ?? options?.slotChromeSeen,
        }),
      stateLayers,
    });
  }

  const bindingOptions = {
    evaluateBindings: !editing,
    bindingScope: { data: dataScope, props: propsScope, query: liveQuery },
  };
  const pageScrollRef = useRef<HTMLDivElement>(null);
  const pageScrollYRef = useRef<HTMLDivElement>(null);
  const pageScrollXRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    onCommit?.();
  }, [onCommit]);
  useLayoutEffect(() => {
    if (!editing || drawerBoardIndexes.size === 0) {
      return undefined;
    }
    const page = pageRef.current;
    if (!page) {
      return undefined;
    }
    const measure = () => {
      const next = drawerRailMetrics(page);
      setEditRail((prev) => (prev.tail === next.tail && prev.column === next.column ? prev : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(page);
    page.querySelectorAll<HTMLElement>('.lowcode-windows, .lowcode-windows-slot.is-offset').forEach((node) => {
      observer.observe(node);
    });
    return () => observer.disconnect();
  }, [editing, widgets, drawerBoardIndexes.size]);
  useEffect(() => {
    const view = pageScrollRef.current;
    const yThumb = pageScrollYRef.current;
    const xThumb = pageScrollXRef.current;
    if (!view || !yThumb || !xThumb) {
      return undefined;
    }
    return bindOverlayScrollbar(view, yThumb, xThumb);
  }, []);
  const rootDrawers = widgets.filter((widget) => widget.type === 'drawer');
  const treeKey = [
    paintKey,
    libraryPaintKey(components),
    editing ? '1' : '0',
    tableLayout ? '1' : '0',
    currentLocale ?? '',
    dataKey,
    pagePropsKey(page.props),
    hoverInstanceKeys.join(','),
    openDrawerIds.join(','),
    `${editRail.tail}:${editRail.column}`,
    centerContent ? '1' : '0',
    centerContent ? JSON.stringify(page.designSize ?? null) : '',
    useComponentTestData ? '1' : '0',
    componentEditing ? '1' : '0',
    slotDebugId ?? '',
    JSON.stringify(viewing),
    JSON.stringify(modelOverrides),
  ].join('\n');
  const cachedTree = treeCache.current?.key === treeKey ? treeCache.current : null;
  // 页面层（组件定义编辑器把组件文档当页面渲染时）同样按 slotId 去重：同类型插槽只保留第一个 chrome。
  const rootSlotChromeSeen = slotChrome ? new Set<string>() : undefined;
  const flowNodes = cachedTree
    ? cachedTree.flow
    : widgets
        .filter((widget) => widget.type !== 'drawer')
        .map((widget) => render(widget, rootSlotChromeSeen ? { slotChromeSeen: rootSlotChromeSeen } : undefined));
  const drawerNodes = cachedTree
    ? cachedTree.drawers
    : rootDrawers.map((widget) => render(widget, rootSlotChromeSeen ? { slotChromeSeen: rootSlotChromeSeen } : undefined));
  if (!cachedTree) {
    treeCache.current = { key: treeKey, flow: flowNodes, drawers: drawerNodes };
  }
  // 组件定义编辑器：文档「定义尺寸」决定定义态画布上这块区域的大小，仅定义态（centerContent）生效；
  // 组件被使用时的尺寸完全由使用方页面上的控件决定，与此无关。
  const designSize = centerContent
    ? {
        width: page.designSize?.width ?? DEFAULT_COMPONENT_DESIGN_SIZE.width,
        height: page.designSize?.height ?? DEFAULT_COMPONENT_DESIGN_SIZE.height,
      }
    : undefined;
  const designSizeCss = designSize
    ? {
        width: `${designSize.width}px`,
        height: `${designSize.height}px`,
        minHeight: `${designSize.height}px`,
      }
    : undefined;
  const pageNode = createElement(
    'div',
    {
      ref: pageRef,
      className: designSizeCss ? 'lowcode-page is-design-region' : 'lowcode-page',
      dir,
      'data-lang': currentLocale || undefined,
      'data-hover-active': hoverInstanceKeys.length > 0 ? HOVER_STATE_NAME : undefined,
      style: {
        ...pageCss(pageRootStyle, editing, bindingOptions),
        ...(designSizeCss ?? null),
        direction: dir,
        // 组件定义编辑器的插槽调试态：整棵组件隐藏，只显示被调试插槽内部的内容。
        // 用 visibility 而非 display:none——隐藏元素仍参与布局，插槽照旧按真实布局尺寸落位，
        // 被调试插槽（slot.ts）再以 visibility:visible 覆盖继承值显示其内部调试节点。
        ...(slotDebugId ? { visibility: 'hidden' as const } : null),
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
        className: 'lowcode-page-scroll-port',
        style: {
          position: 'relative',
          flex: '1 1 auto',
          alignSelf: 'stretch',
          width: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        },
      },
      createElement(
        'div',
        {
          ref: pageScrollRef,
          className: 'lowcode-page-scroll',
          style: {
            ...pageScrollCss(pageRootStyle, editing, bindingOptions),
            scrollbarWidth: 'none',
            position: 'relative',
            zIndex: 0,
            ...(centerContent ? { alignItems: 'center', justifyContent: 'center' } : null),
          },
        },
        flowNodes,
      ),
      createElement('div', { ref: pageScrollYRef, className: 'lowcode-scroll-thumb is-y' }),
      createElement('div', { ref: pageScrollXRef, className: 'lowcode-scroll-thumb is-x' }),
    ),
    ...(editing ? [] : drawerNodes),
    toast,
  );
  if (!editing || rootDrawers.length === 0) {
    return pageNode;
  }
  return createElement(
    'div',
    {
      className: 'lowcode-edit-anchor',
      style: { position: 'relative', width: '100%', height: '100%' },
    },
    pageNode,
    createElement(
      'div',
      {
        className: 'lowcode-edit-side',
        style: {
          position: 'absolute',
          left: '100%',
          top: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          pointerEvents: 'none',
          zIndex: 2,
        },
      },
      editRail.tail > 0
        ? createElement('div', {
            className: 'lowcode-edit-window-gap',
            style: { flex: '0 0 auto', width: editRail.tail, pointerEvents: 'none' },
          })
        : null,
      ...drawerNodes,
    ),
  );
}
