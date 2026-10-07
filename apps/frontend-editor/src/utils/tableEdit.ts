import {
  DEFAULT_TABLE_COLUMN_WIDTH,
  DEFAULT_TABLE_HEADER_HEIGHT,
  DEFAULT_TABLE_ROW_HEIGHT,
  MIN_TABLE_TRACK,
  sanitizeWidgetStyle,
  type PageWidget,
  type WidgetStyle,
} from '@vanstack/xml';
import { patchWidget, type WidgetPatch } from '../widgets';
import { createTableCell } from '../widgets/td';
import { createTableHeader } from '../widgets/th';
import { createTableRow } from '../widgets/tr';
import type { TableChromeState } from './lowcode-protocol';
import { findParentWidget, findWidget, nextWidgetId, updateWidgetById } from './widgetTree';

export type TableWidget = Extract<PageWidget, { type: 'table' }>;
export type TableHeader = Extract<PageWidget, { type: 'th' }>;
export type TableRow = Extract<PageWidget, { type: 'tr' }>;
export type TableCell = Extract<PageWidget, { type: 'td' }>;

export type TableParts = {
  table: TableWidget;
  headers: TableHeader[];
  rows: TableRow[];
};

export type TableRange =
  | { kind: 'column'; tableId: string; index: number }
  | { kind: 'row'; tableId: string; rowId: string }
  | { kind: 'header'; tableId: string };

export function tableChromeState(
  widgets: PageWidget[],
  selectedId: string | null,
  range: TableRange | null,
): TableChromeState | null {
  const owning = findOwningTable(widgets, range?.tableId ?? selectedId);
  if (!owning) {
    return null;
  }
  const selectedInside = selectedId != null && containsWidget(owning.table, selectedId);
  const active = range && range.tableId === owning.table.id ? range : null;
  if (!selectedInside && !active) {
    return null;
  }
  return {
    tableId: owning.table.id,
    range: !active
      ? null
      : active.kind === 'column'
        ? { kind: 'column', index: active.index }
        : active.kind === 'row'
          ? { kind: 'row', rowId: active.rowId }
          : { kind: 'header' },
    freezeHeader: Boolean(owning.table.freezeHeader),
    freezeFooter: Boolean(owning.table.freezeFooter),
    footerRowId: owning.rows[owning.rows.length - 1]?.id ?? null,
  };
}

function containsWidget(widget: PageWidget, id: string): boolean {
  if (widget.id === id) {
    return true;
  }
  if (!('children' in widget)) {
    return false;
  }
  return widget.children.some((child) => containsWidget(child, id));
}

export function tableParts(table: TableWidget): TableParts {
  return {
    table,
    headers: table.children.filter((child): child is TableHeader => child.type === 'th'),
    rows: table.children.filter((child): child is TableRow => child.type === 'tr'),
  };
}

export function findOwningTable(widgets: PageWidget[], id: string | null | undefined): TableParts | null {
  let current = findWidget(widgets, id);
  while (current) {
    if (current.type === 'table') {
      return tableParts(current);
    }
    current = findParentWidget(widgets, current.id);
  }
  return null;
}

export function cellsOf(row: TableRow): TableCell[] {
  return row.children.filter((child): child is TableCell => child.type === 'td');
}

export function columnIndexOf(parts: TableParts, widgetId: string): number {
  const headerIndex = parts.headers.findIndex((header) => header.id === widgetId);
  if (headerIndex >= 0) {
    return headerIndex;
  }
  for (const row of parts.rows) {
    const index = cellsOf(row).findIndex((cell) => cell.id === widgetId);
    if (index >= 0) {
      return index;
    }
  }
  return -1;
}

export function columnCellIds(parts: TableParts, index: number): string[] {
  const ids: string[] = [];
  const header = parts.headers[index];
  if (header) {
    ids.push(header.id);
  }
  for (const row of parts.rows) {
    const cell = cellsOf(row)[index];
    if (cell) {
      ids.push(cell.id);
    }
  }
  return ids;
}

export function rowCellIds(parts: TableParts, rowId: string): string[] {
  const row = parts.rows.find((item) => item.id === rowId);
  return row ? cellsOf(row).map((cell) => cell.id) : [];
}

export function headerCellIds(parts: TableParts): string[] {
  return parts.headers.map((header) => header.id);
}

function withCells(row: TableRow, cells: TableCell[]): TableRow {
  return { ...row, children: cells };
}

function padRow(row: TableRow, count: number, nextId: () => string): TableRow {
  const cells = cellsOf(row).slice(0, count);
  while (cells.length < count) {
    cells.push(createTableCell(nextId()));
  }
  return withCells(row, cells);
}

function writeTable(table: TableWidget, headers: TableHeader[], rows: TableRow[]): TableWidget {
  return { ...table, children: [...headers, ...rows] };
}

function replaceTable(widgets: PageWidget[], table: TableWidget, headers: TableHeader[], rows: TableRow[]): PageWidget[] {
  return updateWidgetById(widgets, table.id, () => writeTable(table, headers, rows));
}

export function addTableColumn(
  widgets: PageWidget[],
  tableId: string,
  afterIndex: number | null,
  nextId: () => string = nextWidgetId,
): PageWidget[] {
  const table = findWidget(widgets, tableId);
  if (!table || table.type !== 'table') {
    return widgets;
  }
  const { headers, rows } = tableParts(table);
  const insertAt = afterIndex == null ? headers.length : Math.min(headers.length, Math.max(0, afterIndex + 1));
  const nextHeaders = [...headers.slice(0, insertAt), createTableHeader(nextId()), ...headers.slice(insertAt)];
  const nextRows = rows.map((row) => {
    const cells = cellsOf(padRow(row, headers.length, nextId));
    return withCells(row, [...cells.slice(0, insertAt), createTableCell(nextId()), ...cells.slice(insertAt)]);
  });
  return replaceTable(widgets, table, nextHeaders, nextRows);
}

export function removeTableColumn(widgets: PageWidget[], tableId: string, index: number, nextId: () => string = nextWidgetId): PageWidget[] {
  const table = findWidget(widgets, tableId);
  if (!table || table.type !== 'table') {
    return widgets;
  }
  const { headers, rows } = tableParts(table);
  if (headers.length <= 1 || index < 0 || index >= headers.length) {
    return widgets;
  }
  const nextHeaders = headers.filter((_, headerIndex) => headerIndex !== index);
  const nextRows = rows.map((row) => {
    const cells = cellsOf(padRow(row, headers.length, nextId));
    return withCells(row, cells.filter((_, cellIndex) => cellIndex !== index));
  });
  return replaceTable(widgets, table, nextHeaders, nextRows);
}

export function moveTableColumn(
  widgets: PageWidget[],
  tableId: string,
  index: number,
  delta: number,
  nextId: () => string = nextWidgetId,
): PageWidget[] {
  const table = findWidget(widgets, tableId);
  if (!table || table.type !== 'table' || delta === 0) {
    return widgets;
  }
  const { headers, rows } = tableParts(table);
  const target = index + delta;
  if (index < 0 || index >= headers.length || target < 0 || target >= headers.length) {
    return widgets;
  }
  const nextHeaders = headers.slice();
  const [movedHeader] = nextHeaders.splice(index, 1);
  nextHeaders.splice(target, 0, movedHeader);
  const nextRows = rows.map((row) => {
    const cells = cellsOf(padRow(row, headers.length, nextId));
    const [movedCell] = cells.splice(index, 1);
    cells.splice(target, 0, movedCell);
    return withCells(row, cells);
  });
  return replaceTable(widgets, table, nextHeaders, nextRows);
}

export function addTableRow(
  widgets: PageWidget[],
  tableId: string,
  afterRowId: string | null,
  nextId: () => string = nextWidgetId,
): PageWidget[] {
  const table = findWidget(widgets, tableId);
  if (!table || table.type !== 'table') {
    return widgets;
  }
  const { headers, rows } = tableParts(table);
  if (headers.length === 0) {
    return widgets;
  }
  const after = afterRowId ? rows.findIndex((row) => row.id === afterRowId) : -1;
  const insertAt = after < 0 ? rows.length : after + 1;
  const created = createTableRow(nextId(), headers.length, nextId);
  const nextRows = [...rows.slice(0, insertAt), created, ...rows.slice(insertAt)].map((row) =>
    row.id === created.id ? row : padRow(row, headers.length, nextId),
  );
  return replaceTable(widgets, table, headers, nextRows);
}

export function removeTableRow(widgets: PageWidget[], tableId: string, rowId: string, nextId: () => string = nextWidgetId): PageWidget[] {
  const table = findWidget(widgets, tableId);
  if (!table || table.type !== 'table') {
    return widgets;
  }
  const { headers, rows } = tableParts(table);
  if (rows.length <= 1 || !rows.some((row) => row.id === rowId)) {
    return widgets;
  }
  const nextRows = rows.filter((row) => row.id !== rowId).map((row) => padRow(row, headers.length, nextId));
  return replaceTable(widgets, table, headers, nextRows);
}

export function moveTableRow(
  widgets: PageWidget[],
  tableId: string,
  rowId: string,
  delta: number,
  nextId: () => string = nextWidgetId,
): PageWidget[] {
  const table = findWidget(widgets, tableId);
  if (!table || table.type !== 'table' || delta === 0) {
    return widgets;
  }
  const { headers, rows } = tableParts(table);
  const index = rows.findIndex((row) => row.id === rowId);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= rows.length) {
    return widgets;
  }
  const nextRows = rows.slice();
  const [moved] = nextRows.splice(index, 1);
  nextRows.splice(target, 0, moved);
  return replaceTable(widgets, table, headers, nextRows.map((row) => padRow(row, headers.length, nextId)));
}

function patchByIds(widgets: PageWidget[], ids: ReadonlySet<string>, patcher: (widget: PageWidget) => PageWidget): PageWidget[] {
  return widgets.map((widget) => {
    const next = ids.has(widget.id) ? patcher(widget) : widget;
    if (!('children' in next)) {
      return next;
    }
    const children = patchByIds(next.children, ids, patcher);
    return children === next.children ? next : { ...next, children };
  });
}

export function patchTableCells(widgets: PageWidget[], ids: readonly string[], patch: WidgetPatch): PageWidget[] {
  const idSet = new Set(ids);
  if (idSet.size === 0) {
    return widgets;
  }
  return patchByIds(widgets, idSet, (widget) => patchWidget(widget, patch));
}

export function patchTableCellStyles(widgets: PageWidget[], ids: readonly string[], delta: Partial<WidgetStyle>): PageWidget[] {
  const idSet = new Set(ids);
  if (idSet.size === 0) {
    return widgets;
  }
  return patchByIds(widgets, idSet, (widget) => {
    if (widget.type !== 'th' && widget.type !== 'td') {
      return widget;
    }
    return {
      ...widget,
      style: sanitizeWidgetStyle(widget.type, { ...widget.style, ...delta }),
    };
  });
}

function storedTrack(value: number, fallback: number): number | undefined {
  const clamped = Math.max(MIN_TABLE_TRACK, Math.round(value));
  return clamped === fallback ? undefined : clamped;
}

export function setTableColumnWidth(widgets: PageWidget[], headerId: string, value: number): PageWidget[] {
  const header = findWidget(widgets, headerId);
  if (!header || header.type !== 'th') {
    return widgets;
  }
  const stored = storedTrack(value, DEFAULT_TABLE_COLUMN_WIDTH);
  if (header.width === stored) {
    return widgets;
  }
  return updateWidgetById(widgets, headerId, (widget) => patchWidget(widget, { width: stored }));
}

export function setTableRowHeight(widgets: PageWidget[], rowId: string, value: number): PageWidget[] {
  const row = findWidget(widgets, rowId);
  if (!row || row.type !== 'tr') {
    return widgets;
  }
  const stored = storedTrack(value, DEFAULT_TABLE_ROW_HEIGHT);
  if (row.height === stored) {
    return widgets;
  }
  return updateWidgetById(widgets, rowId, (widget) => patchWidget(widget, { height: stored }));
}

export function setTableHeaderHeight(widgets: PageWidget[], tableId: string, value: number): PageWidget[] {
  const table = findWidget(widgets, tableId);
  if (!table || table.type !== 'table') {
    return widgets;
  }
  const stored = storedTrack(value, DEFAULT_TABLE_HEADER_HEIGHT);
  if (table.headerHeight === stored) {
    return widgets;
  }
  return updateWidgetById(widgets, tableId, (widget) => patchWidget(widget, { headerHeight: stored }));
}
