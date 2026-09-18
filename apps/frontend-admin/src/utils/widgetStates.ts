import {
  appliedStateName,
  diffWidgetState,
  findOwnedDelta,
  hasOwnedStates,
  nestedAppliedStateName,
  ownedStateNames,
  resolveWidgetState,
  resolveWidgetStateStack,
  type PageWidget,
  type WidgetStateDelta,
  type WidgetStateFields,
  type WidgetStateLayer,
  type WidgetStateRole,
  type WidgetStyle,
} from '@vanstack/xml';
import { findParentWidget, findWidget, hasChildren, patchWidget, updateWidgetById, type WidgetPatch } from './widgetTree';

export type VisibleWidgetState = {
  name: string | null;
  owned: boolean;
  ownerId: string;
  transition?: number;
  scopeName?: string | null;
  scopeOwnerId?: string | null;
  children?: VisibleWidgetState[];
};

function flattenStateTree(nodes: VisibleWidgetState[]): VisibleWidgetState[] {
  return nodes.flatMap((node) => [node, ...flattenStateTree(node.children ?? [])]);
}

function ancestorOwnedNamed(widget: PageWidget): Array<{ name: string; transition?: number }> {
  const rows: Array<{ name: string; transition?: number }> = [];
  const seen = new Set<string>();
  for (const state of widget.states ?? []) {
    if (seen.has(state.name)) {
      continue;
    }
    seen.add(state.name);
    rows.push({ name: state.name, transition: state.transition });
  }
  for (const override of widget.stateOverrides ?? []) {
    for (const state of override.states ?? []) {
      if (seen.has(state.name)) {
        continue;
      }
      seen.add(state.name);
      rows.push({ name: state.name, transition: state.transition });
    }
  }
  return rows;
}

export function collectStateTree(
  widgets: PageWidget[],
  id: string | null | undefined,
): VisibleWidgetState[] {
  const selected = findWidget(widgets, id);
  if (!selected) {
    return [];
  }
  const chain: PageWidget[] = [];
  let current: PageWidget | null = selected;
  while (current) {
    chain.unshift(current);
    current = findParentWidget(widgets, current.id);
  }
  const used = new Set((selected.states ?? []).map((state) => state.name));
  const owned: VisibleWidgetState[] = [
    { name: null, owned: true, ownerId: selected.id, transition: selected.transition },
    ...(selected.states ?? []).map((state) => ({
      name: state.name,
      owned: true,
      ownerId: selected.id,
      transition: state.transition,
    })),
  ];
  const inherited: VisibleWidgetState[] = [];
  for (const widget of chain) {
    if (widget.id === selected.id) {
      continue;
    }
    for (const state of ancestorOwnedNamed(widget)) {
      const override = selected.stateOverrides?.find((item) => item.name === state.name);
      inherited.push({
        name: state.name,
        owned: false,
        ownerId: widget.id,
        transition: state.transition,
        children: [
          {
            name: null,
            owned: true,
            ownerId: selected.id,
            scopeName: state.name,
            scopeOwnerId: widget.id,
          },
          ...(override?.states ?? [])
            .filter((nested) => {
              if (used.has(nested.name)) {
                return false;
              }
              used.add(nested.name);
              return true;
            })
            .map((nested) => ({
              name: nested.name,
              owned: true,
              ownerId: selected.id,
              transition: nested.transition,
              scopeName: state.name,
              scopeOwnerId: widget.id,
            })),
        ],
      });
    }
  }
  return [...owned, ...inherited];
}

export function collectVisibleStates(
  widgets: PageWidget[],
  id: string | null | undefined,
): VisibleWidgetState[] {
  return flattenStateTree(collectStateTree(widgets, id));
}

export type ViewingByOwner = Record<string, string | null>;

export function viewingListFromMap(map: ViewingByOwner): Array<{ ownerId: string; state: string | null }> {
  return Object.entries(map).map(([ownerId, state]) => ({ ownerId, state }));
}

export function pruneViewingByOwner(map: ViewingByOwner, widgets: PageWidget[]): ViewingByOwner {
  const next: ViewingByOwner = {};
  for (const [id, state] of Object.entries(map)) {
    if (findWidget(widgets, id)) {
      next[id] = state;
    }
  }
  return next;
}

export function ownerActiveName(widget: PageWidget, viewing: ViewingByOwner): string | null {
  if (Object.prototype.hasOwnProperty.call(viewing, widget.id)) {
    return viewing[widget.id];
  }
  return appliedStateName(widget);
}

function ancestorChain(widgets: PageWidget[], id: string): PageWidget[] {
  const chain: PageWidget[] = [];
  let current = findWidget(widgets, id);
  while (current) {
    chain.unshift(current);
    current = findParentWidget(widgets, current.id);
  }
  return chain;
}

function layerRoleFor(widget: PageWidget, name: string): WidgetStateRole {
  return findOwnedDelta(widget, name) ? 'owner' : 'descendant';
}

function nestedOwnerScope(widget: PageWidget, name: string): string | null {
  if (widget.states?.some((item) => item.name === name)) {
    return null;
  }
  for (const override of widget.stateOverrides ?? []) {
    if (override.states?.some((item) => item.name === name)) {
      return override.name;
    }
  }
  return null;
}

export function stateLayersForWidget(
  widgets: PageWidget[],
  widgetId: string,
  viewing: ViewingByOwner,
): WidgetStateLayer[] {
  const selected = findWidget(widgets, widgetId);
  if (!selected) {
    return [];
  }
  const layers: WidgetStateLayer[] = [];
  const skipNested =
    Object.prototype.hasOwnProperty.call(viewing, selected.id) && viewing[selected.id] == null;
  for (const widget of ancestorChain(widgets, widgetId)) {
    const name = ownerActiveName(widget, viewing);
    if (!name) {
      continue;
    }
    const role = layerRoleFor(selected, name);
    layers.push({ name, role });
    if (widget.id === selected.id || role !== 'descendant' || skipNested) {
      continue;
    }
    const nested = nestedAppliedStateName(selected.stateOverrides?.find((item) => item.name === name));
    if (nested) {
      layers.push({ name: nested, role: 'owner' });
    }
  }
  return layers;
}

export type AppliedGroupState = {
  ownerId: string;
  name: string | null;
  scopeName?: string | null;
  scopeOwnerId?: string | null;
};

export function collectGroupDefaults(
  widgets: PageWidget[],
  id: string | null | undefined,
): AppliedGroupState[] {
  const selected = findWidget(widgets, id);
  if (!selected) {
    return [];
  }
  const rows: AppliedGroupState[] = [{ ownerId: selected.id, name: appliedStateName(selected) }];
  for (const node of collectStateTree(widgets, id)) {
    if (!node.children?.length || !node.name) {
      continue;
    }
    rows.push({
      ownerId: selected.id,
      name: nestedAppliedStateName(selected.stateOverrides?.find((item) => item.name === node.name)),
      scopeName: node.name,
      scopeOwnerId: node.ownerId,
    });
  }
  return rows;
}

export function viewingAfterSelect(
  widgets: PageWidget[],
  selectedId: string,
  viewing: ViewingByOwner,
  sticky: { ownerId: string | null; name: string | null },
): { ownerId: string; name: string | null; viewing: ViewingByOwner } {
  const selected = findWidget(widgets, selectedId);
  if (!selected) {
    return { ownerId: selectedId, name: null, viewing };
  }
  const visible = collectVisibleStates(widgets, selectedId);
  const ownApplied = hasOwnedStates(selected) ? appliedStateName(selected) : null;
  if (ownApplied) {
    return {
      ownerId: selected.id,
      name: ownApplied,
      viewing: { ...viewing, [selected.id]: ownApplied },
    };
  }
  if (sticky.name != null) {
    const row = visible.find((item) => item.ownerId === sticky.ownerId && item.name === sticky.name) ?? visible.find((item) => item.name === sticky.name);
    if (row) {
      return { ownerId: row.ownerId, name: row.name, viewing };
    }
  }
  if (Object.prototype.hasOwnProperty.call(viewing, selected.id)) {
    const name = viewing[selected.id];
    if (name == null || visible.some((item) => item.ownerId === selected.id && item.name === name)) {
      return { ownerId: selected.id, name, viewing };
    }
  }
  for (const widget of ancestorChain(widgets, selected.id).reverse()) {
    if (widget.id === selected.id) {
      continue;
    }
    const name = ownerActiveName(widget, viewing);
    if (name && visible.some((item) => item.name === name && item.ownerId === widget.id)) {
      return { ownerId: widget.id, name, viewing };
    }
  }
  return { ownerId: selected.id, name: null, viewing };
}

export function isUnderWidget(widgets: PageWidget[], ancestorId: string, id: string): boolean {
  if (ancestorId === id) {
    return true;
  }
  let current = findParentWidget(widgets, id);
  while (current) {
    if (current.id === ancestorId) {
      return true;
    }
    current = findParentWidget(widgets, current.id);
  }
  return false;
}

export function stateRole(owner: PageWidget | null, widget: PageWidget): WidgetStateRole {
  return owner && owner.id === widget.id ? 'owner' : 'descendant';
}

export function widgetWithStateLayers(widget: PageWidget, layers: WidgetStateLayer[]): PageWidget {
  const fields = resolveWidgetStateStack(widget, layers);
  const next = { ...widget } as PageWidget;
  if (fields.style) {
    next.style = fields.style;
  } else {
    delete next.style;
  }
  if (next.type === 'flex') {
    if (fields.flex) {
      next.flex = fields.flex;
    } else {
      delete next.flex;
    }
  }
  if (next.type !== 'swiper-item') {
    if (fields.item) {
      next.item = fields.item;
    } else {
      delete next.item;
    }
  }
  if (next.type === 'swiper') {
    if (fields.swiper) {
      next.swiper = fields.swiper;
    } else {
      delete next.swiper;
    }
  }
  return next;
}

export function widgetWithViewing(
  widget: PageWidget,
  owner: PageWidget | null,
  viewingState: string | null,
): PageWidget {
  return widgetWithStateLayers(
    widget,
    viewingState ? [{ name: viewingState, role: stateRole(owner, widget) }] : [],
  );
}

export function nextCopiedStateName(existing: Iterable<string>, source: string | null): string {
  const names = new Set(existing);
  if (!source) {
    if (!names.has('state')) {
      return 'state';
    }
    let n = 2;
    while (names.has(`state${n}`)) {
      n += 1;
    }
    return `state${n}`;
  }
  let n = 2;
  while (names.has(`${source}${n}`)) {
    n += 1;
  }
  return `${source}${n}`;
}

function cloneDelta(delta: WidgetStateDelta): WidgetStateDelta {
  return {
    name: delta.name,
    ...(delta.transition != null ? { transition: delta.transition } : {}),
    ...(delta.appliedState ? { appliedState: delta.appliedState } : {}),
    ...(delta.style ? { style: { ...delta.style } } : {}),
    ...(delta.flex ? { flex: { ...delta.flex } } : {}),
    ...(delta.item ? { item: { ...delta.item } } : {}),
    ...(delta.swiper ? { swiper: { ...delta.swiper } } : {}),
    ...(delta.states?.length ? { states: delta.states.map((item) => cloneDelta(item)) } : {}),
  };
}

function sourceDeltaOnWidget(
  widget: PageWidget,
  sourceName: string | null,
  sourceOwned: boolean,
): WidgetStateDelta {
  if (!sourceName) {
    return { name: '' };
  }
  if (sourceOwned) {
    const owned = widget.states?.find((item) => item.name === sourceName);
    return owned ? cloneDelta(owned) : { name: sourceName };
  }
  const override = widget.stateOverrides?.find((item) => item.name === sourceName);
  return override ? cloneDelta(override) : { name: sourceName };
}

function mapOverrideDeep(
  widget: PageWidget,
  mapList: (list: WidgetStateDelta[]) => WidgetStateDelta[],
): PageWidget {
  let next = widget;
  if (widget.stateOverrides?.length) {
    const nextList = mapList(widget.stateOverrides);
    next = { ...widget };
    if (nextList.length > 0) {
      next.stateOverrides = nextList;
    } else {
      delete next.stateOverrides;
    }
  }
  if (hasChildren(next)) {
    next = { ...next, children: next.children.map((child) => mapOverrideDeep(child, mapList)) };
  }
  return next;
}

function copyOverrideDeep(widget: PageWidget, from: string, to: string): PageWidget {
  return mapOverrideDeep(widget, (list) => {
    const match = list.find((item) => item.name === from);
    if (!match || list.some((item) => item.name === to)) {
      return list;
    }
    return [...list, { ...cloneDelta(match), name: to }];
  });
}

function renameOverrideDeep(widget: PageWidget, from: string, to: string): PageWidget {
  return mapOverrideDeep(widget, (list) => {
    const next = list.map((item) => (item.name === from ? { ...item, name: to } : item));
    const seen = new Set<string>();
    return next.filter((item) => {
      if (seen.has(item.name)) {
        return false;
      }
      seen.add(item.name);
      return true;
    });
  });
}

function deleteOverrideDeep(widget: PageWidget, name: string): PageWidget {
  return mapOverrideDeep(widget, (list) => list.filter((item) => item.name !== name));
}

export function createWidgetState(
  widgets: PageWidget[],
  ownerId: string,
  newName: string,
  sourceName: string | null,
  sourceOwned = true,
  transition?: number,
  scopeName?: string | null,
): PageWidget[] {
  const owner = findWidget(widgets, ownerId);
  const name = newName.trim();
  if (!owner || !name || ownedStateNames(owner).includes(name)) {
    return widgets;
  }
  if (scopeName) {
    const added: WidgetStateDelta = { name };
    if (transition != null && Number.isFinite(transition) && transition > 0) {
      added.transition = Math.round(transition);
    }
    return updateWidgetById(widgets, ownerId, (widget) => upsertNestedState(widget, scopeName, name, () => added));
  }
  const added: WidgetStateDelta = { ...sourceDeltaOnWidget(owner, sourceName, sourceOwned), name };
  if (transition != null && Number.isFinite(transition) && transition > 0) {
    added.transition = Math.round(transition);
  } else {
    delete added.transition;
  }
  return updateWidgetById(widgets, ownerId, (widget) => {
    const withState: PageWidget = { ...widget, states: [...(widget.states ?? []), added] };
    if (!sourceName || !hasChildren(withState)) {
      return withState;
    }
    return {
      ...withState,
      children: withState.children.map((child) => copyOverrideDeep(child, sourceName, name)),
    };
  });
}

function writeOverrideList(widget: PageWidget, list: WidgetStateDelta[]): PageWidget {
  const next = { ...widget };
  if (list.length > 0) {
    next.stateOverrides = list;
  } else {
    delete next.stateOverrides;
  }
  return next;
}

function upsertNestedState(
  widget: PageWidget,
  scopeName: string,
  name: string,
  mutate: (current: WidgetStateDelta | undefined) => WidgetStateDelta | undefined,
): PageWidget {
  const overrides = [...(widget.stateOverrides ?? [])];
  const index = overrides.findIndex((item) => item.name === scopeName);
  const parent: WidgetStateDelta = index >= 0 ? { ...overrides[index] } : { name: scopeName };
  const states = [...(parent.states ?? [])];
  const nestedIndex = states.findIndex((item) => item.name === name);
  const nextNested = mutate(nestedIndex >= 0 ? states[nestedIndex] : undefined);
  if (nextNested) {
    if (nestedIndex >= 0) {
      states[nestedIndex] = nextNested;
    } else {
      states.push(nextNested);
    }
  } else if (nestedIndex >= 0) {
    states.splice(nestedIndex, 1);
  } else {
    return widget;
  }
  const nextParent: WidgetStateDelta = { ...parent };
  if (states.length > 0) {
    nextParent.states = states;
  } else {
    delete nextParent.states;
  }
  if (nextParent.appliedState === name && !states.some((item) => item.name === nextParent.appliedState)) {
    delete nextParent.appliedState;
  }
  const empty =
    !nextParent.style &&
    !nextParent.flex &&
    !nextParent.item &&
    !nextParent.swiper &&
    !nextParent.states?.length &&
    !nextParent.appliedState;
  if (empty) {
    if (index < 0) {
      return widget;
    }
    return writeOverrideList(
      widget,
      overrides.filter((_, i) => i !== index),
    );
  }
  if (index >= 0) {
    overrides[index] = nextParent;
  } else {
    overrides.push(nextParent);
  }
  return writeOverrideList(widget, overrides);
}

export function updateHostTransition(widgets: PageWidget[], ownerId: string, transition?: number): PageWidget[] {
  return updateWidgetById(widgets, ownerId, (widget) => {
    const next = { ...widget };
    if (transition != null && Number.isFinite(transition) && transition > 0) {
      next.transition = Math.round(transition);
    } else {
      delete next.transition;
    }
    return next;
  });
}

function applyTransition(delta: WidgetStateDelta, transition?: number): WidgetStateDelta {
  const next = { ...delta };
  if (transition != null && Number.isFinite(transition) && transition > 0) {
    next.transition = Math.round(transition);
  } else {
    delete next.transition;
  }
  return next;
}

export function updateWidgetState(
  widgets: PageWidget[],
  ownerId: string,
  from: string,
  nextName: string,
  transition?: number,
  scopeName?: string | null,
): PageWidget[] {
  const owner = findWidget(widgets, ownerId);
  const name = nextName.trim();
  if (!owner || !from || !name) {
    return widgets;
  }
  if (name !== from && ownedStateNames(owner).includes(name)) {
    return widgets;
  }
  if (scopeName) {
    return updateWidgetById(widgets, ownerId, (widget) => {
      const next = upsertNestedState(widget, scopeName, from, (current) => {
        if (!current) {
          return current;
        }
        return applyTransition({ ...current, name }, transition);
      });
      const overrides = (next.stateOverrides ?? []).map((item) => {
        if (item.name !== scopeName || item.appliedState !== from) {
          return item;
        }
        return { ...item, appliedState: name };
      });
      const renamed: PageWidget = overrides.length ? { ...next, stateOverrides: overrides } : next;
      if (name === from || !hasChildren(renamed)) {
        return renamed;
      }
      return {
        ...renamed,
        children: renamed.children.map((child) => renameOverrideDeep(child, from, name)),
      };
    });
  }
  return updateWidgetById(widgets, ownerId, (widget) => {
    if (!widget.states?.some((item) => item.name === from)) {
      return widget;
    }
    const next: PageWidget = {
      ...widget,
      states: widget.states.map((item) => (item.name === from ? applyTransition({ ...item, name }, transition) : item)),
    };
    if (next.appliedState === from) {
      next.appliedState = name;
    }
    if (name === from || !hasChildren(next)) {
      return next;
    }
    return {
      ...next,
      children: next.children.map((child) => renameOverrideDeep(child, from, name)),
    };
  });
}

export function deleteWidgetState(
  widgets: PageWidget[],
  ownerId: string,
  name: string,
  scopeName?: string | null,
): PageWidget[] {
  const owner = findWidget(widgets, ownerId);
  if (!owner || !name) {
    return widgets;
  }
  if (scopeName) {
    if (!owner.stateOverrides?.some((item) => item.name === scopeName && item.states?.some((nested) => nested.name === name))) {
      return widgets;
    }
    return updateWidgetById(widgets, ownerId, (widget) => {
      const next = upsertNestedState(widget, scopeName, name, () => undefined);
      if (next.appliedState === name) {
        delete next.appliedState;
      }
      if (!hasChildren(next)) {
        return next;
      }
      return {
        ...next,
        children: next.children.map((child) => deleteOverrideDeep(child, name)),
      };
    });
  }
  if (!owner.states?.some((item) => item.name === name)) {
    return widgets;
  }
  return updateWidgetById(widgets, ownerId, (widget) => {
    const states = (widget.states ?? []).filter((item) => item.name !== name);
    const next: PageWidget = { ...widget };
    if (states.length > 0) {
      next.states = states;
    } else {
      delete next.states;
    }
    if (next.appliedState === name || !next.states?.length) {
      delete next.appliedState;
    }
    if (!hasChildren(next)) {
      return next;
    }
    return {
      ...next,
      children: next.children.map((child) => deleteOverrideDeep(child, name)),
    };
  });
}

export function setAppliedState(
  widgets: PageWidget[],
  ownerId: string,
  name: string | null,
  scopeName?: string | null,
): PageWidget[] {
  return updateWidgetById(widgets, ownerId, (widget) => {
    if (scopeName) {
      const overrides = [...(widget.stateOverrides ?? [])];
      const index = overrides.findIndex((item) => item.name === scopeName);
      if (index < 0) {
        if (!name) {
          return widget;
        }
        return widget;
      }
      const parent: WidgetStateDelta = { ...overrides[index] };
      if (name && parent.states?.some((item) => item.name === name)) {
        parent.appliedState = name;
      } else {
        delete parent.appliedState;
      }
      const empty =
        !parent.style && !parent.flex && !parent.item && !parent.swiper && !parent.states?.length && !parent.appliedState;
      if (empty) {
        return writeOverrideList(
          widget,
          overrides.filter((_, i) => i !== index),
        );
      }
      overrides[index] = parent;
      return writeOverrideList(widget, overrides);
    }
    const next = { ...widget };
    if (name && widget.states?.some((item) => item.name === name)) {
      next.appliedState = name;
    } else {
      delete next.appliedState;
    }
    return next;
  });
}

function writeDelta(
  widget: PageWidget,
  name: string,
  role: WidgetStateRole,
  delta: WidgetStateFields,
  nestedIn?: string | null,
): PageWidget {
  if (role === 'owner' && nestedIn) {
    return upsertNestedState(widget, nestedIn, name, (current) => ({
      name,
      ...delta,
      ...(current?.transition != null ? { transition: current.transition } : {}),
      ...(current?.states?.length ? { states: current.states } : {}),
    }));
  }
  const key = role === 'owner' ? 'states' : 'stateOverrides';
  const list = [...(widget[key] ?? [])];
  const index = list.findIndex((item) => item.name === name);
  const prev = index >= 0 ? list[index] : undefined;
  const empty = !delta.style && !delta.flex && !delta.item && !delta.swiper;
  if (role === 'descendant' && empty && !prev?.states?.length && !prev?.appliedState) {
    if (index < 0) {
      return widget;
    }
    const nextList = list.filter((_, i) => i !== index);
    const next = { ...widget };
    if (nextList.length > 0) {
      next[key] = nextList;
    } else {
      delete next[key];
    }
    return next;
  }
  const entry: WidgetStateDelta = {
    name,
    ...delta,
    ...(role === 'owner' && prev?.transition != null ? { transition: prev.transition } : {}),
    ...(prev?.states?.length ? { states: prev.states } : {}),
    ...(role === 'descendant' && prev?.appliedState ? { appliedState: prev.appliedState } : {}),
  };
  if (index >= 0) {
    list[index] = entry;
  } else {
    list.push(entry);
  }
  return { ...widget, [key]: list };
}

export function nestedScopeForWidget(
  widgets: PageWidget[],
  widgetId: string,
  viewing: ViewingByOwner,
  viewingOwnerId: string | null,
  viewingState: string | null,
): string | null {
  const widget = findWidget(widgets, widgetId);
  if (!widget || !viewingState || viewingOwnerId !== widget.id) {
    return null;
  }
  if (widget.states?.some((item) => item.name === viewingState)) {
    return null;
  }
  for (const ancestor of ancestorChain(widgets, widgetId).reverse()) {
    if (ancestor.id === widget.id) {
      continue;
    }
    const name = ownerActiveName(ancestor, viewing);
    if (
      name &&
      widget.stateOverrides?.some((item) => item.name === name && item.states?.some((nested) => nested.name === viewingState))
    ) {
      return name;
    }
  }
  return null;
}

export function patchResolvedWidget(
  widget: PageWidget,
  patch: WidgetPatch,
  layers: WidgetStateLayer[],
): PageWidget {
  const content: WidgetPatch = {};
  if (patch.value != null) {
    content.value = patch.value;
  }
  if (patch.text != null) {
    content.text = patch.text;
  }
  let next = Object.keys(content).length > 0 ? patchWidget(widget, content) : widget;
  const hasVisual = 'style' in patch || 'flex' in patch || 'item' in patch || 'swiper' in patch;
  if (!hasVisual) {
    return next;
  }
  const resolved = resolveWidgetStateStack(next, layers);
  const desired: WidgetStateFields = {
    style: 'style' in patch ? patch.style : resolved.style,
    flex: 'flex' in patch ? patch.flex : resolved.flex,
    item: 'item' in patch ? patch.item : resolved.item,
    swiper: 'swiper' in patch ? patch.swiper : resolved.swiper,
  };
  const visual: WidgetPatch = {
    ...('style' in patch ? { style: desired.style } : {}),
    ...('flex' in patch ? { flex: desired.flex } : {}),
    ...('item' in patch ? { item: desired.item } : {}),
    ...('swiper' in patch ? { swiper: desired.swiper } : {}),
  };
  const layered =
    layers.length === 0
      ? patchWidget(next, visual)
      : writeDelta(
          next,
          layers[layers.length - 1].name,
          layers[layers.length - 1].role,
          diffWidgetState(next, desired, resolveWidgetStateStack(next, layers.slice(0, -1))),
          layers[layers.length - 1].role === 'owner'
            ? nestedOwnerScope(next, layers[layers.length - 1].name)
            : null,
        );
  if (!('style' in patch)) {
    return layered;
  }
  return forcePositionFields(layered, desired.style);
}

const POSITION_STYLE_KEYS = ['position', 'zIndex', 'top', 'right', 'bottom', 'left'] as const;

function stripPositionStyle(style: WidgetStyle | undefined): WidgetStyle | undefined {
  if (!style) {
    return undefined;
  }
  const next: WidgetStyle = { ...style };
  for (const key of POSITION_STYLE_KEYS) {
    delete next[key];
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function stripPositionDeltas(list: WidgetStateDelta[] | undefined): WidgetStateDelta[] | undefined {
  if (!list) {
    return list;
  }
  return list.map((item) => {
    const style = stripPositionStyle(item.style);
    const states = stripPositionDeltas(item.states);
    const next: WidgetStateDelta = { ...item };
    if (style) {
      next.style = style;
    } else {
      delete next.style;
    }
    if (states && states.length > 0) {
      next.states = states;
    } else {
      delete next.states;
    }
    return next;
  });
}

function forcePositionFields(widget: PageWidget, style: WidgetStyle | undefined): PageWidget {
  const host: WidgetStyle = { ...(widget.style ?? {}) };
  for (const key of POSITION_STYLE_KEYS) {
    if (style && style[key] != null) {
      (host as Record<string, unknown>)[key] = style[key];
    } else {
      delete host[key];
    }
  }
  const next = patchWidget(widget, { style: Object.keys(host).length > 0 ? host : undefined });
  if (next.states) {
    next.states = stripPositionDeltas(next.states);
  }
  if (next.stateOverrides) {
    next.stateOverrides = stripPositionDeltas(next.stateOverrides);
  }
  return next;
}

export function patchWidgetInState(
  widget: PageWidget,
  patch: WidgetPatch,
  stateName: string | null,
  role: WidgetStateRole,
  nestedIn?: string | null,
): PageWidget {
  const content: WidgetPatch = {};
  if (patch.value != null) {
    content.value = patch.value;
  }
  if (patch.text != null) {
    content.text = patch.text;
  }
  let next = Object.keys(content).length > 0 ? patchWidget(widget, content) : widget;
  const hasVisual = 'style' in patch || 'flex' in patch || 'item' in patch || 'swiper' in patch;
  if (!hasVisual) {
    return next;
  }
  if (!stateName) {
    return patchWidget(next, {
      ...('style' in patch ? { style: patch.style } : {}),
      ...('flex' in patch ? { flex: patch.flex } : {}),
      ...('item' in patch ? { item: patch.item } : {}),
      ...('swiper' in patch ? { swiper: patch.swiper } : {}),
    });
  }
  if (nestedIn) {
    const resolved = resolveWidgetStateStack(next, [
      { name: nestedIn, role: 'descendant' },
      { name: stateName, role: 'owner' },
    ]);
    const merged: WidgetStateFields = {
      style: 'style' in patch ? patch.style : resolved.style,
      flex: 'flex' in patch ? patch.flex : resolved.flex,
      item: 'item' in patch ? patch.item : resolved.item,
      swiper: 'swiper' in patch ? patch.swiper : resolved.swiper,
    };
    const parent = resolveWidgetState(next, nestedIn, 'descendant');
    return writeDelta(next, stateName, 'owner', diffWidgetState(next, merged, parent), nestedIn);
  }
  const resolved = resolveWidgetState(next, stateName, role);
  const merged: WidgetStateFields = {
    style: 'style' in patch ? patch.style : resolved.style,
    flex: 'flex' in patch ? patch.flex : resolved.flex,
    item: 'item' in patch ? patch.item : resolved.item,
    swiper: 'swiper' in patch ? patch.swiper : resolved.swiper,
  };
  return writeDelta(next, stateName, role, diffWidgetState(next, merged));
}

export { appliedStateName };
