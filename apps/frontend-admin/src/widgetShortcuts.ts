export type WidgetShortcut = 'delete' | 'copy' | 'paste' | 'undo' | 'redo';

export type ShortcutKeyEvent = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey?: boolean;
};

export function matchWidgetShortcut(event: ShortcutKeyEvent): WidgetShortcut | null {
  const mod = event.ctrlKey || event.metaKey;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
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
  if (!mod && (key === 'Delete' || key === 'Backspace')) {
    return 'delete';
  }
  return null;
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function modifierShortcutLabel(): string {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform) ? '⌘' : 'Ctrl';
}
