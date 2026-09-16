export const LOWCODE_MESSAGE_SOURCE = 'vanstack-lowcode';

export type LowcodeReadyMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'ready';
};

export type LowcodePreviewMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'preview';
  xml: string;
  mode: 'edit' | 'preview';
  selectedId: string | null;
  scale: number;
  screenWidth: number;
  screenHeight: number;
};

export type LowcodeSelectMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'select';
  widgetId: string | null;
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
};

export type LowcodeKeydownMessage = {
  source: typeof LOWCODE_MESSAGE_SOURCE;
  type: 'keydown';
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};

export type LowcodeMessage =
  | LowcodeReadyMessage
  | LowcodePreviewMessage
  | LowcodeSelectMessage
  | LowcodeCanvasWheelMessage
  | LowcodeCanvasPointerMessage
  | LowcodeKeydownMessage;

const MESSAGE_TYPES = new Set(['ready', 'preview', 'select', 'canvas-wheel', 'canvas-pointer', 'keydown']);

export function isLowcodeMessage(value: unknown): value is LowcodeMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const message = value as { source?: unknown; type?: unknown };
  return message.source === LOWCODE_MESSAGE_SOURCE && typeof message.type === 'string' && MESSAGE_TYPES.has(message.type);
}
