import {
  compactLoop,
  compactStateFn,
  compactWidgetEvents,
  sanitizeWidgetStyle,
  type FlexItemStyle,
  type PageWidget,
  type WidgetStateDelta,
} from '@vanstack/xml';
import type { WidgetCloneContext, WidgetPatch } from './types';

function cloneOptional<T extends object>(value: T | undefined): T | undefined {
  return value ? { ...value } : undefined;
}

function remapStateDelta(delta: WidgetStateDelta, map: Map<string, string>): WidgetStateDelta {
  return {
    id: map.get(delta.id) ?? delta.id,
    ...(delta.name != null ? { name: delta.name } : {}),
    ...(delta.transition != null ? { transition: delta.transition } : {}),
    ...(delta.appliedState ? { appliedState: map.get(delta.appliedState) ?? delta.appliedState } : {}),
    props: cloneOptional(delta.props),
    style: cloneOptional(delta.style),
    flex: cloneOptional(delta.flex),
    item: cloneOptional(delta.item),
    swiper: cloneOptional(delta.swiper),
    ...(delta.states?.length ? { states: delta.states.map((item) => remapStateDelta(item, map)) } : {}),
  };
}

function remapStateFn(stateFn: string | undefined, map: Map<string, string>): string | undefined {
  if (!stateFn) {
    return stateFn;
  }
  let body = stateFn;
  for (const [oldId, newId] of map) {
    body = body.split(JSON.stringify(oldId)).join(JSON.stringify(newId));
  }
  return body;
}

function cloneStateFields(widget: PageWidget, stateIdMap: Map<string, string>) {
  return {
    ...(widget.states?.length ? { states: widget.states.map((item) => remapStateDelta(item, stateIdMap)) } : {}),
    ...(widget.stateOverrides?.length
      ? { stateOverrides: widget.stateOverrides.map((item) => remapStateDelta(item, stateIdMap)) }
      : {}),
    ...(widget.stateFn ? { stateFn: remapStateFn(widget.stateFn, stateIdMap) } : {}),
    ...(widget.hoverStateId
      ? { hoverStateId: stateIdMap.get(widget.hoverStateId) ?? widget.hoverStateId }
      : {}),
    ...(widget.appliedState ? { appliedState: stateIdMap.get(widget.appliedState) ?? widget.appliedState } : {}),
    ...(widget.transition != null ? { transition: widget.transition } : {}),
  };
}

function cloneLoop(widget: PageWidget) {
  const loop = compactLoop(widget.loop);
  return loop ? { loop: { ...loop } } : {};
}

function cloneHidden(widget: PageWidget): { hidden?: true } {
  return widget.hidden ? { hidden: true } : {};
}

function cloneAlias(widget: PageWidget): { alias?: string } {
  const alias = widget.alias?.trim();
  return alias ? { alias } : {};
}

function cloneEvents(widget: PageWidget): { events?: PageWidget['events'] } {
  const events = compactWidgetEvents(widget.type, widget.events);
  return events ? { events } : {};
}

export function cloneShared(widget: PageWidget, stateIdMap: WidgetCloneContext['stateIdMap']) {
  return {
    style: cloneOptional(widget.style),
    ...cloneStateFields(widget, stateIdMap),
    ...cloneLoop(widget),
    ...cloneHidden(widget),
    ...cloneAlias(widget),
    ...cloneEvents(widget),
  };
}

export function cloneItemField(widget: { item?: FlexItemStyle }) {
  return { item: cloneOptional(widget.item) };
}

export function cloneChildren(widget: { children: PageWidget[] }, ctx: WidgetCloneContext) {
  return widget.children.map((child) => ctx.cloneChild(child));
}

export function applyCommon<T extends PageWidget>(widget: T, patch: WidgetPatch): T {
  const next = { ...widget };
  if ('style' in patch) {
    const style = sanitizeWidgetStyle(widget.type, patch.style);
    if (style) {
      next.style = style;
    } else {
      delete next.style;
    }
  }
  if (
    'item' in patch &&
    widget.type !== 'swiper-item' &&
    widget.type !== 'th' &&
    widget.type !== 'tr' &&
    widget.type !== 'td'
  ) {
    const withItem = next as T & { item?: FlexItemStyle };
    if (patch.item) {
      withItem.item = patch.item;
    } else {
      delete withItem.item;
    }
  }
  if ('hidden' in patch) {
    if (patch.hidden) {
      next.hidden = true;
    } else {
      delete next.hidden;
    }
  }
  if ('alias' in patch) {
    const alias = patch.alias?.trim();
    if (alias) {
      next.alias = alias;
    } else {
      delete next.alias;
    }
  }
  if ('loop' in patch) {
    const loop = compactLoop(patch.loop);
    if (loop) {
      next.loop = loop;
    } else {
      delete next.loop;
    }
  }
  if ('events' in patch) {
    const events = compactWidgetEvents(widget.type, patch.events);
    if (events) {
      next.events = events;
    } else {
      delete next.events;
    }
  }
  if ('stateFn' in patch) {
    const stateFn = compactStateFn(patch.stateFn);
    if (stateFn) {
      next.stateFn = stateFn;
    } else {
      delete next.stateFn;
    }
  }
  if ('hoverStateId' in patch) {
    const hoverStateId = patch.hoverStateId?.trim();
    if (hoverStateId) {
      next.hoverStateId = hoverStateId;
    } else {
      delete next.hoverStateId;
    }
  }
  return next;
}
