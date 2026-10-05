import type { PageI18n, PageXmlDocument } from '@vanstack/xml';

export const LOWCODE_MESSAGE_SOURCE = 'vanstack-lowcode';

export type LowcodeReadyMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'ready';
};

export type LowcodePreviewMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'preview';
  document: PageXmlDocument;
  components?: Record<string, PageXmlDocument>;
  mode: 'edit' | 'preview';
  selectedId: string | null;
  scale: number;
  viewScale: number;
  viewX: number;
  viewY: number;
  screenWidth: number;
  screenHeight: number;
  overflowX: number;
  overflowY: number;
  locale: string | null;
  catalog?: PageI18n;
  projectId?: string | null;
  pageId?: string | null;
  viewingOwnerId: string | null;
  viewingState: string | null;
  viewingStates?: Array<{ ownerId: string; state: string | null }> | null;
  spacingDrag: 'padding' | 'margin' | 'radius' | 'border' | 'size' | 'position' | 'rotate' | null;
  tableLayout?: boolean;
  tableChrome?: TableChromeState | null;
  tableEditing?: boolean;
  settle?: number;
  /** 组件画布：内容在屏幕区域内居中，父页不再画屏幕框。 */
  centerContent?: boolean;
  /** 正在编辑组件时，嵌套组件使用自己的测试数据。 */
  useComponentTestData?: boolean;
};

export type TableChromeState = {
  tableId: string;
  range: { kind: 'column'; index: number } | { kind: 'row'; rowId: string } | { kind: 'header' } | null;
  freezeHeader: boolean;
  freezeFooter: boolean;
  footerRowId: string | null;
};

export type LowcodeSelectMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'select';
  widgetId: string | null;
};

export type LowcodeTableSelectMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'table-select';
  tableId: string;
  target: 'column' | 'row' | 'header';
  index?: number;
  rowId?: string;
};

export type LowcodeTableModeMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'table-mode';
  action: 'enter' | 'exit';
};

export type LowcodeTableCommandMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'table-command';
  command:
    | 'add-column'
    | 'remove-column'
    | 'move-column-left'
    | 'move-column-right'
    | 'add-row'
    | 'remove-row'
    | 'move-row-up'
    | 'move-row-down';
};

export type LowcodeTableFreezeMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'table-freeze';
  target: 'header' | 'footer';
};

export type LowcodeTableResizeMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'table-resize';
  tableId: string;
  target: 'column' | 'row' | 'header';
  index?: number;
  rowId?: string;
  value: number;
  nextValue?: number;
  nextRowId?: string;
  phase: 'move' | 'up';
};

export type LowcodeDismissToolbarMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'dismiss-toolbar';
};

export type LowcodeFocusWidgetMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'focus-widget';
  widgetId: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

export type LowcodeCanvasWheelMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'canvas-wheel';
  clientX: number;
  clientY: number;
  deltaY: number;
};

export type LowcodeCanvasPointerMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'canvas-pointer';
  action: 'down' | 'move' | 'up';
  pointerId: number;
  clientX: number;
  clientY: number;
  screenX: number;
  screenY: number;
  button: number;
  shiftKey: boolean;
  altKey: boolean;
  spacingEdge?: 'top' | 'right' | 'bottom' | 'left';
  rotateAxis?: 'x' | 'y' | 'z';
  rotateAngle?: number;
  boxWidth?: number;
  boxHeight?: number;
};

export type LowcodeWidgetBoxMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'widget-box';
  widgetId: string;
  width: number;
  height: number;
};

export type LowcodeSpacingCommitMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'spacing-commit';
  action: 'confirm' | 'cancel';
};

export type LowcodeSpacingSnapMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'spacing-snap';
  snap: boolean;
};

export type LowcodeSpacingMirrorMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'spacing-mirror';
  mirror: boolean;
};

export type LowcodeKeydownMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'keydown' | 'keyup';
  key: string;
  code: string;
  repeat?: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};

export type LowcodeSpacingActiveMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'spacing-active';
  edges: Array<'top' | 'right' | 'bottom' | 'left'>;
  axes?: Array<'x' | 'y' | 'z'>;
  all?: boolean;
};

export type LowcodeWidgetStyleMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'widget-style';
  widgetId: string;
  css: Record<string, string>;
};

export type LowcodeSelectChromeMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'select-chrome';
  faded: boolean;
};

export type LowcodeWidgetHoverMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'widget-hover';
  widgetId: string | null;
  left: number;
  top: number;
  width: number;
  height: number;
};

export type LowcodeCanvasSettledMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'canvas-settled';
  settle: number;
};

export type LowcodeModelValueMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'model-value';
  name: string;
  value: string;
  done?: boolean;
};

export type LowcodeMessage =
  | LowcodeReadyMessage
  | LowcodePreviewMessage
  | LowcodeSelectMessage
  | LowcodeTableSelectMessage
  | LowcodeTableModeMessage
  | LowcodeTableCommandMessage
  | LowcodeTableFreezeMessage
  | LowcodeTableResizeMessage
  | LowcodeDismissToolbarMessage
  | LowcodeFocusWidgetMessage
  | LowcodeCanvasWheelMessage
  | LowcodeCanvasPointerMessage
  | LowcodeKeydownMessage
  | LowcodeSpacingCommitMessage
  | LowcodeSpacingSnapMessage
  | LowcodeSpacingMirrorMessage
  | LowcodeSpacingActiveMessage
  | LowcodeWidgetStyleMessage
  | LowcodeSelectChromeMessage
  | LowcodeWidgetHoverMessage
  | LowcodeWidgetBoxMessage
  | LowcodeCanvasSettledMessage
  | LowcodeModelValueMessage;

const MESSAGE_TYPES = new Set([
  'ready',
  'preview',
  'select',
  'table-select',
  'table-mode',
  'table-command',
  'table-freeze',
  'table-resize',
  'dismiss-toolbar',
  'focus-widget',
  'canvas-wheel',
  'canvas-pointer',
  'keydown',
  'keyup',
  'spacing-commit',
  'spacing-snap',
  'spacing-mirror',
  'spacing-active',
  'widget-style',
  'select-chrome',
  'widget-hover',
  'widget-box',
  'canvas-settled',
  'model-value',
]);

export function isLowcodeMessage(value: unknown): value is LowcodeMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const message = value as { source?: unknown; type?: unknown };
  return message.source === LOWCODE_MESSAGE_SOURCE && typeof message.type === 'string' && MESSAGE_TYPES.has(message.type);
}
