import { DEFAULT_GRID_COLUMN_COUNT, DEFAULT_GRID_ROW_COUNT, type GridStyle, type PageWidget } from '@vanstack/xml';
import { applyCommon, cloneChildren, cloneItemField, cloneShared } from './common';
import type { WidgetHelperInterface } from './types';

function cloneGrid(grid: GridStyle | undefined): GridStyle | undefined {
  if (!grid) {
    return undefined;
  }
  return {
    ...grid,
    ...(grid.rows ? { rows: [...grid.rows] } : {}),
    ...(grid.columns ? { columns: [...grid.columns] } : {}),
  };
}

export const gridHelper = {
  type: 'grid',
  nameKey: 'lowcode.defaultGrid',
  container: true,
  allowRoot: true,
  accepts: 'content',
  create(ctx) {
    return {
      type: 'grid',
      id: ctx.id,
      children: [],
      grid: { rowCount: DEFAULT_GRID_ROW_COUNT, columnCount: DEFAULT_GRID_COLUMN_COUNT },
    };
  },
  clone(widget, ctx) {
    return {
      type: 'grid',
      id: ctx.nextId(),
      children: cloneChildren(widget, ctx),
      grid: cloneGrid(widget.grid),
      ...cloneShared(widget, ctx.stateIdMap),
      ...cloneItemField(widget),
    };
  },
  patch(widget, patch) {
    const next = applyCommon(widget, patch);
    if ('grid' in patch) {
      if (patch.grid) {
        next.grid = cloneGrid(patch.grid);
      } else {
        delete next.grid;
      }
    }
    return next;
  },
} satisfies WidgetHelperInterface<Extract<PageWidget, { type: 'grid' }>>;
