import { LOWCODE_MESSAGE_SOURCE, type TableChromeState } from '../../utils/lowcode-protocol';
import { previewVisualScale } from '../../utils/spacingGuides';
import { leafOpenEditor, paintEditMask } from './scrollChrome';

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
  const width = node.offsetWidth;
  const height = node.offsetHeight;
  // 画布的低倍率靠 host 的 CSS zoom 放大布局，zoom 已经吃进 offsetWidth；
  // 这里用元素自身的 rect/offset 比值才是 CSS px 到屏幕 px 的真实比例，
  // 再乘一次 zoom 会把坐标缩成一半，列标/辅助线整体左移上移。
  const measured = width > 0 ? rect.width / width : 0;
  const scale = measured > 0 ? measured : previewVisualScale(host, zoom);
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
    // 最右列没有邻居：允许自由缩到最小值 24px，但表格宽非自适应时不能小于表格宽。
    // 表格壳的 max-content 宽度会随之增大/缩小，外框始终包住整列内容。
    const next = shared?.value ?? Math.max(lastColumnFloor(table, headers, index), value);
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

function editingTable(root: HTMLElement, tableId?: string | null): HTMLElement | null {
  // 表格编辑态可能没有任何选中节点，此时以父页给出的正在编辑的表格 id 为准。
  if (tableId) {
    const node = root.querySelector<HTMLElement>(`[data-widget-id="${CSS.escape(tableId)}"]`);
    if (node?.dataset.widgetType === 'table') {
      return node;
    }
  }
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
  tableId?: string | null,
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
  const table = tableEditing ? editingTable(root, tableId) : null;
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

/** 表格：未进入时在控件上画灰色遮罩 + 笔图标（单击选中，再点进入），编辑中显示「退出编辑」。 */
function paintTableModeButton(
  host: HTMLElement | null,
  root: HTMLElement | null,
  zoom: number,
  editing: boolean,
  labels: TableChromeLabels,
  hoverWidget: HTMLElement | null = null,
  hasSpacingDrag = false,
) {
  const removeButton = () => host?.querySelector(`[${MODE_ATTR}]`)?.remove();
  const removeMask = () => host?.querySelector('[data-edit-mask="table"]')?.remove();
  if (!host || !root || !editing) {
    removeButton();
    removeMask();
    return;
  }
  const open = root.querySelector<HTMLElement>('.lowcode-table.is-table-open');
  const selected = root.querySelector<HTMLElement>('.is-widget-selected');
  if (open) {
    removeMask();
    if (leafOpenEditor(root) !== open) {
      removeButton();
      return;
    }
    let button = host.querySelector<HTMLButtonElement>(`[${MODE_ATTR}]`);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'table-mode-button';
      button.setAttribute(MODE_ATTR, '');
      host.append(button);
    }
    button.dataset.tableMode = 'exit';
    button.classList.add('is-exit');
    button.textContent = labels.exitTable || '退出编辑';
    button.title = 'Esc';
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.parent.postMessage(
        { source: LOWCODE_MESSAGE_SOURCE, type: 'table-mode', action: 'exit' },
        window.location.origin,
      );
    };
    const tableBox = hostBox(host, open, zoom);
    const anchor = gridBox(host, open, zoom) ?? tableBox;
    const above = COLUMN_TAB + 4;
    place(button, {
      left: `${anchor.left + anchor.width}px`,
      top: `${anchor.top - above}px`,
      transform: 'translate(-100%, -100%)',
    });
    clampButtonInView(button, host, zoom);
    return;
  }
  removeButton();
  // 间距/尺寸拖拽态：不画遮罩，避免盖住间距手柄。
  if (hasSpacingDrag) {
    removeMask();
    return;
  }
  const table =
    (selected?.dataset.widgetType === 'table' ? selected : null) ??
    (hoverWidget?.dataset.widgetType === 'table' ? hoverWidget : null);
  if (!table) {
    removeMask();
    return;
  }
  const box = hostBox(host, table, zoom);
  paintEditMask(host, table, box, 'table');
}

/** 读取表格声明的宽/高，换算成像素；自适应或无法解析时返回 null。 */
function declaredSize(table: HTMLElement, axis: 'width' | 'height'): number | null {
  const raw = (axis === 'width' ? table.dataset.tableWidth : table.dataset.tableHeight)?.trim();
  if (!raw) {
    return null;
  }
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) {
    return null;
  }
  if (raw.endsWith('%')) {
    const parent = table.parentElement;
    if (!parent) {
      return null;
    }
    // 百分比相对父级内容区（不含内边距），和 CSS 的解析口径一致。
    const view = parent.ownerDocument.defaultView;
    const style = view?.getComputedStyle(parent);
    const inner = axis === 'width'
      ? parent.clientWidth - (Number.parseFloat(style?.paddingLeft ?? '') || 0) - (Number.parseFloat(style?.paddingRight ?? '') || 0)
      : parent.clientHeight - (Number.parseFloat(style?.paddingTop ?? '') || 0) - (Number.parseFloat(style?.paddingBottom ?? '') || 0);
    return inner > 0 ? (inner * value) / 100 : null;
  }
  return raw.endsWith('px') ? value : null;
}

/** 声明的宽/高换算成表格内容区尺寸（扣掉边框与内边距）；自适应或无法解析时返回 null。 */
function contentTarget(table: HTMLElement, axis: 'width' | 'height'): number | null {
  const declared = declaredSize(table, axis);
  if (declared == null) {
    return null;
  }
  const style = table.ownerDocument.defaultView?.getComputedStyle(table);
  if (!style) {
    return declared;
  }
  const px = (raw: string) => Number.parseFloat(raw) || 0;
  const border = axis === 'width'
    ? px(style.borderLeftWidth) + px(style.borderRightWidth)
    : px(style.borderTopWidth) + px(style.borderBottomWidth);
  const padding = axis === 'width'
    ? px(style.paddingLeft) + px(style.paddingRight)
    : px(style.paddingTop) + px(style.paddingBottom);
  return Math.max(0, declared - border - padding);
}

/** 宽非自适应时，最后一列的宽度下限：总列宽不能小于表格宽。 */
function lastColumnFloor(table: HTMLElement, headers: HTMLElement[], index: number): number {
  if (table.dataset.tableFitWidth != null || index !== headers.length - 1) {
    return 24;
  }
  const target = contentTarget(table, 'width');
  if (target == null) {
    return 24;
  }
  const others = headers.reduce((sum, header, headerIndex) => (headerIndex === index ? sum : sum + header.offsetWidth), 0);
  return Math.max(24, target - others);
}

/** 宽非自适应时，把「表格宽 - 总列宽」的差额补到最后一列，保证总列宽不小于表格宽。 */
function stretchTableColumns(table: HTMLElement) {
  if (table.dataset.tableFitWidth != null) {
    return;
  }
  // 表格编辑态为了外框包住全部内容会把壳强制成 max-content，
  // 这里必须按声明的宽来校正，否则差额永远算成 0。
  const target = contentTarget(table, 'width');
  if (target == null) {
    return;
  }
  const head = table.querySelector<HTMLElement>(':scope > .lowcode-table-head');
  const headers = head ? [...head.querySelectorAll<HTMLElement>(':scope > [data-widget-type="th"]')] : [];
  if (headers.length === 0) {
    return;
  }
  const widths = headers.map((header) => header.offsetWidth);
  const total = widths.reduce((sum, width) => sum + width, 0);
  if (total >= target) {
    return;
  }
  widths[widths.length - 1] += target - total;
  const template = widths.map((width) => `${width}px`).join(' ');
  head!.style.gridTemplateColumns = template;
  table.querySelectorAll<HTMLElement>(':scope > [data-widget-type="tr"]').forEach((row) => {
    row.style.gridTemplateColumns = template;
  });
}

/** 表格编辑态：调整列宽/行高时，在非自适应那一轴画蓝色辅助线，标出表格内容区的设定宽高。
 *  辅助线落在表格的 content-box 上（扣掉边框与内边距），这样最小总列宽的右缘正好和辅助线对齐。 */
function paintSizeGuide(overlay: HTMLElement, host: HTMLElement, table: HTMLElement, zoom: number) {
  const fitWidth = table.dataset.tableFitWidth != null;
  const fitHeight = table.dataset.tableFitHeight != null;
  if (fitWidth && fitHeight) {
    return;
  }
  const style = table.ownerDocument.defaultView?.getComputedStyle(table);
  if (!style) {
    return;
  }
  const px = (raw: string) => Number.parseFloat(raw) || 0;
  const borderLeft = px(style.borderLeftWidth);
  const borderRight = px(style.borderRightWidth);
  const borderTop = px(style.borderTopWidth);
  const borderBottom = px(style.borderBottomWidth);
  const paddingLeft = px(style.paddingLeft);
  const paddingRight = px(style.paddingRight);
  const paddingTop = px(style.paddingTop);
  const paddingBottom = px(style.paddingBottom);

  const box = hostBox(host, table, zoom);
  // 表格内容区的左上角与实际尺寸（编辑态壳被强制成 max-content，实际宽高可能不等于声明值）。
  const contentLeft = box.left + borderLeft + paddingLeft;
  const contentTop = box.top + borderTop + paddingTop;
  const actualContentWidth = Math.max(0, box.width - borderLeft - borderRight - paddingLeft - paddingRight);
  const actualContentHeight = Math.max(0, box.height - borderTop - borderBottom - paddingTop - paddingBottom);

  const targetWidth = fitWidth ? null : contentTarget(table, 'width');
  const targetHeight = fitHeight ? null : contentTarget(table, 'height');
  const showWidth = targetWidth != null;
  const showHeight = targetHeight != null;
  if (!showWidth && !showHeight) {
    return;
  }
  const guide = document.createElement('div');
  guide.className = 'table-chrome-size';
  guide.hidden = false;
  // 线宽用编辑铬的 hairline，缩放后仍和屏幕辅助线一样是 1 个屏幕像素。
  const line = 'var(--editor-hairline, 1px)';
  place(guide, {
    left: `${contentLeft}px`,
    top: `${contentTop}px`,
    width: `${showWidth ? targetWidth : actualContentWidth}px`,
    height: `${showHeight ? targetHeight : actualContentHeight}px`,
    borderTopWidth: showHeight ? line : '0',
    borderBottomWidth: showHeight ? line : '0',
    borderLeftWidth: showWidth ? line : '0',
    borderRightWidth: showWidth ? line : '0',
  });
  overlay.append(guide);
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
  hoverWidget: HTMLElement | null = null,
  hasSpacingDrag = false,
) {
  const openTable = root?.querySelector<HTMLElement>('.lowcode-table.is-table-open');
  if (openTable && leafOpenEditor(root) !== openTable) {
    host?.querySelector(`[${MODE_ATTR}]`)?.remove();
    host?.querySelector('[data-edit-mask="table"]')?.remove();
    host?.querySelector(`[${CHROME_ATTR}]`)?.remove();
    return;
  }
  paintTableModeButton(host, root, zoom, editing, labels, hoverWidget, hasSpacingDrag);
  if (!host || !editing || !model) {
    host?.querySelector(`[${CHROME_ATTR}]`)?.remove();
    return;
  }
  const table = root?.querySelector<HTMLElement>(`[data-widget-id="${CSS.escape(model.tableId)}"]`);
  if (!table || table.dataset.widgetType !== 'table') {
    host.querySelector(`[${CHROME_ATTR}]`)?.remove();
    return;
  }
  const tableOpen = table.classList.contains('is-table-open');
  if (tableOpen && !draggingKey) {
    // 进入表格编辑时纠正列宽：非自适应宽下总列宽不得小于表格宽。
    stretchTableColumns(table);
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
  // 蓝色辅助线只在拖拽列宽/行高时显示，标出表格设定的内容区宽高。
  if (tableOpen && draggingKey) {
    paintSizeGuide(overlay, host, table, zoom);
  }

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
