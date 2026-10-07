import type { PageWidget } from '@vanstack/xml';
import { applyCommon, cloneChildren, cloneShared } from './common';
import type { WidgetHelperInterface } from './types';

export function createWindow(
  id: string,
  value = '',
  children: PageWidget[] = [],
): Extract<PageWidget, { type: 'window' }> {
  return { type: 'window', id, value, children };
}

export const windowHelper = {
  type: 'window',
  nameKey: 'lowcode.defaultWindow',
  container: true,
  allowRoot: false,
  accepts: 'content',
  create(ctx) {
    return createWindow(ctx.id);
  },
  clone(widget, ctx) {
    return {
      type: 'window',
      id: ctx.nextId(),
      value: widget.value,
      children: cloneChildren(widget, ctx),
      ...cloneShared(widget, ctx.stateIdMap),
    };
  },
  patch(widget, patch) {
    const next = applyCommon(widget, patch);
    if (patch.value != null) {
      next.value = patch.value;
    }
    return next;
  },
  treeSuffix(widget) {
    return widget.value;
  },
} satisfies WidgetHelperInterface<Extract<PageWidget, { type: 'window' }>>;
