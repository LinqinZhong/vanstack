import { sanitizeWidgetStyle, type PageWidget } from '@vanstack/xml';
import { applyCommon, cloneChildren, cloneItemField, cloneShared } from './common';
import { createSwiperItem } from './swiper-item';
import type { WidgetHelperInterface } from './types';

export const swiperHelper = {
  type: 'swiper',
  nameKey: 'lowcode.defaultSwiper',
  container: true,
  allowRoot: true,
  accepts: 'swiper-item',
  create(ctx) {
    return {
      type: 'swiper',
      id: ctx.id,
      style: sanitizeWidgetStyle('swiper', undefined),
      children: [0, 1, 2].map(() => createSwiperItem(ctx.nextId())),
    };
  },
  clone(widget, ctx) {
    return {
      type: 'swiper',
      id: ctx.nextId(),
      children: cloneChildren(widget, ctx),
      swiper: widget.swiper ? { ...widget.swiper } : undefined,
      ...cloneShared(widget, ctx.stateIdMap),
      ...cloneItemField(widget),
    };
  },
  patch(widget, patch) {
    const next = applyCommon(widget, patch);
    if ('swiper' in patch) {
      if (patch.swiper) {
        next.swiper = patch.swiper;
      } else {
        delete next.swiper;
      }
    }
    return next;
  },
} satisfies WidgetHelperInterface<Extract<PageWidget, { type: 'swiper' }>>;
