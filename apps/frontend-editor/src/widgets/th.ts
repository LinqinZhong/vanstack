import type { PageWidget } from '@vanstack/xml';
import { applyCommon, cloneChildren, cloneShared } from './common';
import type { WidgetHelperInterface } from './types';

export function createTableHeader(id: string): Extract<PageWidget, { type: 'th' }> {
  return { type: 'th', id, value: '', children: [] };
}

export const tableHeaderHelper = {
  type: 'th',
  nameKey: 'lowcode.defaultTableHeader',
  container: true,
  allowRoot: false,
  accepts: 'content',
  create(ctx) {
    return createTableHeader(ctx.id);
  },
  clone(widget, ctx) {
    return {
      type: 'th',
      id: ctx.nextId(),
      value: widget.value,
      children: cloneChildren(widget, ctx),
      ...(widget.width != null ? { width: widget.width } : {}),
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
    if ('width' in patch) {
      if (patch.width != null) {
        next.width = patch.width;
      } else {
        delete next.width;
      }
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
} satisfies WidgetHelperInterface<Extract<PageWidget, { type: 'th' }>>;
