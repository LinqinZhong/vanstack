export type WidgetShortcut =
  | 'delete'
  | 'copy'
  | 'paste'
  | 'undo'
  | 'redo'
  | 'save'
  | 'padding'
  | 'margin'
  | 'radius'
  | 'border'
  | 'size'
  | 'position'
  | 'rotate'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'lineThrough'
  | 'fontSizeUp'
  | 'fontSizeDown';

export type ShortcutKeyEvent = {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey?: boolean;
};

export function matchWidgetShortcut(event: ShortcutKeyEvent): WidgetShortcut | null {
  const mod = event.ctrlKey || event.metaKey;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const code = event.code ?? '';
  if (mod && !event.shiftKey && (key === '.' || code === 'Period')) {
    return 'fontSizeUp';
  }
  if (
    mod &&
    !event.shiftKey &&
    (key === ',' || code === 'Comma' || key === '-' || code === 'Minus' || code === 'NumpadSubtract')
  ) {
    return 'fontSizeDown';
  }
  if (mod && key === 's' && !event.shiftKey) {
    return 'save';
  }
  if (mod && key === 'd' && !event.shiftKey) {
    return 'lineThrough';
  }
  if (mod && key === 'b' && event.shiftKey) {
    return 'border';
  }
  if (mod && key === 'b' && !event.shiftKey) {
    return 'bold';
  }
  if (mod && key === 'i' && !event.shiftKey) {
    return 'italic';
  }
  if (mod && key === 'u' && !event.shiftKey) {
    return 'underline';
  }
  if (mod && key === 'p' && !event.shiftKey) {
    return 'padding';
  }
  if (mod && key === 'm' && !event.shiftKey) {
    return 'margin';
  }
  if (mod && key === 'r' && event.shiftKey) {
    return 'rotate';
  }
  if (mod && key === 'r' && !event.shiftKey) {
    return 'radius';
  }
  if (mod && key === 't' && !event.shiftKey) {
    return 'size';
  }
  if (mod && key === 'l' && !event.shiftKey) {
    return 'position';
  }
  if (mod && key === 'c' && !event.shiftKey) {
    return 'copy';
  }
  if (mod && key === 'v' && !event.shiftKey) {
    return 'paste';
  }
  if (mod && key === 'y' && !event.shiftKey) {
    return 'redo';
  }
  if (mod && key === 'z') {
    return event.shiftKey ? 'redo' : 'undo';
  }
  if (!mod && key === 'Delete') {
    return 'delete';
  }
  return null;
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (
    target.isContentEditable ||
    target.closest(
      '[contenteditable="true"], .cm-editor, .cm-content, .widget-style-bubble, .ant-input-number, .ant-select',
    )
  ) {
    return true;
  }
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function isBoxGroupShortcut(
  shortcut: WidgetShortcut,
): shortcut is 'padding' | 'margin' | 'radius' | 'border' | 'size' | 'position' | 'rotate' {
  return (
    shortcut === 'padding' ||
    shortcut === 'margin' ||
    shortcut === 'radius' ||
    shortcut === 'border' ||
    shortcut === 'size' ||
    shortcut === 'position' ||
    shortcut === 'rotate'
  );
}

export function isTextStyleShortcut(
  shortcut: WidgetShortcut,
): shortcut is 'bold' | 'italic' | 'underline' | 'lineThrough' | 'fontSizeUp' | 'fontSizeDown' {
  return (
    shortcut === 'bold' ||
    shortcut === 'italic' ||
    shortcut === 'underline' ||
    shortcut === 'lineThrough' ||
    shortcut === 'fontSizeUp' ||
    shortcut === 'fontSizeDown'
  );
}

export function modifierShortcutLabel(): string {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform) ? '⌘' : 'Ctrl';
}
