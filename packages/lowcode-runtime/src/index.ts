import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  isPageLangSnapshot,
  pageI18nFromSnapshot,
  type AnimationDefinition,
  type PageI18n,
  type PageLangSnapshot,
  type PageXmlDocument,
} from '@vanstack/xml';
import { installPageAssets } from './asset';
import { installPageAnimations } from './animation';
import { installPageIcons } from './icon';
import { installPageI18n } from './i18n';
import { LowcodePage, type PageViewing } from './page';

const roots = new WeakMap<Element, Root>();

export type RenderPageXmlResult = { ok: true } | { ok: false; error: string };
export type RenderPageXmlOptions = {
  editing?: boolean;
  tableLayout?: boolean;
  locale?: string;
  catalog?: PageI18n | PageLangSnapshot;
  viewingOwnerId?: string | null;
  viewingState?: string | null;
  viewingStates?: Array<{ ownerId: string; state: string | null }> | null;
  dynamicTextLabel?: string;
  onModelValue?: (name: string, value: string, done?: boolean) => void;
  onQueryValue?: (name: string, value: unknown) => void;
  loadWidgetEvent?: (id: string) => Promise<string | null>;
  /** 按 id 取方法体代码（function 集合）。 */
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
  /** 插槽使用编辑：被聚焦插槽的运行时节点 id（`${实例id}__${模板插槽id}`）。 */
  slotFocusId?: string | null;
  icons?: Readonly<Record<string, string>>;
  /** 资源库路径 `分组.文件名` 到文件地址。 */
  assets?: Readonly<Record<string, string>>;
  /** 动画目录：动画独立存储，控件只持 id。 */
  animations?: Readonly<Record<string, AnimationDefinition>> | ReadonlyArray<AnimationDefinition> | null;
  /** 动画目录变化标识，变化时重算页面样式。 */
  animationsKey?: string;
  /** 变化时整页重挂，清掉预览里改过的数据和控件状态。 */
  previewEpoch?: number;
  /** React 提交完 DOM 之后调用，用来画选中框。不要在渲染过程里同步读布局。 */
  onCommit?: () => void;
};

function resolveRenderCatalog(catalog: RenderPageXmlOptions['catalog']): PageI18n | undefined {
  if (!catalog) {
    return undefined;
  }
  if (isPageLangSnapshot(catalog) && !('groups' in catalog)) {
    return pageI18nFromSnapshot(catalog);
  }
  return catalog as PageI18n;
}

function resolveViewing(options?: RenderPageXmlOptions): PageViewing {
  if (options?.viewingStates?.length) {
    return options.viewingStates;
  }
  if (options?.viewingOwnerId) {
    return { ownerId: options.viewingOwnerId, state: options.viewingState ?? null };
  }
  return null;
}

function rootFor(container: HTMLElement): Root {
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }
  return root;
}

export function renderPage(
  container: HTMLElement,
  page: PageXmlDocument,
  options?: RenderPageXmlOptions,
): RenderPageXmlResult {
  const root = rootFor(container);
  const editing = Boolean(options?.editing);
  const catalog = resolveRenderCatalog(options?.catalog);
  installPageIcons(options?.icons);
  installPageAssets(options?.assets);
  installPageAnimations(options?.animations);
  installPageI18n(catalog, options?.locale);

  try {
    const tree = createElement(LowcodePage, {
      key: options?.previewEpoch ?? 0,
      page,
      editing,
      tableLayout: Boolean(options?.tableLayout),
      locale: options?.locale,
      catalog,
      viewing: resolveViewing(options),
      dynamicTextLabel: options?.dynamicTextLabel,
      onModelValue: options?.onModelValue,
      onQueryValue: options?.onQueryValue,
      loadWidgetEvent: options?.loadWidgetEvent,
      loadFunction: options?.loadFunction,
      pageId: options?.pageId,
      query: options?.query,
      components: options?.components,
      centerContent: options?.centerContent,
      useComponentTestData: options?.useComponentTestData,
      slotChrome: options?.slotChrome,
      slotDebugId: options?.slotDebugId,
      componentEditing: Boolean(options?.componentEditing),
      componentEditId: options?.componentEditId,
      slotFocusId: options?.slotFocusId,
      icons: options?.icons,
      assets: options?.assets,
      animationsKey: options?.animationsKey,
      onCommit: options?.onCommit,
    });
    root.render(tree);
    return { ok: true };
  } catch (error) {
    root.render(null);
    const message = error instanceof Error ? error.message : 'Invalid page';
    return { ok: false, error: message };
  }
}

export { pageCssText } from './css';
export { installPageAnimations } from './animation';
export { HOVER_STATE_NAME, mergeHoverViewing, widgetHasHoverState } from './hover';
export { installPageIcons } from './icon';
export { installPageAssets } from './asset';
export { installPageI18n } from './i18n';
export { installPageNavigation } from './navigate';

