import type { PageWidget } from '@vanstack/xml';
import { applyCommon, cloneChildren, cloneShared } from './common';
import type { WidgetHelperInterface } from './types';

export function createSwiperItem(
  id: string,
  children: PageWidget[] = [],
): Extract<PageWidget, { type: 'swiper-item' }> {
  return { type: 'swiper-item', id, children };
}

export const swiperItemHelper = {
  type: 'swiper-item',
  nameKey: 'lowcode.defaultSwiperItem',
  container: true,
  allowRoot: false,
  accepts: 'content',
  create(ctx) {
    return createSwiperItem(ctx.id);
  },
  clone(widget, ctx) {
    return {
      type: 'swiper-item',
      id: ctx.nextId(),
      children: cloneChildren(widget, ctx),
      ...cloneShared(widget, ctx.stateIdMap),
    };
  },
  patch(widget, patch) {
    return applyCommon(widget, patch);
  },
} satisfies WidgetHelperInterface<Extract<PageWidget, { type: 'swiper-item' }>>;
