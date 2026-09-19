import type { TreeDataNode } from 'antd';
import {
  compactLoop,
  compactStateFn,
  sanitizeWidgetStyle,
  type FlexContainerStyle,
  type FlexItemStyle,
  type PageWidget,
  type SwiperStyle,
  type WidgetLoop,
  type WidgetStyle,
} from '@vanstack/xml';

export type WidgetPatch = {
  value?: string;
  text?: string;
  src?: string;
  size?: number;
  hidden?: boolean;
  loop?: WidgetLoop | undefined;
  stateFn?: string | undefined;
  style?: WidgetStyle | undefined;
  flex?: FlexContainerStyle | undefined;
  swiper?: SwiperStyle | undefined;
  item?: FlexItemStyle | undefined;
};

function cloneOptional<T extends object>(value: T | undefined): T | undefined {
  return value ? { ...value } : undefined;
}

function cloneStateList(list: PageWidget['states']): PageWidget['states'] {
  if (!list || list.length === 0) {
    return undefined;
  }
  return list.map((item) => ({
    name: item.name,
    ...(item.transition != null ? { transition: item.transition } : {}),
    ...(item.appliedState ? { appliedState: item.appliedState } : {}),
    style: cloneOptional(item.style),
    flex: cloneOptional(item.flex),
    item: cloneOptional(item.item),
    swiper: cloneOptional(item.swiper),
    ...(item.states?.length ? { states: cloneStateList(item.states) } : {}),
  }));
}

function cloneStateFields(widget: PageWidget) {
  return {
    ...(widget.states?.length ? { states: cloneStateList(widget.states) } : {}),
    ...(widget.stateOverrides?.length ? { stateOverrides: cloneStateList(widget.stateOverrides) } : {}),
    ...(widget.stateFn ? { stateFn: widget.stateFn } : {}),
    ...(widget.appliedState ? { appliedState: widget.appliedState } : {}),
    ...(widget.transition != null ? { transition: widget.transition } : {}),
  };
}

function cloneLoop(widget: PageWidget): { loop?: WidgetLoop } {
  const loop = compactLoop(widget.loop);
  return loop ? { loop: { ...loop } } : {};
}

function cloneHidden(widget: PageWidget): { hidden?: true } {
  return widget.hidden ? { hidden: true } : {};
}

type ContainerWidget = Extract<PageWidget, { children: PageWidget[] }>;

export function hasChildren(widget: PageWidget): widget is ContainerWidget {
  return widget.type === 'flex' || widget.type === 'swiper' || widget.type === 'swiper-item';
}

export function canContain(parent: PageWidget | 'page' | null, childType: PageWidget['type']): boolean {
  if (!parent || parent === 'page') {
    return childType !== 'swiper-item';
  }
  if (parent.type === 'flex' || parent.type === 'swiper-item') {
    return childType !== 'swiper-item';
  }
  if (parent.type === 'swiper') {
    return childType === 'swiper-item';
  }
  return false;
}

export function emptySwiperItem(id: string): Extract<PageWidget, { type: 'swiper-item' }> {
  return { type: 'swiper-item', id, children: [] };
}

export function createSwiperWidget(id: string, nextId: () => string): Extract<PageWidget, { type: 'swiper' }> {
  return {
    type: 'swiper',
    id,
    style: sanitizeWidgetStyle('swiper', undefined),
    children: [emptySwiperItem(nextId()), emptySwiperItem(nextId()), emptySwiperItem(nextId())],
  };
}

function mapChildren(widget: ContainerWidget, children: PageWidget[]): ContainerWidget {
  return { ...widget, children };
}

export function findWidget(widgets: PageWidget[], id: string | null | undefined): PageWidget | null {
  if (!id) {
    return null;
  }
  for (const widget of widgets) {
    if (widget.id === id) {
      return widget;
    }
    if (hasChildren(widget)) {
      const nested = findWidget(widget.children, id);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

export function findParentWidget(widgets: PageWidget[], id: string | null | undefined): PageWidget | null {
  if (!id) {
    return null;
  }
  for (const widget of widgets) {
    if (hasChildren(widget)) {
      if (widget.children.some((child) => child.id === id)) {
        return widget;
      }
      const nested = findParentWidget(widget.children, id);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

export function nextSiblingWidgetId(widgets: PageWidget[], id: string | null | undefined): string | null {
  if (!id) {
    return null;
  }
  const parent = findParentWidget(widgets, id);
  const siblings = parent && hasChildren(parent) ? parent.children : widgets;
  const index = siblings.findIndex((widget) => widget.id === id);
  if (index < 0) {
    return null;
  }
  return siblings[(index + 1) % siblings.length]?.id ?? null;
}

export function firstChildWidgetId(widgets: PageWidget[], id: string | null | undefined): string | null {
  const widget = findWidget(widgets, id);
  if (!widget || !hasChildren(widget) || widget.children.length === 0) {
    return null;
  }
  return widget.children[0]?.id ?? null;
}

export function parentWidgetId(widgets: PageWidget[], id: string | null | undefined): string | null {
  return findParentWidget(widgets, id)?.id ?? null;
}

export function updateWidgetById(
  widgets: PageWidget[],
  id: string,
  patcher: (widget: PageWidget) => PageWidget,
): PageWidget[] {
  return widgets.map((widget) => {
    if (widget.id === id) {
      return patcher(widget);
    }
    if (hasChildren(widget)) {
      return mapChildren(widget, updateWidgetById(widget.children, id, patcher));
    }
    return widget;
  });
}

function applyCommon<T extends PageWidget>(widget: T, patch: WidgetPatch): T {
  const next = { ...widget };
  if ('style' in patch) {
    const style = sanitizeWidgetStyle(widget.type, patch.style);
    if (style) {
      next.style = style;
    } else {
      delete next.style;
    }
  }
  if ('item' in patch && widget.type !== 'swiper-item') {
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
  if ('loop' in patch) {
    const loop = compactLoop(patch.loop);
    if (loop) {
      next.loop = loop;
    } else {
      delete next.loop;
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
  return next;
}

export function patchWidget(widget: PageWidget, patch: WidgetPatch): PageWidget {
  if (widget.type === 'image') {
    const next = applyCommon(widget, patch);
    if (patch.src != null) {
      next.src = patch.src;
    }
    return next;
  }
  if (widget.type === 'icon') {
    const next = applyCommon(widget, patch);
    if (patch.src != null) {
      next.src = patch.src;
    }
    if (patch.size != null) {
      if (patch.size > 0) {
        next.size = patch.size;
      } else {
        delete next.size;
      }
    }
    return next;
  }
  if (widget.type === 'text') {
    const next = applyCommon(widget, patch);
    if (patch.value != null) {
      next.value = patch.value;
    }
    return next;
  }
  if (widget.type === 'button') {
    const next = applyCommon(widget, patch);
    if (patch.text != null) {
      next.text = patch.text;
    }
    return next;
  }
  if (widget.type === 'flex') {
    const next = applyCommon(widget, patch);
    if ('flex' in patch) {
      if (patch.flex) {
        next.flex = patch.flex;
      } else {
        delete next.flex;
      }
    }
    return next;
  }
  if (widget.type === 'swiper') {
    const next = applyCommon(widget, patch);
    if ('swiper' in patch) {
      if (patch.swiper) {
        next.swiper = patch.swiper;
      } else {
        delete next.swiper;
      }
    }
    return next;
  }
  return applyCommon(widget, patch);
}

function appendChild(node: PageWidget, child: PageWidget): PageWidget {
  if (!hasChildren(node)) {
    return node;
  }
  return mapChildren(node, [...node.children, child]);
}

function ensureItemThenAppend(swiper: Extract<PageWidget, { type: 'swiper' }>, widget: PageWidget): PageWidget {
  if (swiper.children.length === 0) {
    return {
      ...swiper,
      children: [{ type: 'swiper-item', id: nextWidgetId(), children: [widget] }],
    };
  }
  const last = swiper.children[swiper.children.length - 1];
  if (last.type !== 'swiper-item') {
    return {
      ...swiper,
      children: [...swiper.children, { type: 'swiper-item', id: nextWidgetId(), children: [widget] }],
    };
  }
  return {
    ...swiper,
    children: [...swiper.children.slice(0, -1), { ...last, children: [...last.children, widget] }],
  };
}

function placeInContainer(selected: PageWidget, widget: PageWidget): PageWidget | null {
  if (selected.type === 'swiper') {
    if (widget.type === 'swiper-item') {
      return appendChild(selected, widget);
    }
    return ensureItemThenAppend(selected, widget);
  }
  if (canContain(selected, widget.type)) {
    return appendChild(selected, widget);
  }
  return null;
}

export function addWidgetToTree(
  widgets: PageWidget[],
  selectedId: string | null,
  widget: PageWidget,
): PageWidget[] {
  const selected = findWidget(widgets, selectedId);
  if (selected) {
    if (selected.type === 'swiper-item' && widget.type === 'swiper-item') {
      const inserted = insertAfterSibling(widgets, selected.id, widget);
      return inserted.found ? inserted.widgets : widgets;
    }
    const next = placeInContainer(selected, widget);
    if (next) {
      return updateWidgetById(widgets, selected.id, () => next);
    }
  }
  if (!canContain('page', widget.type)) {
    return widgets;
  }
  return [...widgets, widget];
}

export type RemoveWidgetResult = {
  widgets: PageWidget[];
  nextSelectedId: string | null;
};

function removeFromList(list: PageWidget[], id: string, parentId: string | null): RemoveWidgetResult & { found: boolean } {
  const index = list.findIndex((widget) => widget.id === id);
  if (index >= 0) {
    const prev = list[index - 1]?.id ?? null;
    const next = list[index + 1]?.id ?? null;
    return {
      widgets: [...list.slice(0, index), ...list.slice(index + 1)],
      nextSelectedId: parentId ?? prev ?? next,
      found: true,
    };
  }
  for (let i = 0; i < list.length; i += 1) {
    const widget = list[i];
    if (!hasChildren(widget)) {
      continue;
    }
    const nested = removeFromList(widget.children, id, widget.id);
    if (nested.found) {
      const nextList = [...list];
      nextList[i] = mapChildren(widget, nested.widgets);
      return { widgets: nextList, nextSelectedId: nested.nextSelectedId, found: true };
    }
  }
  return { widgets: list, nextSelectedId: null, found: false };
}

export function removeWidget(widgets: PageWidget[], id: string): RemoveWidgetResult {
  const result = removeFromList(widgets, id, null);
  return { widgets: result.widgets, nextSelectedId: result.nextSelectedId };
}

function insertAfterSibling(
  list: PageWidget[],
  siblingId: string,
  widget: PageWidget,
  parent: PageWidget | 'page' = 'page',
): { widgets: PageWidget[]; found: boolean } {
  const index = list.findIndex((item) => item.id === siblingId);
  if (index >= 0) {
    if (!canContain(parent, widget.type)) {
      return { widgets: list, found: true };
    }
    return {
      widgets: [...list.slice(0, index + 1), widget, ...list.slice(index + 1)],
      found: true,
    };
  }
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    if (!hasChildren(item)) {
      continue;
    }
    const nested = insertAfterSibling(item.children, siblingId, widget, item);
    if (nested.found) {
      const nextList = [...list];
      nextList[i] = mapChildren(item, nested.widgets);
      return { widgets: nextList, found: true };
    }
  }
  return { widgets: list, found: false };
}

export function insertWidget(widgets: PageWidget[], selectedId: string | null, widget: PageWidget): PageWidget[] {
  const selected = findWidget(widgets, selectedId);
  if (selected) {
    if (selected.type === 'swiper-item' && widget.type === 'swiper-item') {
      const inserted = insertAfterSibling(widgets, selected.id, widget);
      return inserted.found ? inserted.widgets : widgets;
    }
    const next = placeInContainer(selected, widget);
    if (next) {
      return updateWidgetById(widgets, selected.id, () => next);
    }
    const inserted = insertAfterSibling(widgets, selected.id, widget);
    if (inserted.found) {
      return inserted.widgets;
    }
  }
  if (!canContain('page', widget.type)) {
    return widgets;
  }
  return [...widgets, widget];
}

let widgetIdSeq = 0;

export function nextWidgetId(): string {
  widgetIdSeq += 1;
  return `n${Date.now().toString(36)}-${widgetIdSeq}`;
}

export function cloneWidget(widget: PageWidget, nextId: () => string = nextWidgetId): PageWidget {
  const states = cloneStateFields(widget);
  if (widget.type === 'image') {
    return {
      type: 'image',
      id: nextId(),
      src: widget.src,
      style: cloneOptional(widget.style),
      item: cloneOptional(widget.item),
      ...states,
      ...cloneLoop(widget),
      ...cloneHidden(widget),
    };
  }
  if (widget.type === 'icon') {
    return {
      type: 'icon',
      id: nextId(),
      src: widget.src,
      ...(widget.size != null ? { size: widget.size } : {}),
      style: cloneOptional(widget.style),
      item: cloneOptional(widget.item),
      ...states,
      ...cloneLoop(widget),
      ...cloneHidden(widget),
    };
  }
  if (widget.type === 'text') {
    return {
      type: 'text',
      id: nextId(),
      value: widget.value,
      style: cloneOptional(widget.style),
      item: cloneOptional(widget.item),
      ...states,
      ...cloneLoop(widget),
      ...cloneHidden(widget),
    };
  }
  if (widget.type === 'button') {
    return {
      type: 'button',
      id: nextId(),
      text: widget.text,
      style: cloneOptional(widget.style),
      item: cloneOptional(widget.item),
      ...states,
      ...cloneLoop(widget),
      ...cloneHidden(widget),
    };
  }
  if (widget.type === 'flex') {
    return {
      type: 'flex',
      id: nextId(),
      children: widget.children.map((child) => cloneWidget(child, nextId)),
      style: cloneOptional(widget.style),
      flex: cloneOptional(widget.flex),
      item: cloneOptional(widget.item),
      ...states,
      ...cloneLoop(widget),
      ...cloneHidden(widget),
    };
  }
  if (widget.type === 'swiper') {
    return {
      type: 'swiper',
      id: nextId(),
      children: widget.children.map((child) => cloneWidget(child, nextId)),
      style: cloneOptional(widget.style),
      swiper: cloneOptional(widget.swiper),
      item: cloneOptional(widget.item),
      ...states,
      ...cloneLoop(widget),
      ...cloneHidden(widget),
    };
  }
  return {
    type: 'swiper-item',
    id: nextId(),
    children: widget.children.map((child) => cloneWidget(child, nextId)),
    style: cloneOptional(widget.style),
    ...states,
    ...cloneLoop(widget),
    ...cloneHidden(widget),
  };
}

export function collectExpandableKeys(widgets: PageWidget[]): string[] {
  const keys: string[] = [];
  for (const widget of widgets) {
    if (hasChildren(widget)) {
      keys.push(widget.id);
      keys.push(...collectExpandableKeys(widget.children));
    }
  }
  return keys;
}

export function collectAncestorKeys(widgets: PageWidget[], id: string | null | undefined): string[] {
  if (!id) {
    return [];
  }
  for (const widget of widgets) {
    if (widget.id === id) {
      return [];
    }
    if (!hasChildren(widget)) {
      continue;
    }
    const nested = collectAncestorKeys(widget.children, id);
    if (widget.children.some((child) => child.id === id) || nested.length > 0) {
      return [widget.id, ...nested];
    }
  }
  return [];
}

export function nextExpandedKeys(
  prevExpanded: readonly string[],
  previousWidgets: PageWidget[],
  nextWidgets: PageWidget[],
  revealId?: string | null,
): string[] {
  const expandable = collectExpandableKeys(nextWidgets);
  const expandableSet = new Set(expandable);
  const previouslyExpandable = new Set(collectExpandableKeys(previousWidgets));
  const next = new Set(prevExpanded.filter((key) => expandableSet.has(key)));
  for (const key of expandable) {
    if (!previouslyExpandable.has(key)) {
      next.add(key);
    }
  }
  for (const key of collectAncestorKeys(nextWidgets, revealId)) {
    next.add(key);
  }
  return [...next];
}

export function widgetTypeName(type: PageWidget['type'], t: (key: string) => string): string {
  if (type === 'image') {
    return t('lowcode.defaultImage');
  }
  if (type === 'icon') {
    return t('lowcode.defaultIcon');
  }
  if (type === 'text') {
    return t('lowcode.defaultText');
  }
  if (type === 'button') {
    return t('lowcode.defaultButton');
  }
  if (type === 'swiper') {
    return t('lowcode.defaultSwiper');
  }
  if (type === 'swiper-item') {
    return t('lowcode.defaultSwiperItem');
  }
  return t('lowcode.defaultFlex');
}

export function widgetTreeLabel(widget: PageWidget, t: (key: string) => string): string {
  const typeName = widgetTypeName(widget.type, t);
  if (widget.type === 'text') {
    return `${typeName} · ${widget.value}`;
  }
  if (widget.type === 'button') {
    return `${typeName} · ${widget.text}`;
  }
  return typeName;
}

export type WidgetDropPlacement = 'before' | 'after' | 'inside';

function widgetContainsId(widget: PageWidget, id: string): boolean {
  if (!hasChildren(widget)) {
    return false;
  }
  return widget.children.some((child) => child.id === id || widgetContainsId(child, id));
}

function extractFromList(list: PageWidget[], id: string): { list: PageWidget[]; widget: PageWidget } | null {
  const index = list.findIndex((item) => item.id === id);
  if (index >= 0) {
    return {
      list: [...list.slice(0, index), ...list.slice(index + 1)],
      widget: list[index],
    };
  }
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    if (!hasChildren(item)) {
      continue;
    }
    const nested = extractFromList(item.children, id);
    if (nested) {
      const nextList = [...list];
      nextList[i] = mapChildren(item, nested.list);
      return { list: nextList, widget: nested.widget };
    }
  }
  return null;
}

function insertIntoList(
  list: PageWidget[],
  widget: PageWidget,
  targetId: string,
  placement: WidgetDropPlacement,
  parent: PageWidget | 'page',
): PageWidget[] | null {
  const index = list.findIndex((item) => item.id === targetId);
  if (index >= 0) {
    const target = list[index];
    let nextPlacement = placement;
    if (nextPlacement === 'inside') {
      const placed = placeInContainer(target, widget);
      if (placed) {
        const next = [...list];
        next[index] = placed;
        return next;
      }
      nextPlacement = 'after';
    }
    if (!canContain(parent, widget.type)) {
      return null;
    }
    const at = nextPlacement === 'before' ? index : index + 1;
    return [...list.slice(0, at), widget, ...list.slice(at)];
  }
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    if (!hasChildren(item)) {
      continue;
    }
    const nested = insertIntoList(item.children, widget, targetId, placement, item);
    if (nested) {
      const next = [...list];
      next[i] = mapChildren(item, nested);
      return next;
    }
  }
  return null;
}

export function canMoveWidget(
  widgets: PageWidget[],
  dragId: string,
  dropId: string,
  placement: WidgetDropPlacement,
): boolean {
  if (dragId === dropId) {
    return false;
  }
  const drag = findWidget(widgets, dragId);
  const drop = findWidget(widgets, dropId);
  if (!drag || !drop || widgetContainsId(drag, dropId)) {
    return false;
  }
  if (placement === 'inside') {
    if (placeInContainer(drop, drag)) {
      return true;
    }
    placement = 'after';
  }
  const parent = findParentWidget(widgets, dropId);
  return canContain(parent ?? 'page', drag.type);
}

export function moveWidget(
  widgets: PageWidget[],
  dragId: string,
  dropId: string,
  placement: WidgetDropPlacement,
): PageWidget[] | null {
  if (!canMoveWidget(widgets, dragId, dropId, placement)) {
    return null;
  }
  const extracted = extractFromList(widgets, dragId);
  if (!extracted) {
    return null;
  }
  return insertIntoList(extracted.list, extracted.widget, dropId, placement, 'page');
}

export function toWidgetTreeData(
  widgets: PageWidget[],
  labelOf: (widget: PageWidget) => string,
): TreeDataNode[] {
  return widgets.map((widget) => ({
    key: widget.id,
    title: labelOf(widget),
    children: hasChildren(widget) ? toWidgetTreeData(widget.children, labelOf) : undefined,
  }));
}
