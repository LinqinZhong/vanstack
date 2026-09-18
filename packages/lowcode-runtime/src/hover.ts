import type { PageWidget } from '@vanstack/xml';

export const HOVER_STATE_NAME = 'hover';

export function widgetHasHoverState(widget: PageWidget): boolean {
  if (widget.states?.some((item) => item.name === HOVER_STATE_NAME)) {
    return true;
  }
  return Boolean(
    widget.stateOverrides?.some((item) => item.states?.some((nested) => nested.name === HOVER_STATE_NAME)),
  );
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
    byOwner.set(ownerId, HOVER_STATE_NAME);
  }
  return [...byOwner.entries()].map(([ownerId, state]) => ({ ownerId, state }));
}
