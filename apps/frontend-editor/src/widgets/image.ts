import type { PageWidget } from '@vanstack/xml';
import { applyCommon, cloneItemField, cloneShared } from './common';
import type { WidgetHelperInterface } from './types';

export const imageHelper = {
  type: 'image',
  nameKey: 'lowcode.defaultImage',
  container: false,
  allowRoot: true,
  accepts: 'none',
  create(ctx) {
    return {
      type: 'image',
      id: ctx.id,
      src: `https://picsum.photos/200/200?random=${Math.random()}`,
      style: { width: { mode: '%', value: 100 }, height: { mode: '%', value: 100 } },
    };
  },
  clone(widget, ctx) {
    return {
      type: 'image',
      id: ctx.nextId(),
      src: widget.src,
      ...cloneShared(widget, ctx.stateIdMap),
      ...cloneItemField(widget),
    };
  },
  patch(widget, patch) {
    const next = applyCommon(widget, patch);
    if (patch.src != null) {
      next.src = patch.src;
    }
    return next;
  },
} satisfies WidgetHelperInterface<Extract<PageWidget, { type: 'image' }>>;
