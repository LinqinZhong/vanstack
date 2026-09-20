import {
  diffWidgetState,
  findOwnedDelta,
  ownedStateIds,
  resolveWidgetStateStack,
  compactWidgetProps,
  type PageWidget,
  type WidgetContentProps,
  type WidgetStateDelta,
  type WidgetStateFields,
  type WidgetStateLayer,
  type WidgetStateRole,
  type WidgetStyle,
} from '@vanstack/xml';
import { findParentWidget, findWidget, hasChildren, nextStateId, patchWidget, updateWidgetById, type WidgetPatch } from './widgetTree';

export { nextStateId };

export type VisibleWidgetState = {
  id: string | null;
  name: string | null;
  owned: boolean;
  ownerId: string;
  transition?: number;
  scopeId?: string | null;
  scopeOwnerId?: string | null;
  children?: VisibleWidgetState[];
};

function flattenStateTree(nodes: VisibleWidgetState[]): VisibleWidgetState[] {
  return nodes.flatMap((node) => [node, ...flattenStateTree(node.children ?? [])]);
}

function ancestorOwnedStates(widget: PageWidget): Array<{ id: string; name: string; transition?: number }> {
  const rows: Array<{ id: string; name: string; transition?: number }> = [];
  const seen = new Set<string>();
  for (const state of widget.states ?? []) {
    if (seen.has(state.id)) {
      continue;
    }
    seen.add(state.id);
    rows.push({ id: state.id, name: state.name ?? state.id, transition: state.transition });
  }
  for (const override of widget.stateOverrides ?? []) {
    for (const state of override.states ?? []) {
      if (seen.has(state.id)) {
        continue;
      }
      seen.add(state.id);
      rows.push({ id: state.id, name: state.name ?? state.id, transition: state.transition });
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
  const used = new Set((selected.states ?? []).map((state) => state.id));
  const owned: VisibleWidgetState[] = [
    { id: null, name: null, owned: true, ownerId: selected.id, transition: selected.transition },
    ...(selected.states ?? []).map((state) => ({
      id: state.id,
      name: state.name ?? state.id,
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
    for (const state of ancestorOwnedStates(widget)) {
      const override = selected.stateOverrides?.find((item) => item.id === state.id);
      inherited.push({
        id: state.id,
        name: state.name,
        owned: false,
        ownerId: widget.id,
        transition: state.transition,
        children: [
          {
            id: null,
            name: null,
            owned: true,
            ownerId: selected.id,
            scopeId: state.id,
            scopeOwnerId: widget.id,
          },
          ...(override?.states ?? [])
            .filter((nested) => {
              if (used.has(nested.id)) {
                return false;
              }
              used.add(nested.id);
              return true;
            })
            .map((nested) => ({
              id: nested.id,
              name: nested.name ?? nested.id,
              owned: true,
              ownerId: selected.id,
              transition: nested.transition,
              scopeId: state.id,
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

export function ownerActiveId(widget: PageWidget, viewing: ViewingByOwner): string | null {
  if (Object.prototype.hasOwnProperty.call(viewing, widget.id)) {
    return viewing[widget.id];
  }
  return null;
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

function layerRoleFor(widget: PageWidget, id: string): WidgetStateRole {
  return findOwnedDelta(widget, id) ? 'owner' : 'descendant';
}

function nestedOwnerScope(widget: PageWidget, id: string): string | null {
  if (widget.states?.some((item) => item.id === id)) {
    return null;
  }
  for (const override of widget.stateOverrides ?? []) {
    if (override.states?.some((item) => item.id === id)) {
      return override.id;
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
  for (const widget of ancestorChain(widgets, widgetId)) {
    const stateId = ownerActiveId(widget, viewing);
    if (!stateId) {
      continue;
    }
    const role = layerRoleFor(selected, stateId);
    layers.push({ id: stateId, role });
  }
  return layers;
}

export function viewingAfterSelect(
  widgets: PageWidget[],
  selectedId: string,
  viewing: ViewingByOwner,
  sticky: { ownerId: string | null; id: string | null },
): { ownerId: string; id: string | null; viewing: ViewingByOwner } {
  const selected = findWidget(widgets, selectedId);
  if (!selected) {
    return { ownerId: selectedId, id: null, viewing };
  }
  const visible = collectVisibleStates(widgets, selectedId);
  if (sticky.id != null) {
    const row = visible.find((item) => item.ownerId === sticky.ownerId && item.id === sticky.id) ?? visible.find((item) => item.id === sticky.id);
    if (row) {
      return { ownerId: row.ownerId, id: row.id, viewing };
    }
  }
  if (Object.prototype.hasOwnProperty.call(viewing, selected.id)) {
    const stateId = viewing[selected.id];
    if (stateId == null || visible.some((item) => item.ownerId === selected.id && item.id === stateId)) {
      return { ownerId: selected.id, id: stateId, viewing };
    }
  }
  for (const widget of ancestorChain(widgets, selected.id).reverse()) {
    if (widget.id === selected.id) {
      continue;
    }
    const stateId = ownerActiveId(widget, viewing);
    if (stateId && visible.some((item) => item.id === stateId && item.ownerId === widget.id)) {
      return { ownerId: widget.id, id: stateId, viewing };
    }
  }
  return { ownerId: selected.id, id: null, viewing };
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

function applyPropsToWidget(widget: PageWidget, props: WidgetContentProps | undefined): PageWidget {
  if (!props) {
    return widget;
  }
  if (widget.type === 'text') {
    return props.value != null ? { ...widget, value: props.value } : widget;
  }
  if (widget.type === 'button') {
    return props.text != null ? { ...widget, text: props.text } : widget;
  }
  if (widget.type === 'image') {
    return props.src != null ? { ...widget, src: props.src } : widget;
  }
  if (widget.type === 'icon') {
    let next = widget;
    if (props.src != null) {
      next = { ...next, src: props.src };
    }
    if (props.size != null) {
      next = { ...next, size: props.size };
    }
    return next;
  }
  return widget;
}

export function widgetWithStateLayers(widget: PageWidget, layers: WidgetStateLayer[]): PageWidget {
  const fields = resolveWidgetStateStack(widget, layers);
  const next = { ...applyPropsToWidget(widget, fields.props) } as PageWidget;
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
    viewingState ? [{ id: viewingState, role: stateRole(owner, widget) }] : [],
  );
}

export function widgetWithStateLayerDelta(widget: PageWidget, layers: WidgetStateLayer[]): PageWidget {
  if (layers.length === 0) {
    return widget;
  }
  const base = resolveWidgetStateStack(widget, layers.slice(0, -1));
  const full = resolveWidgetStateStack(widget, layers);
  const delta = diffWidgetState(widget, full, base);
  const next = { ...applyPropsToWidget(widget, delta.props) } as PageWidget;
  if (delta.style) {
    next.style = delta.style;
  } else {
    delete next.style;
  }
  if (next.type === 'flex') {
    if (delta.flex) {
      next.flex = delta.flex;
    } else {
      delete next.flex;
    }
  }
  if (next.type !== 'swiper-item') {
    if (delta.item) {
      next.item = delta.item;
    } else {
      delete next.item;
    }
  }
  if (next.type === 'swiper') {
    if (delta.swiper) {
      next.swiper = delta.swiper;
    } else {
      delete next.swiper;
    }
  }
  return next;
}

export function stateOwnKeys(widget: PageWidget, layers: WidgetStateLayer[]): Set<string> | undefined {
  if (layers.length === 0) {
    return undefined;
  }
  const base = resolveWidgetStateStack(widget, layers.slice(0, -1));
  const full = resolveWidgetStateStack(widget, layers);
  const delta = diffWidgetState(widget, full, base);
  const keys = new Set<string>();
  for (const key of Object.keys(delta.props ?? {})) keys.add(key);
  for (const key of Object.keys(delta.style ?? {})) keys.add(key);
  if (widget.type === 'flex') for (const key of Object.keys(delta.flex ?? {})) keys.add(key);
  if (widget.type !== 'swiper-item') for (const key of Object.keys(delta.item ?? {})) keys.add(key);
  if (widget.type === 'swiper') for (const key of Object.keys(delta.swiper ?? {})) keys.add(key);
  return keys;
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
    id: delta.id,
    ...(delta.name != null ? { name: delta.name } : {}),
    ...(delta.transition != null ? { transition: delta.transition } : {}),
    ...(delta.appliedState ? { appliedState: delta.appliedState } : {}),
    ...(delta.props ? { props: { ...delta.props } } : {}),
    ...(delta.style ? { style: { ...delta.style } } : {}),
    ...(delta.flex ? { flex: { ...delta.flex } } : {}),
    ...(delta.item ? { item: { ...delta.item } } : {}),
    ...(delta.swiper ? { swiper: { ...delta.swiper } } : {}),
    ...(delta.states?.length ? { states: delta.states.map((item) => cloneDelta(item)) } : {}),
  };
}

function sourceDeltaOnWidget(
  widget: PageWidget,
  sourceId: string | null,
  sourceOwned: boolean,
): WidgetStateDelta {
  if (!sourceId) {
    return { id: '' };
  }
  if (sourceOwned) {
    const owned = widget.states?.find((item) => item.id === sourceId);
    return owned ? cloneDelta(owned) : { id: sourceId };
  }
  const override = widget.stateOverrides?.find((item) => item.id === sourceId);
  return override ? cloneDelta(override) : { id: sourceId };
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
    const match = list.find((item) => item.id === from);
    if (!match || list.some((item) => item.id === to)) {
      return list;
    }
    return [...list, { ...cloneDelta(match), id: to, name: undefined }];
  });
}

function deleteOverrideDeep(widget: PageWidget, id: string): PageWidget {
  return mapOverrideDeep(widget, (list) => list.filter((item) => item.id !== id));
}

export function createWidgetState(
  widgets: PageWidget[],
  ownerId: string,
  newId: string,
  newName: string,
  sourceId: string | null,
  sourceOwned = true,
  transition?: number,
  scopeId?: string | null,
): PageWidget[] {
  const owner = findWidget(widgets, ownerId);
  const id = newId.trim();
  const name = newName.trim();
  if (!owner || !id || !name || ownedStateIds(owner).includes(id)) {
    return widgets;
  }
  if (scopeId) {
    const added: WidgetStateDelta = { id, name };
    if (transition != null && Number.isFinite(transition) && transition > 0) {
      added.transition = Math.round(transition);
    }
    return updateWidgetById(widgets, ownerId, (widget) => upsertNestedState(widget, scopeId, id, () => added));
  }
  const added: WidgetStateDelta = { ...sourceDeltaOnWidget(owner, sourceId, sourceOwned), id, name };
  if (transition != null && Number.isFinite(transition) && transition > 0) {
    added.transition = Math.round(transition);
  } else {
    delete added.transition;
  }
  return updateWidgetById(widgets, ownerId, (widget) => {
    const withState: PageWidget = { ...widget, states: [...(widget.states ?? []), added] };
    if (!sourceId || !hasChildren(withState)) {
      return withState;
    }
    return {
      ...withState,
      children: withState.children.map((child) => copyOverrideDeep(child, sourceId, id)),
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
  scopeId: string,
  stateId: string,
  mutate: (current: WidgetStateDelta | undefined) => WidgetStateDelta | undefined,
): PageWidget {
  const overrides = [...(widget.stateOverrides ?? [])];
  const index = overrides.findIndex((item) => item.id === scopeId);
  const parent: WidgetStateDelta = index >= 0 ? { ...overrides[index] } : { id: scopeId };
  const states = [...(parent.states ?? [])];
  const nestedIndex = states.findIndex((item) => item.id === stateId);
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
  if (nextParent.appliedState === stateId && !states.some((item) => item.id === nextParent.appliedState)) {
    delete nextParent.appliedState;
  }
  const empty =
    !nextParent.props &&
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
  stateId: string,
  nextName: string,
  transition?: number,
  scopeId?: string | null,
): PageWidget[] {
  const owner = findWidget(widgets, ownerId);
  const name = nextName.trim();
  if (!owner || !stateId || !name) {
    return widgets;
  }
  if (scopeId) {
    return updateWidgetById(widgets, ownerId, (widget) =>
      upsertNestedState(widget, scopeId, stateId, (current) => {
        if (!current) {
          return current;
        }
        return applyTransition({ ...current, name }, transition);
      }),
    );
  }
  return updateWidgetById(widgets, ownerId, (widget) => {
    if (!widget.states?.some((item) => item.id === stateId)) {
      return widget;
    }
    return {
      ...widget,
      states: widget.states.map((item) => (item.id === stateId ? applyTransition({ ...item, name }, transition) : item)),
    };
  });
}

export function deleteWidgetState(
  widgets: PageWidget[],
  ownerId: string,
  stateId: string,
  scopeId?: string | null,
): PageWidget[] {
  const owner = findWidget(widgets, ownerId);
  if (!owner || !stateId) {
    return widgets;
  }
  if (scopeId) {
    if (!owner.stateOverrides?.some((item) => item.id === scopeId && item.states?.some((nested) => nested.id === stateId))) {
      return widgets;
    }
    return updateWidgetById(widgets, ownerId, (widget) => {
      const next = upsertNestedState(widget, scopeId, stateId, () => undefined);
      if (!hasChildren(next)) {
        return next;
      }
      return {
        ...next,
        children: next.children.map((child) => deleteOverrideDeep(child, stateId)),
      };
    });
  }
  if (!owner.states?.some((item) => item.id === stateId)) {
    return widgets;
  }
  return updateWidgetById(widgets, ownerId, (widget) => {
    const states = (widget.states ?? []).filter((item) => item.id !== stateId);
    const next: PageWidget = { ...widget };
    if (states.length > 0) {
      next.states = states;
    } else {
      delete next.states;
    }
    if (next.appliedState === stateId || !next.states?.length) {
      delete next.appliedState;
    }
    if (!hasChildren(next)) {
      return next;
    }
    return {
      ...next,
      children: next.children.map((child) => deleteOverrideDeep(child, stateId)),
    };
  });
}

export function setAppliedState(
  widgets: PageWidget[],
  ownerId: string,
  stateId: string | null,
  scopeId?: string | null,
): PageWidget[] {
  return updateWidgetById(widgets, ownerId, (widget) => {
    if (scopeId) {
      const overrides = [...(widget.stateOverrides ?? [])];
      const index = overrides.findIndex((item) => item.id === scopeId);
      if (index < 0) {
        return widget;
      }
      const parent: WidgetStateDelta = { ...overrides[index] };
      if (stateId && parent.states?.some((item) => item.id === stateId)) {
        parent.appliedState = stateId;
      } else {
        delete parent.appliedState;
      }
      const empty =
        !parent.props && !parent.style && !parent.flex && !parent.item && !parent.swiper && !parent.states?.length && !parent.appliedState;
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
    if (stateId && widget.states?.some((item) => item.id === stateId)) {
      next.appliedState = stateId;
    } else {
      delete next.appliedState;
    }
    return next;
  });
}

function writeDelta(
  widget: PageWidget,
  stateId: string,
  role: WidgetStateRole,
  delta: WidgetStateFields,
  nestedIn?: string | null,
): PageWidget {
  if (role === 'owner' && nestedIn) {
    return upsertNestedState(widget, nestedIn, stateId, (current) =>
      current
        ? {
            id: current.id,
            name: current.name,
            ...delta,
            ...(current.transition != null ? { transition: current.transition } : {}),
            ...(current.states?.length ? { states: current.states } : {}),
          }
        : current,
    );
  }
  const key = role === 'owner' ? 'states' : 'stateOverrides';
  const list = [...(widget[key] ?? [])];
  const index = list.findIndex((item) => item.id === stateId);
  const prev = index >= 0 ? list[index] : undefined;
  const empty = !delta.props && !delta.style && !delta.flex && !delta.item && !delta.swiper;
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
    id: stateId,
    ...(role === 'owner' && prev?.name != null ? { name: prev.name } : {}),
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
  if (widget.states?.some((item) => item.id === viewingState)) {
    return null;
  }
  for (const ancestor of ancestorChain(widgets, widgetId).reverse()) {
    if (ancestor.id === widget.id) {
      continue;
    }
    const scopeId = ownerActiveId(ancestor, viewing);
    if (
      scopeId &&
      widget.stateOverrides?.some((item) => item.id === scopeId && item.states?.some((nested) => nested.id === viewingState))
    ) {
      return scopeId;
    }
  }
  return null;
}

function desiredPropsAfterPatch(
  base: WidgetContentProps | undefined,
  patch: WidgetPatch,
): WidgetContentProps | undefined {
  const next = { ...base };
  if (patch.value != null) {
    next.value = patch.value;
  }
  if (patch.text != null) {
    next.text = patch.text;
  }
  if (patch.src != null) {
    if (patch.src) {
      next.src = patch.src;
    } else {
      delete next.src;
    }
  }
  if (patch.size != null) {
    if (patch.size > 0) {
      next.size = patch.size;
    } else {
      delete next.size;
    }
  }
  return compactWidgetProps(next);
}

export function patchResolvedWidget(
  widget: PageWidget,
  patch: WidgetPatch,
  layers: WidgetStateLayer[],
): PageWidget {
  const baseContent: WidgetPatch = {};
  if ('loop' in patch) {
    baseContent.loop = patch.loop;
  }
  if ('stateFn' in patch) {
    baseContent.stateFn = patch.stateFn;
  }
  const hasPropPatch =
    patch.value != null || patch.text != null || patch.src != null || patch.size != null;
  const hasVisual = 'style' in patch || 'flex' in patch || 'item' in patch || 'swiper' in patch;

  if (layers.length === 0) {
    if (patch.value != null) {
      baseContent.value = patch.value;
    }
    if (patch.text != null) {
      baseContent.text = patch.text;
    }
    if (patch.src != null) {
      baseContent.src = patch.src;
    }
    if (patch.size != null) {
      baseContent.size = patch.size;
    }
    let next = Object.keys(baseContent).length > 0 ? patchWidget(widget, baseContent) : widget;
    if (!hasVisual) {
      return next;
    }
    const visual: WidgetPatch = {
      ...('style' in patch ? { style: patch.style } : {}),
      ...('flex' in patch ? { flex: patch.flex } : {}),
      ...('item' in patch ? { item: patch.item } : {}),
      ...('swiper' in patch ? { swiper: patch.swiper } : {}),
    };
    const layered = patchWidget(next, visual);
    if (!('style' in patch)) {
      return layered;
    }
    return forcePositionFields(layered, patch.style);
  }

  let next = Object.keys(baseContent).length > 0 ? patchWidget(widget, baseContent) : widget;
  if (!hasPropPatch && !hasVisual) {
    return next;
  }
  const resolved = resolveWidgetStateStack(next, layers);
  const lastLayer = layers[layers.length - 1];
  const desired: WidgetStateFields = {
    props: hasPropPatch ? desiredPropsAfterPatch(resolved.props, patch) : resolved.props,
    style: 'style' in patch ? patch.style : resolved.style,
    flex: 'flex' in patch ? patch.flex : resolved.flex,
    item: 'item' in patch ? patch.item : resolved.item,
    swiper: 'swiper' in patch ? patch.swiper : resolved.swiper,
  };
  const layered = writeDelta(
    next,
    lastLayer.id,
    lastLayer.role,
    diffWidgetState(next, desired, resolveWidgetStateStack(next, layers.slice(0, -1))),
    lastLayer.role === 'owner' ? nestedOwnerScope(next, lastLayer.id) : null,
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
  stateId: string | null,
  role: WidgetStateRole,
  nestedIn?: string | null,
): PageWidget {
  const hasPropPatch =
    patch.value != null || patch.text != null || patch.src != null || patch.size != null;
  const hasVisual = 'style' in patch || 'flex' in patch || 'item' in patch || 'swiper' in patch;

  if (!stateId) {
    const allPatch: WidgetPatch = {
      ...(patch.value != null ? { value: patch.value } : {}),
      ...(patch.text != null ? { text: patch.text } : {}),
      ...(patch.src != null ? { src: patch.src } : {}),
      ...(patch.size != null ? { size: patch.size } : {}),
      ...('loop' in patch ? { loop: patch.loop } : {}),
      ...('stateFn' in patch ? { stateFn: patch.stateFn } : {}),
      ...('style' in patch ? { style: patch.style } : {}),
      ...('flex' in patch ? { flex: patch.flex } : {}),
      ...('item' in patch ? { item: patch.item } : {}),
      ...('swiper' in patch ? { swiper: patch.swiper } : {}),
    };
    return Object.keys(allPatch).length > 0 ? patchWidget(widget, allPatch) : widget;
  }

  const baseContent: WidgetPatch = {};
  if ('loop' in patch) {
    baseContent.loop = patch.loop;
  }
  if ('stateFn' in patch) {
    baseContent.stateFn = patch.stateFn;
  }
  let next = Object.keys(baseContent).length > 0 ? patchWidget(widget, baseContent) : widget;
  if (!hasPropPatch && !hasVisual) {
    return next;
  }
  const layers: WidgetStateLayer[] = nestedIn
    ? [
        { id: nestedIn, role: 'descendant' },
        { id: stateId, role: 'owner' },
      ]
    : [{ id: stateId, role }];
  const resolved = resolveWidgetStateStack(next, layers);
  const desired: WidgetStateFields = {
    props: hasPropPatch ? desiredPropsAfterPatch(resolved.props, patch) : resolved.props,
    style: 'style' in patch ? patch.style : resolved.style,
    flex: 'flex' in patch ? patch.flex : resolved.flex,
    item: 'item' in patch ? patch.item : resolved.item,
    swiper: 'swiper' in patch ? patch.swiper : resolved.swiper,
  };
  const baseStack = layers.slice(0, -1);
  const base = baseStack.length > 0 ? resolveWidgetStateStack(next, baseStack) : undefined;
  return writeDelta(
    next,
    stateId,
    nestedIn ? 'owner' : role,
    diffWidgetState(next, desired, base),
    nestedIn ?? null,
  );
}
