import { LOWCODE_MESSAGE_SOURCE, type TableChromeState } from '../../utils/lowcode-protocol';
import { previewVisualScale } from '../../utils/spacingGuides';
import { leafOpenEditor } from './scrollChrome';

export type TableChromeLabels = {
  moveLeft: string;
  moveRight: string;
  moveUp: string;
  moveDown: string;
  addColumn: string;
  removeColumn: string;
  addRow: string;
  removeRow: string;
  freezeHeader: string;
  freezeFooter: string;
  editTable: string;
  exitTable: string;
};

type Box = { left: number; top: number; width: number; height: number };

const CHROME_ATTR = 'data-table-chrome';

function hostBox(host: HTMLElement, node: HTMLElement, zoom: number): Box {
  const hostRect = host.getBoundingClientRect();
  const rect = node.getBoundingClientRect();
  const scale = previewVisualScale(host, zoom);
  const width = node.offsetWidth;
  const height = node.offsetHeight;
  const centerX = (rect.left + rect.width / 2 - hostRect.left) / scale;
  const centerY = (rect.top + rect.height / 2 - hostRect.top) / scale;
  return {
    left: centerX - width / 2,
    top: centerY - height / 2,
    width,
    height,
  };
}

function place(node: HTMLElement, style: Partial<CSSStyleDeclaration> & Record<string, string>) {
  Object.assign(node.style, style);
}

function opButton(label: string, title: string, attrs: { command?: string; freeze?: 'header' | 'footer'; on?: boolean }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = attrs.on ? 'table-chrome-op is-on' : 'table-chrome-op';
  button.title = title;
  button.textContent = label;
  if (attrs.command) {
    button.dataset.tableCommand = attrs.command;
  }
  if (attrs.freeze) {
    button.dataset.tableFreeze = attrs.freeze;
  }
  return button;
}

function keepTableEdge(value: number, others: number, tableSpan: number): number {
  if (tableSpan <= 0) {
    return Math.max(24, value);
  }
  return Math.max(value, 24, tableSpan - others);
}

/** 内部边把增减让给相邻轨道，两边之和不变，外框不跟着动。 */
function shareWithNext(requested: number, start: number, nextStart: number): { value: number; nextValue: number } {
  const sum = start + nextStart;
  const value = Math.min(Math.max(24, requested), Math.max(24, sum - 24));
  return { value, nextValue: sum - value };
}

export type TableTrackDrag = {
  value: number;
  nextValue?: number;
};

export type TableTrackPair = {
  start: number;
  nextStart?: number;
  nextRowId?: string;
};

export function readTableTrackPair(
  root: HTMLElement | null,
  tableId: string,
  target: 'column' | 'row' | 'header',
  index: number | undefined,
  rowId: string | undefined,
): TableTrackPair | null {
  const table = root?.querySelector<HTMLElement>(`[data-widget-id="${CSS.escape(tableId)}"]`);
  if (!table || table.dataset.widgetType !== 'table') {
    return null;
  }
  const head = table.querySelector<HTMLElement>(':scope > .lowcode-table-head');
  const rows = [...table.querySelectorAll<HTMLElement>(':scope > [data-widget-type="tr"]')];
  if (target === 'column' && index != null && head) {
    const headers = [...head.querySelectorAll<HTMLElement>(':scope > [data-widget-type="th"]')];
    const header = headers[index];
    if (!header) {
      return null;
    }
    const next = headers[index + 1];
    return { start: header.offsetWidth, ...(next ? { nextStart: next.offsetWidth } : {}) };
  }
  if (target === 'header' && head) {
    const next = rows[0];
    return {
      start: head.offsetHeight,
      ...(next?.dataset.widgetId ? { nextStart: next.offsetHeight, nextRowId: next.dataset.widgetId } : {}),
    };
  }
  if (target === 'row' && rowId) {
    const rowIndex = rows.findIndex((row) => row.dataset.widgetId === rowId);
    const row = rows[rowIndex];
    if (!row) {
      return null;
    }
    const next = rows[rowIndex + 1];
    return {
      start: row.offsetHeight,
      ...(next?.dataset.widgetId ? { nextStart: next.offsetHeight, nextRowId: next.dataset.widgetId } : {}),
    };
  }
  return null;
}

/** applyLiveTableTrack：拖拽过程中只改列宽或行高，不改表格宽高。最右列不能收到表格边框里面。 */
export function applyLiveTableTrack(
  root: HTMLElement | null,
  tableId: string,
  target: 'column' | 'row' | 'header',
  index: number | undefined,
  rowId: string | undefined,
  value: number,
  pair: TableTrackPair | null,
): TableTrackDrag | undefined {
  const table = root?.querySelector<HTMLElement>(`[data-widget-id="${CSS.escape(tableId)}"]`);
  if (!table || table.dataset.widgetType !== 'table') {
    return undefined;
  }
  const head = table.querySelector<HTMLElement>(':scope > .lowcode-table-head');
  const rows = [...table.querySelectorAll<HTMLElement>(':scope > [data-widget-type="tr"]')];
  if (target === 'column' && index != null && head) {
    const headers = [...head.querySelectorAll<HTMLElement>(':scope > [data-widget-type="th"]')];
    if (!headers[index]) {
      return undefined;
    }
    const shared = pair?.nextStart != null ? shareWithNext(value, pair.start, pair.nextStart) : null;
    let next = shared?.value ?? value;
    if (!shared && index === headers.length - 1) {
      const others = headers.reduce(
        (sum, header, headerIndex) => (headerIndex === index ? sum : sum + header.offsetWidth),
        0,
      );
      next = keepTableEdge(value, others, table.clientWidth);
    }
    const widths = headers.map((header, headerIndex) => {
      if (headerIndex === index) {
        return next;
      }
      if (shared && headerIndex === index + 1) {
        return shared.nextValue;
      }
      return header.offsetWidth;
    });
    const template = widths.map((width) => `${width}px`).join(' ');
    head.style.gridTemplateColumns = template;
    for (const row of rows) {
      row.style.gridTemplateColumns = template;
    }
    return shared ? { value: next, nextValue: shared.nextValue } : { value: next };
  }
  if (target === 'header' && head) {
    const shared = pair?.nextStart != null ? shareWithNext(value, pair.start, pair.nextStart) : null;
    const next = shared?.value ?? Math.max(24, value);
    head.style.height = `${next}px`;
    head.style.minHeight = `${next}px`;
    head.style.gridTemplateRows = `${next}px`;
    pinCellTrack(head, 'th', next);
    const nextRow = rows[0];
    if (shared && nextRow) {
      nextRow.style.height = `${shared.nextValue}px`;
      nextRow.style.minHeight = `${shared.nextValue}px`;
      nextRow.style.gridTemplateRows = `${shared.nextValue}px`;
      pinCellTrack(nextRow, 'td', shared.nextValue);
      return { value: next, nextValue: shared.nextValue };
    }
    return { value: next };
  }
  if (target === 'row' && rowId) {
    const rowIndex = rows.findIndex((item) => item.dataset.widgetId === rowId);
    const row = rows[rowIndex];
    if (!row) {
      return undefined;
    }
    const shared = pair?.nextStart != null ? shareWithNext(value, pair.start, pair.nextStart) : null;
    const next = shared?.value ?? Math.max(24, value);
    row.style.height = `${next}px`;
    row.style.minHeight = `${next}px`;
    row.style.gridTemplateRows = `${next}px`;
    pinCellTrack(row, 'td', next);
    const nextRow = rows[rowIndex + 1];
    if (shared && nextRow) {
      nextRow.style.height = `${shared.nextValue}px`;
      nextRow.style.minHeight = `${shared.nextValue}px`;
      nextRow.style.gridTemplateRows = `${shared.nextValue}px`;
      pinCellTrack(nextRow, 'td', shared.nextValue);
      return { value: next, nextValue: shared.nextValue };
    }
    return { value: next };
  }
  return undefined;
}

function pinCellTrack(row: HTMLElement, type: 'th' | 'td', height: number) {
  for (const cell of row.querySelectorAll<HTMLElement>(`:scope > [data-widget-type="${type}"]`)) {
    cell.style.height = `${height}px`;
    cell.style.minHeight = `${height}px`;
  }
}

function editingTable(root: HTMLElement): HTMLElement | null {
  const selected = root.querySelector('.is-widget-selected');
  if (!(selected instanceof HTMLElement)) {
    return null;
  }
  if (selected.dataset.widgetType === 'table') {
    return selected;
  }
  const table = selected.closest('.lowcode-table');
  return table instanceof HTMLElement ? table : null;
}

/** 进入表格编辑后露出全部单元格，并藏起页面上的其它控件。 */
export function syncTableReveal(
  host: HTMLElement | null,
  root: HTMLElement | null,
  editing: boolean,
  tableEditing: boolean,
) {
  const clearOpen = () => {
    root?.querySelectorAll('.lowcode-table.is-table-open').forEach((node) => {
      node.classList.remove('is-table-open');
    });
  };
  if (!host || !root || !editing) {
    host?.classList.remove('is-table-editing');
    host?.querySelector('[data-table-reveal]')?.remove();
    clearOpen();
    return;
  }
  root.querySelectorAll<HTMLElement>('.lowcode-table').forEach((node) => {
    if (node.scrollTop !== 0) {
      node.scrollTop = 0;
    }
    if (node.scrollLeft !== 0) {
      node.scrollLeft = 0;
    }
  });
  const table = tableEditing ? editingTable(root) : null;
  root.querySelectorAll('.lowcode-table.is-table-open').forEach((node) => {
    if (node !== table) {
      node.classList.remove('is-table-open');
    }
  });
  if (!table) {
    host.classList.remove('is-table-editing');
    return;
  }
  host.classList.add('is-table-editing');
  table.classList.add('is-table-open');
  if (table.scrollTop !== 0) {
    table.scrollTop = 0;
  }
  if (table.scrollLeft !== 0) {
    table.scrollLeft = 0;
  }
}

const MODE_ATTR = 'data-table-mode';
const COLUMN_TAB = 12;

function gridBox(host: HTMLElement, table: HTMLElement, zoom: number): Box | null {
  const nodes = [
    ...table.querySelectorAll<HTMLElement>(':scope > .lowcode-table-head'),
    ...table.querySelectorAll<HTMLElement>(':scope > [data-widget-type="tr"]'),
  ];
  if (nodes.length === 0) {
    return null;
  }
  const boxes = nodes.map((node) => hostBox(host, node, zoom));
  const left = Math.min(...boxes.map((item) => item.left));
  const top = Math.min(...boxes.map((item) => item.top));
  const right = Math.max(...boxes.map((item) => item.left + item.width));
  const bottom = Math.max(...boxes.map((item) => item.top + item.height));
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/** 按钮画出手机框时会被屏幕边裁掉，收到框内。 */
function clampButtonInView(button: HTMLElement, host: HTMLElement, zoom: number) {
  const scale = Math.max(previewVisualScale(host, zoom), 0.01);
  const rect = button.getBoundingClientRect();
  const view = button.ownerDocument.documentElement;
  const inset = 2;
  let shiftX = 0;
  let shiftY = 0;
  if (rect.top < inset) {
    shiftY = inset - rect.top;
  }
  if (rect.bottom + shiftY > view.clientHeight - inset) {
    shiftY = view.clientHeight - inset - rect.bottom;
  }
  if (rect.left < inset) {
    shiftX = inset - rect.left;
  }
  if (rect.right + shiftX > view.clientWidth - inset) {
    shiftX = view.clientWidth - inset - rect.right;
  }
  if (shiftX === 0 && shiftY === 0) {
    return;
  }
  const left = Number.parseFloat(button.style.left) || 0;
  const top = Number.parseFloat(button.style.top) || 0;
  button.style.left = `${left + shiftX / scale}px`;
  button.style.top = `${top + shiftY / scale}px`;
}

/** 表格右上角：未进入时显示「编辑表格」，编辑中显示「退出编辑」。 */
function paintTableModeButton(
  host: HTMLElement | null,
  root: HTMLElement | null,
  zoom: number,
  editing: boolean,
  labels: TableChromeLabels,
) {
  const remove = () => host?.querySelector(`[${MODE_ATTR}]`)?.remove();
  if (!host || !root || !editing) {
    remove();
    return;
  }
  const open = root.querySelector<HTMLElement>('.lowcode-table.is-table-open');
  const selected = root.querySelector<HTMLElement>('.is-widget-selected');
  const table = open ?? (selected?.dataset.widgetType === 'table' ? selected : null);
  if (!table || (open && leafOpenEditor(root) !== table)) {
    remove();
    return;
  }
  const mode = open ? 'exit' : 'enter';
  let button = host.querySelector<HTMLButtonElement>(`[${MODE_ATTR}]`);
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'table-mode-button';
    button.setAttribute(MODE_ATTR, '');
    host.append(button);
  }
  button.dataset.tableMode = mode;
  button.classList.toggle('is-exit', mode === 'exit');
  button.textContent = mode === 'exit' ? labels.exitTable || '退出编辑' : labels.editTable || '编辑表格';
  button.title = mode === 'exit' ? 'Esc' : 'Enter';
  button.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.parent.postMessage(
      { source: LOWCODE_MESSAGE_SOURCE, type: 'table-mode', action: mode },
      window.location.origin,
    );
  };
  const tableBox = hostBox(host, table, zoom);
  const anchor = mode === 'exit' ? (gridBox(host, table, zoom) ?? tableBox) : tableBox;
  // 编辑时列标高出格子 12px，按钮再离开一截，右缘对齐格子而不是表格外框。
  const above = mode === 'exit' ? COLUMN_TAB + 4 : 4;
  place(button, {
    left: `${anchor.left + anchor.width}px`,
    top: `${anchor.top - above}px`,
    transform: 'translate(-100%, -100%)',
  });
  clampButtonInView(button, host, zoom);
}

/** syncTableChrome：把行/列操作条画在预览叠层上，不进入表格布局。 */
export function syncTableChrome(
  host: HTMLElement | null,
  root: HTMLElement | null,
  model: TableChromeState | null,
  zoom: number,
  editing: boolean,
  draggingKey: string | null,
  labels: TableChromeLabels,
) {
  const openTable = root?.querySelector<HTMLElement>('.lowcode-table.is-table-open');
  if (openTable && leafOpenEditor(root) !== openTable) {
    host?.querySelector(`[${MODE_ATTR}]`)?.remove();
    host?.querySelector(`[${CHROME_ATTR}]`)?.remove();
    return;
  }
  paintTableModeButton(host, root, zoom, editing, labels);
  if (!host || !editing || !model) {
    host?.querySelector(`[${CHROME_ATTR}]`)?.remove();
    return;
  }
  const table = root?.querySelector<HTMLElement>(`[data-widget-id="${CSS.escape(model.tableId)}"]`);
  if (!table || table.dataset.widgetType !== 'table') {
    host.querySelector(`[${CHROME_ATTR}]`)?.remove();
    return;
  }
  const headers = [...table.querySelectorAll<HTMLElement>(':scope > .lowcode-table-head [data-widget-type="th"]')];
  const head = table.querySelector<HTMLElement>(':scope > .lowcode-table-head');
  const bodyRows = [...table.querySelectorAll<HTMLElement>(':scope > [data-widget-type="tr"]')];
  if (!head || headers.length === 0) {
    host.querySelector(`[${CHROME_ATTR}]`)?.remove();
    return;
  }
  const columns = headers.map((header, index) => ({ index, box: hostBox(host, header, zoom) }));
  const rows = [
    { kind: 'header' as const, id: '', box: hostBox(host, head, zoom) },
    ...bodyRows.map((row) => ({ kind: 'row' as const, id: row.dataset.widgetId ?? '', box: hostBox(host, row, zoom) })),
  ];
  const gridLeft = Math.min(...rows.map((row) => row.box.left));
  const gridTop = Math.min(...rows.map((row) => row.box.top));
  const gridHeight = Math.max(...rows.map((row) => row.box.top + row.box.height)) - gridTop;

  let overlay = host.querySelector<HTMLElement>(`[${CHROME_ATTR}]`);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.setAttribute(CHROME_ATTR, '');
    overlay.className = 'table-chrome';
    host.append(overlay);
  }
  overlay.replaceChildren();

  const range = model.range;
  if (range?.kind === 'column') {
    const column = columns.find((item) => item.index === range.index);
    if (column) {
      const wash = document.createElement('div');
      wash.className = 'table-chrome-wash';
      place(wash, {
        left: `${column.box.left}px`,
        top: `${gridTop}px`,
        width: `${column.box.width}px`,
        height: `${gridHeight}px`,
      });
      overlay.append(wash);
    }
  } else if (range) {
    const row = rows.find((item) => (range.kind === 'header' ? item.kind === 'header' : item.kind === 'row' && item.id === range.rowId));
    if (row) {
      const wash = document.createElement('div');
      wash.className = 'table-chrome-wash';
      place(wash, {
        left: `${row.box.left}px`,
        top: `${row.box.top}px`,
        width: `${row.box.width}px`,
        height: `${row.box.height}px`,
      });
      overlay.append(wash);
    }
  }

  for (const column of columns) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = range?.kind === 'column' && range.index === column.index ? 'table-chrome-tab is-col is-active' : 'table-chrome-tab is-col';
    tab.dataset.tableSelect = 'column';
    tab.dataset.tableId = model.tableId;
    tab.dataset.tableIndex = String(column.index);
    place(tab, {
      left: `${column.box.left}px`,
      top: `${gridTop}px`,
      width: `${column.box.width}px`,
    });
    overlay.append(tab);

    const hit = document.createElement('div');
    const key = `column:${column.index}`;
    hit.className = draggingKey === key ? 'table-chrome-resize is-col is-dragging' : 'table-chrome-resize is-col';
    hit.dataset.tableResize = 'column';
    hit.dataset.tableId = model.tableId;
    hit.dataset.tableIndex = String(column.index);
    hit.dataset.tableValue = String(Math.max(24, Math.round(column.box.width)));
    hit.dataset.resizeKey = key;
    place(hit, {
      left: `${column.box.left + column.box.width - 4}px`,
      top: `${gridTop}px`,
      width: '8px',
      height: `${gridHeight}px`,
    });
    overlay.append(hit);
  }

  for (const row of rows) {
    const selected =
      row.kind === 'header' ? range?.kind === 'header' : range?.kind === 'row' && range.rowId === row.id;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = selected ? 'table-chrome-tab is-row is-active' : 'table-chrome-tab is-row';
    tab.dataset.tableSelect = row.kind === 'header' ? 'header' : 'row';
    tab.dataset.tableId = model.tableId;
    if (row.kind === 'row') {
      tab.dataset.tableRow = row.id;
    }
    place(tab, {
      left: `${row.box.left}px`,
      top: `${row.box.top}px`,
      height: `${row.box.height}px`,
    });
    overlay.append(tab);

    const hit = document.createElement('div');
    const key = row.kind === 'header' ? 'header:header' : `row:${row.id}`;
    hit.className = draggingKey === key ? 'table-chrome-resize is-row is-dragging' : 'table-chrome-resize is-row';
    hit.dataset.tableResize = row.kind === 'header' ? 'header' : 'row';
    hit.dataset.tableId = model.tableId;
    hit.dataset.tableValue = String(Math.max(24, Math.round(row.box.height)));
    hit.dataset.resizeKey = key;
    if (row.kind === 'row') {
      hit.dataset.tableRow = row.id;
    }
    place(hit, {
      left: `${row.box.left}px`,
      top: `${row.box.top + row.box.height - 4}px`,
      width: `${row.box.width}px`,
      height: '8px',
    });
    overlay.append(hit);
  }

  if (!range) {
    return;
  }
  const bar = document.createElement('div');
  bar.className = 'table-chrome-ops';
  place(bar, {
    left: `${gridLeft}px`,
    top: `${gridTop - 34}px`,
  });
  if (range.kind === 'column') {
    bar.append(
      opButton('←', labels.moveLeft, { command: 'move-column-left' }),
      opButton('→', labels.moveRight, { command: 'move-column-right' }),
      opButton('+', labels.addColumn, { command: 'add-column' }),
      opButton('−', labels.removeColumn, { command: 'remove-column' }),
    );
  } else if (range.kind === 'header') {
    bar.append(
      opButton('+', labels.addRow, { command: 'add-row' }),
      opButton('固定', labels.freezeHeader, { freeze: 'header', on: model.freezeHeader }),
    );
  } else {
    bar.append(
      opButton('↑', labels.moveUp, { command: 'move-row-up' }),
      opButton('↓', labels.moveDown, { command: 'move-row-down' }),
      opButton('+', labels.addRow, { command: 'add-row' }),
      opButton('−', labels.removeRow, { command: 'remove-row' }),
    );
    if (range.rowId === model.footerRowId) {
      bar.append(opButton('固定', labels.freezeFooter, { freeze: 'footer', on: model.freezeFooter }));
    }
  }
  overlay.append(bar);
}
