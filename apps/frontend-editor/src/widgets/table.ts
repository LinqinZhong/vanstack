import { compactTableLines, sanitizeWidgetStyle, type PageWidget } from '@vanstack/xml';
import { applyCommon, cloneChildren, cloneItemField, cloneShared } from './common';
import { createTableHeader } from './th';
import { createTableRow } from './tr';
import type { WidgetHelperInterface } from './types';

export const tableHelper = {
  type: 'table',
  nameKey: 'lowcode.defaultTable',
  container: true,
  allowRoot: true,
  accepts: 'table-section',
  create(ctx) {
    const headers = [0, 1, 2].map(() => createTableHeader(ctx.nextId()));
    const rows = [0, 1, 2].map(() => createTableRow(ctx.nextId(), headers.length, ctx.nextId));
    return {
      type: 'table',
      id: ctx.id,
      style: sanitizeWidgetStyle('table', undefined),
      children: [...headers, ...rows],
    };
  },
  clone(widget, ctx) {
    const lines = compactTableLines(widget.lines);
    return {
      type: 'table',
      id: ctx.nextId(),
      children: cloneChildren(widget, ctx),
      ...(widget.freezeHeader ? { freezeHeader: true } : {}),
      ...(widget.freezeFooter ? { freezeFooter: true } : {}),
      ...(widget.headerHeight != null ? { headerHeight: widget.headerHeight } : {}),
      ...(lines ? { lines } : {}),
      ...cloneShared(widget, ctx.stateIdMap),
      ...cloneItemField(widget),
    };
  },
  patch(widget, patch) {
    const next = applyCommon(widget, patch);
    if ('freezeHeader' in patch) {
      if (patch.freezeHeader) {
        next.freezeHeader = true;
      } else {
        delete next.freezeHeader;
      }
    }
    if ('freezeFooter' in patch) {
      if (patch.freezeFooter) {
        next.freezeFooter = true;
      } else {
        delete next.freezeFooter;
      }
    }
    if ('headerHeight' in patch) {
      if (patch.headerHeight != null) {
        next.headerHeight = patch.headerHeight;
      } else {
        delete next.headerHeight;
      }
    }
    if ('lines' in patch) {
      const lines = compactTableLines(patch.lines);
      if (lines) {
        next.lines = lines;
      } else {
        delete next.lines;
      }
    }
    return next;
  },
} satisfies WidgetHelperInterface<Extract<PageWidget, { type: 'table' }>>;
