import { resolveStateFnName, type PageWidget } from '@vanstack/xml';
import { widgetInstanceKey, widgetInstanceMeta } from './loop';

export const HOVER_STATE_NAME = 'hover';

export function widgetHasHoverState(widget: PageWidget): boolean {
  if (widget.states?.some((item) => item.name === HOVER_STATE_NAME)) {
    return true;
  }
  return Boolean(
    widget.stateOverrides?.some((item) => item.states?.some((nested) => nested.name === HOVER_STATE_NAME)),
  );
}

export function resolveRuntimeOwnState(
  widget: PageWidget,
  hoverInstanceKeys: readonly string[],
): string | null {
  const fromFn = resolveStateFnName(widget, widgetInstanceMeta(widget)?.scope);
  if (fromFn && fromFn !== HOVER_STATE_NAME) {
    return fromFn;
  }
  if (hoverInstanceKeys.includes(widgetInstanceKey(widget)) && widgetHasHoverState(widget)) {
    return HOVER_STATE_NAME;
  }
  return fromFn;
}

export function mergeHoverViewing(
  viewing: Array<{ ownerId: string; state: string | null }> | { ownerId: string; state: string | null } | null,
  hoverOwnerIds: readonly string[],
): Array<{ ownerId: string; state: string | null }> {
  const byOwner = new Map<string, string | null>();
  const list = !viewing ? [] : Array.isArray(viewing) ? viewing : [viewing];
  for (const item of list) {
    byOwner.set(item.ownerId, item.state);
  }
  for (const ownerId of hoverOwnerIds) {
    if (byOwner.get(ownerId)) {
      continue;
    }
    byOwner.set(ownerId, HOVER_STATE_NAME);
  }
  return [...byOwner.entries()].map(([ownerId, state]) => ({ ownerId, state }));
}
