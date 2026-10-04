import type { PageWidget } from '@vanstack/xml';
import { applyCommon, cloneChildren, cloneShared } from './common';
import type { WidgetHelperInterface } from './types';

export function createTableCell(id: string): Extract<PageWidget, { type: 'td' }> {
  return { type: 'td', id, value: '', children: [] };
}

export const tableCellHelper = {
  type: 'td',
  nameKey: 'lowcode.defaultTableCell',
  container: true,
  allowRoot: false,
  accepts: 'content',
  create(ctx) {
    return createTableCell(ctx.id);
  },
  clone(widget, ctx) {
    return {
      type: 'td',
      id: ctx.nextId(),
      value: widget.value,
      children: cloneChildren(widget, ctx),
      ...(widget.align ? { align: widget.align } : {}),
      ...(widget.valign ? { valign: widget.valign } : {}),
      ...cloneShared(widget, ctx.stateIdMap),
    };
  },
  patch(widget, patch) {
    const next = applyCommon(widget, patch);
    if (patch.value != null) {
      next.value = patch.value;
    }
    if ('align' in patch) {
      if (patch.align) {
        next.align = patch.align;
      } else {
        delete next.align;
      }
    }
    if ('valign' in patch) {
      if (patch.valign) {
        next.valign = patch.valign;
      } else {
        delete next.valign;
      }
    }
    return next;
  },
  treeSuffix(widget) {
    return widget.value;
  },
} satisfies WidgetHelperInterface<Extract<PageWidget, { type: 'td' }>>;
