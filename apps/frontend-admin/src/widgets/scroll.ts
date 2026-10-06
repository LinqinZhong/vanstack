import { DEFAULT_SCROLL_HEIGHT, DEFAULT_SCROLL_WIDTH, type PageWidget } from '@vanstack/xml';
import { applyCommon, cloneChildren, cloneItemField, cloneShared } from './common';
import type { WidgetHelperInterface } from './types';

export const scrollHelper = {
  type: 'scroll',
  nameKey: 'lowcode.defaultScroll',
  container: true,
  allowRoot: true,
  accepts: 'content',
  create(ctx) {
    return {
      type: 'scroll',
      id: ctx.id,
      children: [],
      style: { width: DEFAULT_SCROLL_WIDTH, height: DEFAULT_SCROLL_HEIGHT },
    };
  },
  clone(widget, ctx) {
    return {
      type: 'scroll',
      id: ctx.nextId(),
      children: cloneChildren(widget, ctx),
      ...(widget.scrollX === false ? { scrollX: false as const } : {}),
      ...(widget.scrollY === false ? { scrollY: false as const } : {}),
      ...cloneShared(widget, ctx.stateIdMap),
      ...cloneItemField(widget),
    };
  },
  patch(widget, patch) {
    const next = applyCommon(widget, patch);
    if ('scrollX' in patch) {
      if (patch.scrollX === false) {
        next.scrollX = false;
      } else {
        delete next.scrollX;
      }
    }
    if ('scrollY' in patch) {
      if (patch.scrollY === false) {
        next.scrollY = false;
      } else {
        delete next.scrollY;
      }
    }
    return next;
  },
} satisfies WidgetHelperInterface<Extract<PageWidget, { type: 'scroll' }>>;
