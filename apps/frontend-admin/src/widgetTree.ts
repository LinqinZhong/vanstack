import type { TreeDataNode } from 'antd';
import type { FlexContainerStyle, FlexItemStyle, PageWidget, WidgetStyle } from '@vanstack/xml';

export type WidgetPatch = {
  value?: string;
  text?: string;
  style?: WidgetStyle | undefined;
  flex?: FlexContainerStyle | undefined;
  item?: FlexItemStyle | undefined;
};

export function findWidget(widgets: PageWidget[], id: string | null | undefined): PageWidget | null {
  if (!id) {
    return null;
  }
  for (const widget of widgets) {
    if (widget.id === id) {
      return widget;
    }
    if (widget.type === 'flex') {
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
    if (widget.type === 'flex') {
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

export function updateWidgetById(
  widgets: PageWidget[],
  id: string,
  patcher: (widget: PageWidget) => PageWidget,
): PageWidget[] {
  return widgets.map((widget) => {
    if (widget.id === id) {
      return patcher(widget);
    }
    if (widget.type === 'flex') {
      return { ...widget, children: updateWidgetById(widget.children, id, patcher) };
    }
    return widget;
  });
}

function applyCommon<T extends PageWidget>(widget: T, patch: WidgetPatch): T {
  const next = { ...widget };
  if ('style' in patch) {
    if (patch.style) {
      next.style = patch.style;
    } else {
      delete next.style;
    }
  }
  if ('item' in patch) {
    if (patch.item) {
      next.item = patch.item;
    } else {
      delete next.item;
    }
  }
  return next;
}

export function patchWidget(widget: PageWidget, patch: WidgetPatch): PageWidget {
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

export function addWidgetToTree(
  widgets: PageWidget[],
  selectedId: string | null,
  widget: PageWidget,
): PageWidget[] {
  const selected = findWidget(widgets, selectedId);
  if (selected?.type === 'flex') {
    return updateWidgetById(widgets, selected.id, (node) =>
      node.type === 'flex' ? { ...node, children: [...node.children, widget] } : node,
    );
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
    if (widget.type !== 'flex') {
      continue;
    }
    const nested = removeFromList(widget.children, id, widget.id);
    if (nested.found) {
      const nextList = [...list];
      nextList[i] = { ...widget, children: nested.widgets };
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
): { widgets: PageWidget[]; found: boolean } {
  const index = list.findIndex((item) => item.id === siblingId);
  if (index >= 0) {
    return {
      widgets: [...list.slice(0, index + 1), widget, ...list.slice(index + 1)],
      found: true,
    };
  }
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    if (item.type !== 'flex') {
      continue;
    }
    const nested = insertAfterSibling(item.children, siblingId, widget);
    if (nested.found) {
      const nextList = [...list];
      nextList[i] = { ...item, children: nested.widgets };
      return { widgets: nextList, found: true };
    }
  }
  return { widgets: list, found: false };
}

export function insertWidget(widgets: PageWidget[], selectedId: string | null, widget: PageWidget): PageWidget[] {
  const selected = findWidget(widgets, selectedId);
  if (selected?.type === 'flex') {
    return updateWidgetById(widgets, selected.id, (node) =>
      node.type === 'flex' ? { ...node, children: [...node.children, widget] } : node,
    );
  }
  if (selected) {
    return insertAfterSibling(widgets, selected.id, widget).widgets;
  }
  return [...widgets, widget];
}

let widgetIdSeq = 0;

export function nextWidgetId(): string {
  widgetIdSeq += 1;
  return `n${Date.now().toString(36)}-${widgetIdSeq}`;
}

function cloneOptional<T extends object>(value: T | undefined): T | undefined {
  return value ? { ...value } : undefined;
}

export function cloneWidget(widget: PageWidget, nextId: () => string = nextWidgetId): PageWidget {
  if (widget.type === 'text') {
    return {
      type: 'text',
      id: nextId(),
      value: widget.value,
      style: cloneOptional(widget.style),
      item: cloneOptional(widget.item),
    };
  }
  if (widget.type === 'button') {
    return {
      type: 'button',
      id: nextId(),
      text: widget.text,
      style: cloneOptional(widget.style),
      item: cloneOptional(widget.item),
    };
  }
  return {
    type: 'flex',
    id: nextId(),
    children: widget.children.map((child) => cloneWidget(child, nextId)),
    style: cloneOptional(widget.style),
    flex: cloneOptional(widget.flex),
    item: cloneOptional(widget.item),
  };
}

export function collectExpandableKeys(widgets: PageWidget[]): string[] {
  const keys: string[] = [];
  for (const widget of widgets) {
    if (widget.type === 'flex') {
      keys.push(widget.id);
      keys.push(...collectExpandableKeys(widget.children));
    }
  }
  return keys;
}

export function toWidgetTreeData(
  widgets: PageWidget[],
  labelOf: (widget: PageWidget) => string,
): TreeDataNode[] {
  return widgets.map((widget) => ({
    key: widget.id,
    title: labelOf(widget),
    children: widget.type === 'flex' ? toWidgetTreeData(widget.children, labelOf) : undefined,
  }));
}
