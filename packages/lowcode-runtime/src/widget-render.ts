import { createElement, type ReactElement, type ReactNode } from 'react';
import {
  describeCopyBinding,
  isCopyBinding,
  isI18nCopyExpr,
  resolveCopyBinding,
  resolveI18nCopy,
  type BindingScope,
  type ComponentSlot,
  type PageI18n,
  type PageVariable,
  type PageWidget,
  type PageXmlDocument,
  type ScopeAssign,
  type WidgetStateLayer,
} from '@vanstack/xml';
import type { WidgetCssOptions } from './css';
import type { ComponentInstance } from './methods';

export type WidgetHoverHandlers = {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
};

export type WidgetViewing =
  | Array<{ ownerId: string; state: string | null }>
  | { ownerId: string; state: string | null }
  | null;

export type WidgetRenderContext = {
  editing: boolean;
  tableLayout?: boolean;
  animate: boolean;
  catalog: PageI18n | undefined;
  locale?: string;
  evaluateBindings: boolean;
  bindingScope: BindingScope;
  instanceKey: string;
  hoverInstanceKeys?: readonly string[];
  hoverFor: (widget: PageWidget) => WidgetHoverHandlers | undefined;
  render: (
    widget: PageWidget,
    options?: {
      summarizeCopy?: boolean;
      componentStack?: string[];
      commitModelValue?: (name: string, value: string, done?: boolean) => void;
      assignScope?: ScopeAssign;
      instantiate?: boolean;
      emit?: (name: string, ...args: unknown[]) => void;
      /** 子树脚本的 `$this`：当前文档自己的方法集合。 */
      self?: Record<string, unknown>;
      /** 组件编辑态下已出现过 chrome 的插槽 slotId 集合（同 slotId 只保留第一个可点选）。 */
      slotChromeSeen?: Set<string>;
    },
  ) => ReactElement | null;
  summarizeCopy?: boolean;
  dynamicTextLabel?: string;
  stateLayers?: WeakMap<object, WidgetStateLayer[]>;
  pageData?: PageVariable[];
  modelOverrides?: Readonly<Record<string, string>>;
  commitModelValue?: (name: string, value: string, done?: boolean) => void;
  assignScope?: ScopeAssign;
  /** 当前组件实例向外触发自定义事件。页面根上没有。 */
  emit?: (name: string, ...args: unknown[]) => void;
  /** 当前文档（页面/组件）自己的方法集合，脚本里用 `$this.xxx()` 调用。 */
  self?: Record<string, unknown>;
  loadWidgetEvent?: (id: string) => Promise<string | null>;
  /** 按 id 取方法体代码（function 集合）。 */
  loadFunction?: (id: string) => Promise<string | null>;
  /** 页面级组件实例注册表：实例渲染时写入，供「控件」变量调用暴露方法。 */
  componentInstances?: Map<string, ComponentInstance>;
  components?: Record<string, PageXmlDocument>;
  componentStack?: string[];
  /** 编辑其它组件时，内部实例使用组件自己的测试数据。 */
  useComponentTestData?: boolean;
  /** 是否正处于组件编辑态：仅此时渲染插槽名称/占位 chrome。 */
  slotChrome?: boolean;
  /** 组件定义编辑器：正在调试的插槽 id（插槽内部调试节点隔离显示）。 */
  slotDebugId?: string | null;
  /** 组件编辑态下已出现过 chrome 的插槽 slotId 集合：同 slotId 仅第一个渲染完整 chrome，其余渲染不可点选占位框。 */
  slotChromeSeen?: Set<string>;
  /** 是否正处于组件编辑态（区别于组件定义编辑器）：实例内部树与数据解耦，显示只由查看状态驱动。 */
  componentEditing?: boolean;
  /** 组件文档声明的插槽（用于组件定义编辑器中展示插槽入参）。 */
  slotDefs?: ComponentSlot[];
  /** 组件编辑态下正在编辑的组件实例 id：该实例直接使用组件自身 testData 并忽略入参。 */
  componentEditId?: string | null;
  /** 插槽使用编辑：被聚焦插槽的运行时节点 id（`${实例id}__${模板插槽id}`）。 */
  slotFocusId?: string | null;
  /** 状态查看/切换（含组件内部 prefixed 宿主）。组件/slot 内部求值会透传它。 */
  viewing?: WidgetViewing;
  /** 图标路径 `分组.名称` 到文件地址。 */
  icons?: Readonly<Record<string, string>>;
  /** 编辑态根上的抽屉序号。缺省表示这个抽屉不在页面根上。 */
  drawerBoardIndex?: number;
  /** 编辑态抽屉列宽，跟页面一样宽。 */
  drawerBoardColumn?: number;
  /** 预览态抽屉是否已 show。 */
  drawerOpen?: boolean;
  hideDrawer?: () => void;
};

export function readPropText(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
}

export function readPropFlag(value: unknown): boolean {
  return value === true || value === '1' || value === 'true';
}

export function readPropList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

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
  if (ctx.evaluateBindings || isCopyBinding(raw)) {
    const resolved = resolveCopyBinding(raw, ctx.bindingScope);
    if (isI18nCopyExpr(resolved)) {
      return resolveI18nCopy(resolved, ctx.catalog, ctx.locale);
    }
    return resolved;
  }
  return raw;
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
