import type { TreeDataNode } from 'antd';
import type { ComponentSlot, PageWidget, WidgetStateDelta } from '@vanstack/xml';
import { acceptsChild, cloneWidgetByType, widgetHelpers } from '../widgets';
import { createSwiperItem } from '../widgets/swiper-item';
import { createWindow } from '../widgets/window';

export type { WidgetPatch } from '../widgets';
export { ADDABLE_WIDGET_TYPES, createWidget, patchWidget, widgetTreeLabel, widgetTypeName } from '../widgets';

const STATE_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const STATE_ID_BODY_LENGTH = 10;
const STATE_ID_RETRY_LIMIT = 100;

function randomStateIdBody(): string {
  let body = '';
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(STATE_ID_BODY_LENGTH);
    cryptoObj.getRandomValues(bytes);
    for (const byte of bytes) {
      body += STATE_ID_ALPHABET[byte % STATE_ID_ALPHABET.length];
    }
  } else {
    for (let i = 0; i < STATE_ID_BODY_LENGTH; i += 1) {
      body += STATE_ID_ALPHABET[Math.floor(Math.random() * STATE_ID_ALPHABET.length)];
    }
  }
  return body;
}

export function nextStateId(used?: ReadonlySet<string>): string {
  let id = `s${randomStateIdBody()}`;
  let attempts = 0;
  while (used?.has(id) && attempts < STATE_ID_RETRY_LIMIT) {
    id = `s${randomStateIdBody()}`;
    attempts += 1;
  }
  return id;
}

export function collectTreeStateIds(widgets: PageWidget[]): Set<string> {
  const ids = new Set<string>();
  const visitDelta = (delta: WidgetStateDelta) => {
    ids.add(delta.id);
    for (const nested of delta.states ?? []) {
      visitDelta(nested);
    }
  };
  const visitWidget = (widget: PageWidget) => {
    for (const delta of widget.states ?? []) {
      visitDelta(delta);
    }
    for (const override of widget.stateOverrides ?? []) {
      visitDelta(override);
    }
    if ('children' in widget) {
      for (const child of widget.children) {
        visitWidget(child);
      }
    }
    if (widget.type === 'component' && widget.slotContent) {
      for (const group of Object.values(widget.slotContent)) {
        for (const child of group) {
          visitWidget(child);
        }
      }
    }
  };
  for (const widget of widgets) {
    visitWidget(widget);
  }
  return ids;
}

function collectOwnedStateIds(
  list: PageWidget['states'] | undefined,
  map: Map<string, string>,
  genId: () => string,
) {
  for (const item of list ?? []) {
    if (!map.has(item.id)) {
      map.set(item.id, genId());
    }
    collectOwnedStateIds(item.states, map, genId);
  }
}

function collectSubtreeStateIds(
  widget: PageWidget,
  map: Map<string, string>,
  genId: () => string,
) {
  collectOwnedStateIds(widget.states, map, genId);
  for (const override of widget.stateOverrides ?? []) {
    collectOwnedStateIds(override.states, map, genId);
  }
  if ('children' in widget) {
    for (const child of widget.children) {
      collectSubtreeStateIds(child, map, genId);
    }
  }
}

type ContainerWidget = Extract<PageWidget, { children: PageWidget[] }>;

export function hasChildren(widget: PageWidget): widget is ContainerWidget {
  return widgetHelpers[widget.type].container;
}

export function canContain(parent: PageWidget | 'page' | null, childType: PageWidget['type']): boolean {
  if (!parent || parent === 'page') {
    return widgetHelpers[childType].allowRoot;
  }
  return acceptsChild(widgetHelpers[parent.type].accepts, childType);
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

export function findOwningSwiper(
  widgets: PageWidget[],
  id: string | null | undefined,
): Extract<PageWidget, { type: 'swiper' }> | null {
  let current = findWidget(widgets, id);
  while (current) {
    if (current.type === 'swiper') {
      return current;
    }
    current = findParentWidget(widgets, current.id);
  }
  return null;
}

export function findOwningScroll(
  widgets: PageWidget[],
  id: string | null | undefined,
): Extract<PageWidget, { type: 'scroll' }> | null {
  let current = findWidget(widgets, id);
  while (current) {
    if (current.type === 'scroll') {
      return current;
    }
    current = findParentWidget(widgets, current.id);
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

function appendChild(node: PageWidget, child: PageWidget): PageWidget {
  if (!hasChildren(node)) {
    return node;
  }
  return mapChildren(node, [...node.children, child]);
}

function swiperItemAround(widget: PageWidget): Extract<PageWidget, { type: 'swiper-item' }> {
  return createSwiperItem(nextWidgetId(), [widget]);
}

function windowAround(widget: PageWidget): Extract<PageWidget, { type: 'window' }> {
  return createWindow(nextWidgetId(), '', [widget]);
}

function ensureWindowThenAppend(host: Extract<PageWidget, { type: 'windows' }>, widget: PageWidget): PageWidget {
  if (host.children.length === 0) {
    return { ...host, children: [windowAround(widget)] };
  }
  const last = host.children[host.children.length - 1];
  if (last.type !== 'window') {
    return { ...host, children: [...host.children, windowAround(widget)] };
  }
  return {
    ...host,
    children: [...host.children.slice(0, -1), { ...last, children: [...last.children, widget] }],
  };
}

function ensureItemThenAppend(swiper: Extract<PageWidget, { type: 'swiper' }>, widget: PageWidget): PageWidget {
  if (swiper.children.length === 0) {
    return {
      ...swiper,
      children: [swiperItemAround(widget)],
    };
  }
  const last = swiper.children[swiper.children.length - 1];
  if (last.type !== 'swiper-item') {
    return {
      ...swiper,
      children: [...swiper.children, swiperItemAround(widget)],
    };
  }
  return {
    ...swiper,
    children: [...swiper.children.slice(0, -1), { ...last, children: [...last.children, widget] }],
  };
}

function firstTableCell(table: Extract<PageWidget, { type: 'table' }>): PageWidget | null {
  const header = table.children.find((child) => child.type === 'th');
  if (header) {
    return header;
  }
  for (const row of table.children) {
    if (row.type !== 'tr') {
      continue;
    }
    const cell = row.children.find((child) => child.type === 'td');
    if (cell) {
      return cell;
    }
  }
  return null;
}

function tableCellForInsert(widgets: PageWidget[], selected: PageWidget): PageWidget | null {
  if (selected.type === 'th' || selected.type === 'td') {
    return selected;
  }
  if (selected.type === 'tr') {
    return selected.children.find((child) => child.type === 'td') ?? null;
  }
  if (selected.type === 'table') {
    return firstTableCell(selected);
  }
  let parent = findParentWidget(widgets, selected.id);
  while (parent) {
    if (parent.type === 'th' || parent.type === 'td') {
      return parent;
    }
    parent = findParentWidget(widgets, parent.id);
  }
  return null;
}

function placeInContainer(selected: PageWidget, widget: PageWidget): PageWidget | null {
  if (selected.type === 'swiper') {
    if (widget.type === 'swiper-item') {
      return appendChild(selected, widget);
    }
    return ensureItemThenAppend(selected, widget);
  }
  if (selected.type === 'windows') {
    if (widget.type === 'window') {
      return appendChild(selected, widget);
    }
    return ensureWindowThenAppend(selected, widget);
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
    if (
      (selected.type === 'swiper-item' && widget.type === 'swiper-item') ||
      (selected.type === 'window' && widget.type === 'window')
    ) {
      const inserted = insertAfterSibling(widgets, selected.id, widget);
      return inserted.found ? inserted.widgets : widgets;
    }
    const next = placeInContainer(selected, widget);
    if (next) {
      return updateWidgetById(widgets, selected.id, () => next);
    }
    const cell = tableCellForInsert(widgets, selected);
    if (cell && cell.id !== selected.id) {
      const placed = placeInContainer(cell, widget);
      if (placed) {
        return updateWidgetById(widgets, cell.id, () => placed);
      }
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
    if (
      (selected.type === 'swiper-item' && widget.type === 'swiper-item') ||
      (selected.type === 'window' && widget.type === 'window')
    ) {
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

export function cloneWidget(
  widget: PageWidget,
  nextId: () => string = nextWidgetId,
  reservedStateIds: ReadonlySet<string> = new Set(),
): PageWidget {
  const used = new Set(reservedStateIds);
  const stateIdMap = new Map<string, string>();
  collectSubtreeStateIds(widget, stateIdMap, () => {
    const id = nextStateId(used);
    used.add(id);
    return id;
  });
  return cloneWidgetNode(widget, nextId, stateIdMap);
}

function cloneWidgetNode(
  widget: PageWidget,
  nextId: () => string,
  stateIdMap: Map<string, string>,
): PageWidget {
  return cloneWidgetByType(widget, {
    nextId,
    stateIdMap,
    cloneChild: (child) => cloneWidgetNode(child, nextId, stateIdMap),
  });
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

export function collectWidgetIds(widgets: PageWidget[]): string[] {
  const ids: string[] = [];
  for (const widget of widgets) {
    ids.push(widget.id);
    if (hasChildren(widget)) {
      ids.push(...collectWidgetIds(widget.children));
    }
  }
  return ids;
}

export function nextExpandedKeys(
  prevExpanded: readonly string[],
  previousWidgets: PageWidget[],
  nextWidgets: PageWidget[],
  revealId?: string | null,
): string[] {
  const expandable = collectExpandableKeys(nextWidgets);
  const previouslyExpandable = new Set(collectExpandableKeys(previousWidgets));
  // 控件树里除了页面控件模型，还挂着组件实例的虚拟节点（`实例id__模板插槽id`）与插槽内容
  // 控件（存在组件实例的 slotContent 里，不属于 page.widgets）。只按页面模型的可展开键过滤
  // 会把它们整片剪掉，于是「组件编辑 / 插槽使用编辑」下任何一次提交（点眼睛、改样式）都会
  // 让控件树折叠。这里改为只裁掉「上一份模型里存在、新模型里已被删除」的控件键。
  const aliveIds = new Set(collectWidgetIds(nextWidgets));
  const removedIds = new Set(collectWidgetIds(previousWidgets).filter((id) => !aliveIds.has(id)));
  const next = new Set(prevExpanded.filter((key) => !removedIds.has(key)));
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

/**
 * 组件定义编辑器的控件树取数：未进入插槽调试态时插槽不展开内部调试节点，
 * 进入调试态后只显示该插槽内部的调试节点（插槽自身不再作为根节点显示）。
 */
export function definitionTreeWidgets(widgets: PageWidget[], slotDebugId: string | null): PageWidget[] {
  if (slotDebugId) {
    const slot = findWidget(widgets, slotDebugId);
    return slot && hasChildren(slot) ? slot.children : [];
  }
  const prune = (list: PageWidget[]): PageWidget[] =>
    list.map((widget) => {
      if (!hasChildren(widget)) {
        return widget;
      }
      if (widget.type === 'slot') {
        return mapChildren(widget, []);
      }
      return mapChildren(widget, prune(widget.children));
    });
  return prune(widgets);
}

// ---------------------------------------------------------------------------
// 组件插槽：声明修复、组件实例 slotContent 的读写、编辑组件时的虚拟控件树
// ---------------------------------------------------------------------------

const SLOT_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const SLOT_ID_BODY_LENGTH = 10;

export function generateSlotId(): string {
  let body = '';
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(SLOT_ID_BODY_LENGTH);
    cryptoObj.getRandomValues(bytes);
    for (const byte of bytes) {
      body += SLOT_ID_ALPHABET[byte % SLOT_ID_ALPHABET.length];
    }
  } else {
    for (let i = 0; i < SLOT_ID_BODY_LENGTH; i += 1) {
      body += SLOT_ID_ALPHABET[Math.floor(Math.random() * SLOT_ID_ALPHABET.length)];
    }
  }
  return `s${body}`;
}

/** 生成默认插槽名称：取已有名称里最大的“插槽N”数字后缀 +1，允许重名。 */
export function nextSlotName(existingNames: string[]): string {
  let max = 0;
  for (const name of existingNames) {
    const match = /^插槽(\d+)$/.exec(name);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return `插槽${max + 1}`;
}

/** 收集组件模板内的全部插槽控件。 */
export function collectTemplateSlots(widgets: PageWidget[]): Array<Extract<PageWidget, { type: 'slot' }>> {
  const result: Array<Extract<PageWidget, { type: 'slot' }>> = [];
  const walk = (list: PageWidget[]) => {
    for (const widget of list) {
      if (widget.type === 'slot') {
        result.push(widget);
      }
      if (hasChildren(widget)) {
        walk(widget.children);
      }
    }
  };
  walk(widgets);
  return result;
}

/**
 * 组件文档加载时修复插槽：给未绑定 slotId 的插槽控件生成声明，保证每个插槽都能被页面使用方定位。
 */
export function healComponentSlots(
  widgets: PageWidget[],
  slots: ComponentSlot[],
): { widgets: PageWidget[]; slots: ComponentSlot[] } {
  const declared = new Map(slots.map((slot) => [slot.id, slot]));
  let nextSlots = slots;
  let changed = false;

  const ensureName = () =>
    nextSlotName(
      Array.from(declared.values())
        .map((slot) => slot.name?.trim())
        .filter(Boolean) as string[],
    );

  // 旧数据里插槽 name 可能等于类型名"插槽"（无序号占位），视为未命名，需重新自动命名。
  const usableSlotName = (name?: string) => {
    const trimmed = name?.trim();
    return trimmed && !/^插槽$/.test(trimmed) ? trimmed : '';
  };

  const walk = (list: PageWidget[], parent?: PageWidget): PageWidget[] =>
    list.map((widget) => {
      let next = widget;
      if (widget.type === 'slot') {
        const slotId = widget.slotId && widget.slotId !== 'undefined' ? widget.slotId : '';
        if (!slotId) {
          const newId = generateSlotId();
          const name = usableSlotName(widget.name) || ensureName();
          declared.set(newId, { id: newId, ...(name ? { name } : {}) });
          nextSlots = [...nextSlots, declared.get(newId)!];
          next = { ...widget, slotId: newId, ...(name ? { name } : {}) };
          changed = true;
        } else if (!declared.has(slotId)) {
          // 已有合法 slotId 但缺少声明：保留原 id 并补声明，避免重新生成导致页面 slotContent 断链。
          const name = usableSlotName(widget.name) || ensureName();
          declared.set(slotId, { id: slotId, ...(name ? { name } : {}) });
          nextSlots = [...nextSlots, declared.get(slotId)!];
          changed = true;
        } else {
          // 双向同步插槽名称：契约面板编辑声明 name、属性面板编辑控件 name，两者需保持一致，
          // 否则控件树（读控件 name）与运行时插槽名称（读控件 name）会拿不到名称。
          const declaration = declared.get(slotId)!;
          const widgetName = usableSlotName(widget.name);
          const declName = usableSlotName(declaration.name);
          if (declName && !widgetName) {
            next = { ...widget, name: declName };
            changed = true;
          } else if (widgetName && !declName) {
            declared.set(slotId, { ...declaration, name: widgetName });
            nextSlots = nextSlots.map((item) => (item.id === slotId ? declared.get(slotId)! : item));
            changed = true;
          } else if (!widgetName && !declName) {
            // 两侧都缺失、或都是"插槽"这类无序号占位名：重新自动命名，保证控件树/插槽栏/运行时都能拿到名称。
            const name = ensureName();
            declared.set(slotId, { ...declaration, name });
            nextSlots = nextSlots.map((item) => (item.id === slotId ? declared.get(slotId)! : item));
            next = { ...widget, name };
            changed = true;
          }
        }
        // 位置稳定：行向 space-between 容器里的“末尾插槽”用 auto 外边距钉在主轴末端，
        // 避免前置控件被 existsFn 等条件移除后，插槽从右侧滑到左侧（文档与页面表现不一致）。
        if (parent?.type === 'flex' && hasChildren(parent) && parent.children[parent.children.length - 1] === widget) {
          const direction = parent.flex?.flexDirection || 'row';
          if (parent.flex?.justifyContent === 'space-between' && (direction === 'row' || direction === 'row-reverse')) {
            const marginKey: 'marginLeft' | 'marginRight' = direction === 'row-reverse' ? 'marginRight' : 'marginLeft';
            if (!next.style?.[marginKey]) {
              next = { ...next, style: { ...next.style, [marginKey]: { mode: 'auto' } } } as PageWidget;
              changed = true;
            }
          }
        }
      }
      if (hasChildren(next)) {
        const children = walk(next.children, next);
        if (children !== next.children) {
          next = { ...next, children } as PageWidget;
          changed = true;
        }
      }
      return next;
    });

  const nextWidgets = walk(widgets);
  return changed ? { widgets: nextWidgets, slots: nextSlots } : { widgets, slots };
}

// -- 组件实例 slotContent 的 -------------------------------------------------

type ComponentWidget = Extract<PageWidget, { type: 'component' }>;
type SlotWidget = Extract<PageWidget, { type: 'slot' }>;

export type SlotContentLocation = {
  slotId: string;
  index: number;
  widgets: PageWidget[];
  widget: PageWidget;
};

/** 在组件实例的 slotContent 中按控件 id 查找。 */
export function findInSlotContent(component: ComponentWidget, widgetId: string): SlotContentLocation | null {
  const entries = Object.entries(component.slotContent ?? {});
  for (const [slotId, widgets] of entries) {
    const index = widgets.findIndex((item) => item.id === widgetId || containsWidget(item, widgetId));
    if (index >= 0) {
      return { slotId, index, widgets, widget: widgets[index] };
    }
  }
  return null;
}

function containsWidget(root: PageWidget, id: string): boolean {
  if (root.id === id) {
    return true;
  }
  return hasChildren(root) ? root.children.some((child) => containsWidget(child, id)) : false;
}

function mapContentGroups(
  component: ComponentWidget,
  mapper: (slotId: string, widgets: PageWidget[]) => PageWidget[],
): ComponentWidget {
  const current = component.slotContent ?? {};
  const next: Record<string, PageWidget[]> = {};
  for (const [slotId, widgets] of Object.entries(current)) {
    const mapped = mapper(slotId, widgets);
    if (mapped.length > 0) {
      next[slotId] = mapped;
    }
  }
  return { ...component, ...(Object.keys(next).length > 0 ? { slotContent: next } : {}) };
}

/** 向某个插槽追加（或在指定控件之后插入）控件。 */
export function insertSlotContentWidget(
  component: ComponentWidget,
  slotId: string,
  widget: PageWidget,
  afterId?: string | null,
): ComponentWidget {
  const current = component.slotContent ?? {};
  const group = [...(current[slotId] ?? [])];
  if (afterId) {
    const index = group.findIndex((item) => item.id === afterId);
    if (index >= 0) {
      group.splice(index + 1, 0, widget);
    } else {
      group.push(widget);
    }
  } else {
    group.push(widget);
  }
  return { ...component, slotContent: { ...current, [slotId]: group } };
}

/** 向某个插槽的指定下标插入控件。 */
export function insertSlotContentWidgetAt(
  component: ComponentWidget,
  slotId: string,
  widget: PageWidget,
  index: number,
): ComponentWidget {
  const current = component.slotContent ?? {};
  const group = [...(current[slotId] ?? [])];
  const bounded = Math.max(0, Math.min(index, group.length));
  group.splice(bounded, 0, widget);
  return { ...component, slotContent: { ...current, [slotId]: group } };
}

/** 删除插槽内容控件（及其子树）。 */
export function removeSlotContentWidget(component: ComponentWidget, widgetId: string): ComponentWidget | null {
  if (!findInSlotContent(component, widgetId)) {
    return null;
  }
  // 递归删除：目标可能嵌套在插槽内容的容器里（如 弹性布局 > 动态文本），
  // 只按顶层下标过滤会静默删不掉，画布与控件树都不会有变化。
  const prune = (list: PageWidget[]): PageWidget[] =>
    list
      .filter((widget) => widget.id !== widgetId)
      .map((widget) =>
        hasChildren(widget) && widget.children.some((child) => containsWidget(child, widgetId))
          ? ({ ...widget, children: prune(widget.children) } as PageWidget)
          : widget,
      );
  return mapContentGroups(component, (_slotId, widgets) => prune(widgets));
}

/** 更新插槽内容控件（含其子树内的控件）。 */
export function updateSlotContentWidget(
  component: ComponentWidget,
  widgetId: string,
  updater: (widget: PageWidget) => PageWidget,
): ComponentWidget | null {
  if (!findInSlotContent(component, widgetId)) {
    return null;
  }
  const apply = (list: PageWidget[]): PageWidget[] =>
    list.map((widget) => {
      if (widget.id === widgetId) {
        return updater(widget);
      }
      if (hasChildren(widget) && widget.children.some((child) => containsWidget(child, widgetId))) {
        return { ...widget, children: apply(widget.children) } as PageWidget;
      }
      return widget;
    });
  return mapContentGroups(component, (_slotId, widgets) => apply(widgets));
}

// -- 编辑组件时的虚拟控件树 ---------------------------------------------------

export type WidgetTreeNode = TreeDataNode & { isSlot?: boolean };

export const COMPONENT_INNER_SEPARATOR = '__';

export function virtualInnerId(componentId: string, innerWidgetId: string): string {
  return `${componentId}${COMPONENT_INNER_SEPARATOR}${innerWidgetId}`;
}

export function parseVirtualInnerId(componentId: string, key: string): string | null {
  const prefix = `${componentId}${COMPONENT_INNER_SEPARATOR}`;
  return key.startsWith(prefix) ? key.slice(prefix.length) : null;
}

function findTemplateNode(widgets: PageWidget[], innerId: string): PageWidget | null {
  for (const widget of widgets) {
    if (widget.id === innerId) {
      return widget;
    }
    if (hasChildren(widget)) {
      const nested = findTemplateNode(widget.children, innerId);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

function contentTreeData(
  widgets: PageWidget[],
  labelOf: (widget: PageWidget) => string,
): WidgetTreeNode[] {
  return widgets.map((widget) => ({
    key: widget.id,
    title: labelOf(widget),
    children: hasChildren(widget) ? contentTreeData(widget.children, labelOf) : undefined,
  }));
}

/**
 * 组件编辑态只直接展示模板里的插槽节点（拍平嵌套层级，隐藏弹性盒/图标/文本等内部结构），
 * 插槽节点下挂该实例 slotContent 的真实控件。插槽名称取插槽控件自身的 name，缺省时回退到声明 name。
 */
function virtualSlotsTreeData(
  template: PageWidget[],
  componentId: string,
  slotContent: Record<string, PageWidget[]>,
  slotNameMap: Map<string, string>,
  labelOf: (widget: PageWidget) => string,
  onlySlotWidgetId?: string,
): WidgetTreeNode[] {
  const slots = collectTemplateSlots(template).filter(
    (widget) => !onlySlotWidgetId || widget.id === onlySlotWidgetId,
  );
  return slots.map((widget) => {
    let title = labelOf(widget);
    if (!widget.name?.trim()) {
      const declarationName = slotNameMap.get(widget.slotId)?.trim();
      if (declarationName) {
        title = `${title} · ${declarationName}`;
      }
    }
    return {
      key: virtualInnerId(componentId, widget.id),
      title,
      selectable: true,
      isSlot: true,
      children: contentTreeData(slotContent[widget.slotId] ?? [], labelOf),
    };
  });
}

/**
 * 插槽使用编辑：控件树只剩被编辑插槽的虚拟节点及其内容（隔离页面其它控件）。
 */
export function componentSlotSubtree(
  componentId: string,
  template: PageWidget[],
  slotContent: Record<string, PageWidget[]>,
  slots: ComponentSlot[],
  labelOf: (widget: PageWidget) => string,
  slotWidgetId: string,
): WidgetTreeNode[] {
  const slotNameMap = new Map(slots.map((slot) => [slot.id, slot.name ?? '']));
  return virtualSlotsTreeData(
    template,
    componentId,
    slotContent,
    slotNameMap,
    labelOf,
    slotWidgetId,
  );
}

/**
 * 编辑组件实例时，把控件树中该组件节点的子节点替换为拍平的插槽虚拟节点，
 * 插槽节点下挂该实例 slotContent 的真实控件。
 */
export function withComponentVirtualTree(
  treeData: WidgetTreeNode[],
  componentId: string,
  template: PageWidget[],
  slotContent: Record<string, PageWidget[]>,
  slots: ComponentSlot[],
  labelOf: (widget: PageWidget) => string,
): WidgetTreeNode[] {
  const slotNameMap = new Map(slots.map((slot) => [slot.id, slot.name ?? '']));
  return treeData.map((node) => {
    if (node.key === componentId) {
      return {
        ...node,
        children: virtualSlotsTreeData(
          template,
          componentId,
          slotContent,
          slotNameMap,
          labelOf,
        ),
      };
    }
    if (node.children) {
      return {
        ...node,
        children: withComponentVirtualTree(
          node.children,
          componentId,
          template,
          slotContent,
          slots,
          labelOf,
        ),
      };
    }
    return node;
  });
}

export function findTemplateSlot(template: PageWidget[], innerId: string): SlotWidget | null {
  const node = findTemplateNode(template, innerId);
  return node && node.type === 'slot' ? node : null;
}
