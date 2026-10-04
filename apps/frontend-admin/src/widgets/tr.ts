import type { PageWidget } from '@vanstack/xml';
import { applyCommon, cloneChildren, cloneShared } from './common';
import { createTableCell } from './td';
import type { WidgetHelperInterface } from './types';

export function createTableRow(
  id: string,
  columns: number,
  nextId: () => string,
): Extract<PageWidget, { type: 'tr' }> {
  return {
    type: 'tr',
    id,
    children: Array.from({ length: columns }, () => createTableCell(nextId())),
  };
}

export const tableRowHelper = {
  type: 'tr',
  nameKey: 'lowcode.defaultTableRow',
  container: true,
  allowRoot: false,
  accepts: 'table-cell',
  create(ctx) {
    return createTableRow(ctx.id, 1, ctx.nextId);
  },
  clone(widget, ctx) {
    return {
      type: 'tr',
      id: ctx.nextId(),
      children: cloneChildren(widget, ctx),
      ...(widget.height != null ? { height: widget.height } : {}),
      ...cloneShared(widget, ctx.stateIdMap),
    };
  },
  patch(widget, patch) {
    const next = applyCommon(widget, patch);
    if ('height' in patch) {
      if (patch.height != null) {
        next.height = patch.height;
      } else {
        delete next.height;
      }
    }
    return next;
  },
} satisfies WidgetHelperInterface<Extract<PageWidget, { type: 'tr' }>>;
