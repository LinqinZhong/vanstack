import { ownedStateIds, resolveStateFnId, type PageWidget } from '@vanstack/xml';
import { widgetInstanceKey, widgetInstanceMeta } from './loop';

export const HOVER_STATE_NAME = 'hover';

export function hoverStateId(widget: PageWidget): string | null {
  const explicit = widget.hoverStateId;
  if (explicit && ownedStateIds(widget).includes(explicit)) {
    return explicit;
  }
  return null;
}

export function widgetHasHoverState(widget: PageWidget): boolean {
  return hoverStateId(widget) != null;
}

export function resolveRuntimeOwnState(
  widget: PageWidget,
  hoverInstanceKeys: readonly string[],
): string | null {
  if (hoverInstanceKeys.includes(widgetInstanceKey(widget))) {
    const hover = hoverStateId(widget);
    if (hover) {
      return hover;
    }
  }
  return resolveStateFnId(widget, widgetInstanceMeta(widget)?.scope);
}

export function mergeHoverViewing(
  viewing: Array<{ ownerId: string; state: string | null }> | { ownerId: string; state: string | null } | null,
  hoverEntries: ReadonlyArray<{ ownerId: string; stateId: string }>,
): Array<{ ownerId: string; state: string | null }> {
  const byOwner = new Map<string, string | null>();
  const list = !viewing ? [] : Array.isArray(viewing) ? viewing : [viewing];
  for (const item of list) {
    byOwner.set(item.ownerId, item.state);
  }
  for (const { ownerId, stateId } of hoverEntries) {
    if (byOwner.get(ownerId)) {
      continue;
    }
    byOwner.set(ownerId, stateId);
  }
  return [...byOwner.entries()].map(([ownerId, state]) => ({ ownerId, state }));
}
