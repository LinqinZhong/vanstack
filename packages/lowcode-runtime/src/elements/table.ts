import { createElement, type CSSProperties, type ReactElement } from 'react';
import {
  DEFAULT_TABLE_COLUMN_WIDTH,
  DEFAULT_TABLE_HEADER_HEIGHT,
  DEFAULT_TABLE_HEIGHT,
  DEFAULT_TABLE_ROW_HEIGHT,
  DEFAULT_TABLE_WIDTH,
  isCopyBinding,
  resolveCopyBinding,
  sanitizeWidgetStyle,
  type PageWidget,
  type WidgetStyle,
  type SizeValue,
  type TableAlign,
  type TableValign,
} from '@vanstack/xml';
import { dynamicStyleCss, flexItemCss, hiddenCss, mergeCss, sizeCss, widgetClassName } from '../css';
import { displayWidgetCopy, widgetCssOptions, widgetStateAttr, type WidgetRenderContext } from '../widget-render';

type RowLayout = {
  columns: number;
  template: string;
  height: number;
  stickyFooter?: boolean;
  stickyBackground?: string;
};

const rowLayouts = new WeakMap<PageWidget, RowLayout>();
const cellTracks = new WeakMap<PageWidget, number>();

function track(value: number | undefined, fallback: number): number {
  return value != null && value >= 24 ? value : fallback;
}

function trackTemplate(widths: number[]): string {
  return widths.map((width) => `${width}px`).join(' ');
}

function pxBox(size: SizeValue | string | undefined, fallback: SizeValue, ctx: WidgetRenderContext): number | null {
  if (typeof size === 'string') {
    if (!ctx.evaluateBindings || !isCopyBinding(size)) {
      return null;
    }
    const parsed = Number.parseFloat(resolveCopyBinding(size, ctx.bindingScope));
    return Number.isFinite(parsed) ? parsed : null;
  }
  const value = size ?? fallback;
  return value.mode === 'px' ? value.value : null;
}

function justify(align: TableAlign | undefined): CSSProperties['justifyContent'] {
  if (align === 'center') {
    return 'center';
  }
  if (align === 'end') {
    return 'flex-end';
  }
  return 'flex-start';
}

function crossAlign(valign: TableValign | undefined): CSSProperties['alignItems'] {
  if (valign === 'top') {
    return 'flex-start';
  }
  if (valign === 'bottom') {
    return 'flex-end';
  }
  return 'center';
}

function backgroundOf(style: WidgetStyle | undefined, ctx: WidgetRenderContext): string | undefined {
  const resolved = dynamicStyleCss(style, widgetCssOptions(ctx))?.background;
  if (typeof resolved === 'string' && resolved) {
    return resolved;
  }
  const raw = style?.background;
  if (!raw || isCopyBinding(raw)) {
    return undefined;
  }
  return raw;
}

function cellBackground(widget: Extract<PageWidget, { type: 'th' | 'td' }>, ctx: WidgetRenderContext): string | undefined {
  const own = backgroundOf(widget.style, ctx);
  if (own) {
    return own;
  }
  for (const child of widget.children) {
    if (child.type === 'icon' || child.style?.width || child.style?.height) {
      continue;
    }
    const background = backgroundOf(child.style, ctx);
    if (background) {
      return background;
    }
  }
  return undefined;
}

function cellStyle(widget: Extract<PageWidget, { type: 'th' | 'td' }>, ctx: WidgetRenderContext): CSSProperties | undefined {
  const background = cellBackground(widget, ctx);
  const trackHeight = cellTracks.get(widget);
  return mergeCss(
    dynamicStyleCss(sanitizeWidgetStyle(widget.type, widget.style), widgetCssOptions(ctx)),
    {
      boxSizing: 'border-box',
      minWidth: 0,
      minHeight: trackHeight ?? 0,
      width: '100%',
      height: trackHeight ?? '100%',
      alignSelf: 'stretch',
      justifySelf: 'stretch',
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'nowrap',
      alignItems: crossAlign(widget.valign),
      justifyContent: justify(widget.align),
      textAlign: widget.align ?? 'start',
      overflow: 'hidden',
      position: 'relative',
      ...(background ? { background } : {}),
    },
    hiddenCss(widget.hidden, ctx.editing),
  );
}

function renderCell(
  widget: Extract<PageWidget, { type: 'th' | 'td' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  return createElement(
    'div',
    {
      key: ctx.instanceKey,
      className: `lowcode-table-cell ${widgetClassName(widget.id)}`,
      'data-widget-id': widget.id,
      'data-widget-type': widget.type,
      'data-state': widgetStateAttr(widget, ctx),
      style: cellStyle(widget, ctx),
      onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
      onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
    },
      [
      ...(widget.value
        ? [displayWidgetCopy(widget.value, ctx, ctx.editing && !ctx.evaluateBindings)]
        : []),
      ...widget.children.map((child) =>
        createElement(
          'div',
          {
            key: child.id,
            className: 'lowcode-table-slot',
            style: {
              display: 'flex',
              alignItems: 'center',
              alignSelf: crossAlign(widget.valign),
              flex: '0 0 auto',
            },
          },
          ctx.render(child, ctx.editing && !ctx.evaluateBindings ? { summarizeCopy: true } : undefined),
        ),
      ),
    ],
  );
}

export function renderTh(
  widget: Extract<PageWidget, { type: 'th' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  return renderCell(widget, ctx);
}

export function renderTd(
  widget: Extract<PageWidget, { type: 'td' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  return renderCell(widget, ctx);
}

function gapCell(index: number): ReactElement {
  return createElement('div', {
    key: `gap-${index}`,
    className: 'lowcode-table-gap',
    'data-table-gap': '',
    style: {
      minWidth: 0,
      height: '100%',
    },
  });
}

export function renderTr(
  widget: Extract<PageWidget, { type: 'tr' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  const layout = rowLayouts.get(widget);
  const cells = widget.children.filter((child): child is Extract<PageWidget, { type: 'td' }> => child.type === 'td');
  const columns = layout?.columns ?? cells.length;
  const template = layout?.template || trackTemplate(cells.map(() => DEFAULT_TABLE_COLUMN_WIDTH));
  const height = layout?.height ?? track(widget.height, DEFAULT_TABLE_ROW_HEIGHT);
  const slots = Array.from({ length: columns }, (_, index) =>
    cells[index] ? ctx.render(cells[index]) : gapCell(index),
  );
  return createElement(
    'div',
    {
      key: ctx.instanceKey,
      className: `lowcode-table-row ${widgetClassName(widget.id)}`,
      'data-widget-id': widget.id,
      'data-widget-type': 'tr',
      'data-state': widgetStateAttr(widget, ctx),
      style: mergeCss(
        {
          display: 'grid',
          gridTemplateColumns: template || undefined,
          gridTemplateRows: `${height}px`,
          width: 'max-content',
          height,
          minHeight: height,
          boxSizing: 'border-box',
          ...(layout?.stickyFooter
            ? { position: 'sticky', bottom: 0, zIndex: 2, background: layout.stickyBackground || '#ffffff' }
            : { position: 'relative' }),
        },
        hiddenCss(widget.hidden, ctx.editing),
      ),
      onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
      onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
    },
    slots,
  );
}

export function renderTable(
  widget: Extract<PageWidget, { type: 'table' }>,
  ctx: WidgetRenderContext,
): ReactElement {
  const style = sanitizeWidgetStyle('table', widget.style);
  const columns = widget.children.filter((child): child is Extract<PageWidget, { type: 'th' }> => child.type === 'th');
  const rows = widget.children.filter((child): child is Extract<PageWidget, { type: 'tr' }> => child.type === 'tr');
  const widths = columns.map((column) => track(column.width, DEFAULT_TABLE_COLUMN_WIDTH));
  const template = trackTemplate(widths);
  const headerHeight = track(widget.headerHeight, DEFAULT_TABLE_HEADER_HEIGHT);
  const contentWidth = widths.reduce((sum, width) => sum + width, 0);
  const contentHeight =
    (columns.length > 0 ? headerHeight : 0) +
    rows.reduce((sum, row) => sum + track(row.height, DEFAULT_TABLE_ROW_HEIGHT), 0);
  const rawOverflow = style?.overflow;
  const overflow =
    typeof rawOverflow === 'string' && ctx.evaluateBindings && isCopyBinding(rawOverflow)
      ? resolveCopyBinding(rawOverflow, ctx.bindingScope) || 'auto'
      : (rawOverflow ?? 'auto');
  const scrollable = overflow !== 'hidden' && overflow !== 'visible';
  const overflowX = ctx.editing
    ? scrollable
      ? 'hidden'
      : overflow
    : !scrollable
      ? overflow
      : contentWidth > (pxBox(style?.width, DEFAULT_TABLE_WIDTH, ctx) ?? contentWidth - 1)
        ? 'auto'
        : 'hidden';
  const overflowY = ctx.editing
    ? scrollable
      ? 'hidden'
      : overflow
    : !scrollable
      ? overflow
      : contentHeight > (pxBox(style?.height, DEFAULT_TABLE_HEIGHT, ctx) ?? contentHeight - 1)
        ? 'auto'
        : 'hidden';
  const canStick = !ctx.editing && overflowY === 'auto';
  const freeze = canStick && Boolean(widget.freezeHeader);
  const freezeFooter = canStick && Boolean(widget.freezeFooter) && rows.length > 0;
  const stickyBackground = style?.background || '#ffffff';
  for (const column of columns) {
    cellTracks.set(column, headerHeight);
  }
  for (const row of rows) {
    const rowHeight = track(row.height, DEFAULT_TABLE_ROW_HEIGHT);
    rowLayouts.set(row, {
      columns: columns.length,
      template,
      height: rowHeight,
      stickyFooter: freezeFooter && row === rows[rows.length - 1],
      stickyBackground,
    });
    for (const child of row.children) {
      if (child.type === 'td') {
        cellTracks.set(child, rowHeight);
      }
    }
  }
  const shell = mergeCss(
    dynamicStyleCss(style, widgetCssOptions(ctx)),
    flexItemCss(widget.item, widgetCssOptions(ctx)),
    hiddenCss(widget.hidden, ctx.editing),
    {
      width: sizeCss(style?.width ?? DEFAULT_TABLE_WIDTH, widgetCssOptions(ctx)),
      height: sizeCss(style?.height ?? DEFAULT_TABLE_HEIGHT, widgetCssOptions(ctx)),
      minWidth: 0,
      minHeight: 0,
      overflowX,
      overflowY,
      scrollbarWidth: 'none',
    },
    { position: 'relative', boxSizing: 'border-box' },
  );
  return createElement(
    'div',
    {
      key: ctx.instanceKey,
      className: ['lowcode-table', widgetClassName(widget.id), ctx.editing ? 'is-editing' : ''].filter(Boolean).join(' '),
      'data-widget-id': widget.id,
      'data-widget-type': 'table',
      'data-state': widgetStateAttr(widget, ctx),
      'data-table-editing': ctx.editing ? '' : undefined,
      style: shell,
      onMouseEnter: ctx.hoverFor(widget)?.onMouseEnter,
      onMouseLeave: ctx.hoverFor(widget)?.onMouseLeave,
    },
    columns.length > 0
      ? createElement(
          'div',
          {
            className: 'lowcode-table-head',
            'data-table-head': '',
            'data-table-frozen': freeze ? '' : undefined,
            style: {
              display: 'grid',
              gridTemplateColumns: template,
              gridTemplateRows: `${headerHeight}px`,
              width: 'max-content',
              height: headerHeight,
              minHeight: headerHeight,
              boxSizing: 'border-box',
              position: freeze ? 'sticky' : 'relative',
              top: freeze ? 0 : undefined,
              zIndex: freeze ? 2 : undefined,
              background: freeze ? stickyBackground : undefined,
            },
          },
          columns.map((column) => ctx.render(column)),
        )
      : null,
    rows.map((row) => ctx.render(row)),
  );
}
