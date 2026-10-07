import type { PageWidget } from '@vanstack/xml';
import { applyCommon, cloneChildren, cloneItemField, cloneShared } from './common';
import { createWindow } from './window';
import type { WidgetHelperInterface } from './types';

export const windowsHelper = {
  type: 'windows',
  nameKey: 'lowcode.defaultWindows',
  container: true,
  allowRoot: true,
  accepts: 'window',
  create(ctx) {
    return {
      type: 'windows',
      id: ctx.id,
      current: '1',
      children: [createWindow(ctx.nextId(), '1'), createWindow(ctx.nextId(), '2')],
    };
  },
  clone(widget, ctx) {
    return {
      type: 'windows',
      id: ctx.nextId(),
      children: cloneChildren(widget, ctx),
      ...(widget.current ? { current: widget.current } : {}),
      ...cloneShared(widget, ctx.stateIdMap),
      ...cloneItemField(widget),
    };
  },
  patch(widget, patch) {
    const next = applyCommon(widget, patch);
    if ('current' in patch) {
      const current = patch.current?.trim() ?? '';
      if (current) {
        next.current = current;
      } else {
        delete next.current;
      }
    }
    return next;
  },
  treeSuffix(widget) {
    return widget.current;
  },
} satisfies WidgetHelperInterface<Extract<PageWidget, { type: 'windows' }>>;
