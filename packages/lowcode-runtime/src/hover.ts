import { appliedStateId, nestedAppliedStateId, ownedStateIds, resolveStateFnId, type PageWidget } from '@vanstack/xml';
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

/**
 * 运行时自身激活状态：按「分组」解析，返回浅→深排序的状态 id 列表。
 * - 根组（widget.states）与每个已激活作用域（inheritedIds，祖先激活状态）下的嵌套组各自独立，
 *   不同分组（不同父亲）的状态可同时生效；同分组内仍互斥。
 * - designated = hover ?? stateFn（单值契约不变），只指定其所在分组；
 *   嵌套组未被指定时自动跟随作用域激活（嵌套 appliedState 优先，否则取第一个嵌套状态），
 *   根组被嵌套状态指定时回退静态 appliedState。
 */
export function resolveRuntimeOwnState(
  widget: PageWidget,
  hoverInstanceKeys: readonly string[],
  inheritedIds: readonly string[] = [],
): string[] {
  const hovering = hoverInstanceKeys.includes(widgetInstanceKey(widget));
  const hoverId = hovering ? hoverStateId(widget) : null;
  const fnId = resolveStateFnId(widget, widgetInstanceMeta(widget)?.scope);
  const designated = hoverId ?? fnId;
  const out: string[] = [];
  const pushUnique = (id: string | null | undefined) => {
    if (id && !out.includes(id)) {
      out.push(id);
    }
  };
  // 根组：被指定则用指定值；被嵌套状态占用时回退静态 appliedState；无指定保持基础外观。
  if (designated && widget.states?.some((item) => item.id === designated)) {
    pushUnique(designated);
  } else if (designated) {
    pushUnique(appliedStateId(widget));
  }
  // 嵌套组：仅当作用域激活时参与；组内被指定则用指定，否则嵌套 appliedState，再否则第一个嵌套状态。
  for (const scopeId of inheritedIds) {
    const override = widget.stateOverrides?.find((item) => item.id === scopeId);
    const nested = override?.states ?? [];
    if (nested.length === 0) {
      continue;
    }
    if (designated && nested.some((item) => item.id === designated)) {
      pushUnique(designated);
      continue;
    }
    pushUnique(nestedAppliedStateId(override) ?? nested.find((item) => Boolean(item.id))?.id ?? null);
  }
  return out;
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
