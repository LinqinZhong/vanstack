import type { PageWidget } from '@vanstack/xml';
import { applyCommon, cloneChildren, cloneItemField, cloneShared } from './common';
import type { WidgetHelperInterface } from './types';

export const flexHelper = {
  type: 'flex',
  nameKey: 'lowcode.defaultFlex',
  container: true,
  allowRoot: true,
  accepts: 'content',
  create(ctx) {
    return { type: 'flex', id: ctx.id, children: [] };
  },
  clone(widget, ctx) {
    return {
      type: 'flex',
      id: ctx.nextId(),
      children: cloneChildren(widget, ctx),
      flex: widget.flex ? { ...widget.flex } : undefined,
      ...cloneShared(widget, ctx.stateIdMap),
      ...cloneItemField(widget),
    };
  },
  patch(widget, patch) {
    const next = applyCommon(widget, patch);
    if ('flex' in patch) {
      if (patch.flex) {
        next.flex = patch.flex;
      } else {
        delete next.flex;
      }
    }
    return next;
  },
} satisfies WidgetHelperInterface<Extract<PageWidget, { type: 'flex' }>>;
