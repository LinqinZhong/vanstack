import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import {
  isPageLangSnapshot,
  pageI18nFromSnapshot,
  type PageI18n,
  type PageLangSnapshot,
  type PageXmlDocument,
} from '@vanstack/xml';
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
  loadWidgetEvent?: (id: string) => Promise<string | null>;
  pageId?: string | null;
  components?: Record<string, PageXmlDocument>;
  centerContent?: boolean;
  useComponentTestData?: boolean;
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

  try {
    const tree = createElement(LowcodePage, {
      page,
      editing,
      tableLayout: Boolean(options?.tableLayout),
      locale: options?.locale,
      catalog: resolveRenderCatalog(options?.catalog),
      viewing: resolveViewing(options),
      dynamicTextLabel: options?.dynamicTextLabel,
      onModelValue: options?.onModelValue,
      loadWidgetEvent: options?.loadWidgetEvent,
      pageId: options?.pageId,
      components: options?.components,
      centerContent: options?.centerContent,
      useComponentTestData: options?.useComponentTestData,
    });
    flushSync(() => {
      root.render(tree);
    });
    return { ok: true };
  } catch (error) {
    flushSync(() => {
      root.render(null);
    });
    const message = error instanceof Error ? error.message : 'Invalid page';
    return { ok: false, error: message };
  }
}

export { HOVER_STATE_NAME, mergeHoverViewing, widgetHasHoverState } from './hover';

