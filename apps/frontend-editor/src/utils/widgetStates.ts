import {
  diffWidgetState,
  findOwnedDelta,
  ownedStateIds,
  resolveWidgetStateStack,
  compactWidgetProps,
  applyWidgetPresence,
  DEFAULT_PAGE_LANG_KEY,
  PAGE_ROOT_STATE_OWNER_ID,
  type PageWidget,
  type WidgetContentProps,
  type WidgetLangFieldDelta,
  type WidgetLangFields,
  type WidgetAnimation,
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
  transition?: number | string;
  scopeId?: string | null;
  scopeOwnerId?: string | null;
  children?: VisibleWidgetState[];
};

function flattenStateTree(nodes: VisibleWidgetState[]): VisibleWidgetState[] {
  return nodes.flatMap((node) => [node, ...flattenStateTree(node.children ?? [])]);
}

function ancestorOwnedStates(widget: PageWidget): Array<{ id: string; name: string; transition?: number | string }> {
  const rows: Array<{ id: string; name: string; transition?: number | string }> = [];
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

/** 组件编辑态：把组件根控件上定义的状态映射到「组件实例」作为宿主，供状态栏查看/切换。 */
export function collectComponentRootStates(
  ownerId: string,
  root: PageWidget | null | undefined,
): VisibleWidgetState[] {
  if (!root) {
    return [];
  }
  return [
    { id: null, name: null, owned: true, ownerId, transition: root.transition },
    ...(root.states ?? []).map((state) => ({
      id: state.id,
      name: state.name ?? state.id,
      owned: true,
      ownerId,
      transition: state.transition,
    })),
  ];
}

/**
 * 组件编辑态：收集某个组件内部控件（插槽/插槽内容）的状态树，并把宿主/作用域 id
 * 加上运行时前缀（`{instanceId}__` 或 `{instanceId}__slot-{slotId}__`），
 * 使其与 runtime 中 prefixed widget id 一致，从而能让 status 查看/切换正确级联。
 * 状态自身的 id / scopeId 不加前缀。
 */
export function collectPrefixedStateTree(
  widgets: PageWidget[],
  id: string | null | undefined,
  prefix: string,
): VisibleWidgetState[] {
  function mapNode(node: VisibleWidgetState): VisibleWidgetState {
    return {
      ...node,
      ownerId: `${prefix}${node.ownerId}`,
      ...(node.scopeOwnerId ? { scopeOwnerId: `${prefix}${node.scopeOwnerId}` } : {}),
      ...(node.children?.length ? { children: node.children.map(mapNode) } : {}),
    };
  }
  return collectStateTree(widgets, id).map(mapNode);
}

export type ViewingByOwner = Record<string, string | null>;

export function viewingListFromMap(map: ViewingByOwner): Array<{ ownerId: string; state: string | null }> {
  return Object.entries(map).map(([ownerId, state]) => ({ ownerId, state }));
}

export function pruneViewingByOwner(map: ViewingByOwner, widgets: PageWidget[]): ViewingByOwner {
  const next: ViewingByOwner = {};
  for (const [id, state] of Object.entries(map)) {
    // 页面全局状态的宿主不在 widgets 里，需保留。
    if (id === PAGE_ROOT_STATE_OWNER_ID || findWidget(widgets, id)) {
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
  ownerKey?: string,
): WidgetStateLayer[] {
  const selected = findWidget(widgets, widgetId);
  if (!selected) {
    return [];
  }
  const layers: WidgetStateLayer[] = [];
  // 文档级全局状态作为最外层「后代」层：在某个全局状态下编辑节点样式时，增量会写入
  // 该控件自身的 stateOverrides，从而只在该全局状态下生效并保持；切换全局状态即恢复。
  // 组件编辑态（带前缀 ownerKey）下组件内部不叠加页面全局状态。
  if (!ownerKey) {
    const globalStateId = viewing[PAGE_ROOT_STATE_OWNER_ID] ?? null;
    if (globalStateId) {
      layers.push({ id: globalStateId, role: 'descendant' });
    }
  }
  for (const widget of ancestorChain(widgets, widgetId)) {
    const key = ownerKey ? `${ownerKey}${widget.id}` : widget.id;
    const stateId = viewing[key] ?? null;
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
  if (widget.type === 'checkbox') {
    return props.text != null ? { ...widget, text: props.text } : widget;
  }
  if (widget.type === 'input') {
    return props.value != null ? { ...widget, value: props.value } : widget;
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
  if (widget.type === 'th' || widget.type === 'td') {
    return props.value != null ? { ...widget, value: props.value } : widget;
  }
  if (widget.type === 'window') {
    return props.value != null ? { ...widget, value: props.value } : widget;
  }
  if (widget.type === 'windows') {
    return props.current != null ? { ...widget, current: props.current } : widget;
  }
  return widget;
}

export function widgetWithStateLayers(widget: PageWidget, layers: WidgetStateLayer[], locale?: string | null): PageWidget {
  const fields = resolveWidgetStateStack(widget, layers, locale ?? undefined);
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
  if (next.type === 'grid') {
    if (fields.grid) {
      next.grid = fields.grid;
    } else {
      delete next.grid;
    }
  }
  if (next.type !== 'swiper-item' && next.type !== 'window' && next.type !== 'th' && next.type !== 'tr' && next.type !== 'td') {
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
  if (fields.animation) {
    next.animation = fields.animation;
  } else {
    delete next.animation;
  }
  return fields.presence ? applyWidgetPresence(next, fields.presence) : next;
}

export function widgetWithViewing(
  widget: PageWidget,
  owner: PageWidget | null,
  viewingState: string | null,
  locale?: string | null,
): PageWidget {
  return widgetWithStateLayers(
    widget,
    viewingState ? [{ id: viewingState, role: stateRole(owner, widget) }] : [],
    locale,
  );
}

export function widgetWithStateLayerDelta(widget: PageWidget, layers: WidgetStateLayer[], locale?: string | null): PageWidget {
  if (layers.length === 0) {
    return widget;
  }
  const base = resolveWidgetStateStack(widget, layers.slice(0, -1), locale ?? undefined);
  const full = resolveWidgetStateStack(widget, layers, locale ?? undefined);
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
  if (next.type === 'grid') {
    if (delta.grid) {
      next.grid = delta.grid;
    } else {
      delete next.grid;
    }
  }
  if (next.type !== 'swiper-item' && next.type !== 'window' && next.type !== 'th' && next.type !== 'tr' && next.type !== 'td') {
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
  if (delta.animation) {
    next.animation = delta.animation;
  }
  return delta.presence ? applyWidgetPresence(next, delta.presence) : next;
}

export function stateOwnKeys(widget: PageWidget, layers: WidgetStateLayer[], locale?: string | null): Set<string> | undefined {
  if (layers.length === 0) {
    return undefined;
  }
  const base = resolveWidgetStateStack(widget, layers.slice(0, -1), locale ?? undefined);
  const full = resolveWidgetStateStack(widget, layers, locale ?? undefined);
  const delta = diffWidgetState(widget, full, base);
  const keys = new Set<string>();
  for (const key of Object.keys(delta.props ?? {})) keys.add(key);
  for (const key of Object.keys(delta.style ?? {})) keys.add(key);
  if (widget.type === 'flex') for (const key of Object.keys(delta.flex ?? {})) keys.add(key);
  if (widget.type === 'grid') for (const key of Object.keys(delta.grid ?? {})) keys.add(key);
  if (widget.type !== 'swiper-item' && widget.type !== 'window' && widget.type !== 'th' && widget.type !== 'tr' && widget.type !== 'td') for (const key of Object.keys(delta.item ?? {})) keys.add(key);
  if (widget.type === 'swiper') for (const key of Object.keys(delta.swiper ?? {})) keys.add(key);
  if (delta.presence) keys.add('presence');
  if (delta.animation) keys.add('animation');
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
    ...(delta.grid
      ? {
          grid: {
            ...delta.grid,
            ...(delta.grid.rows ? { rows: [...delta.grid.rows] } : {}),
            ...(delta.grid.columns ? { columns: [...delta.grid.columns] } : {}),
          },
        }
      : {}),
    ...(delta.item ? { item: { ...delta.item } } : {}),
    ...(delta.swiper ? { swiper: { ...delta.swiper } } : {}),
    ...(delta.presence ? { presence: delta.presence } : {}),
    ...(delta.animation ? { animation: { ...delta.animation } } : {}),
    ...(delta.langFields ? { langFields: { ...delta.langFields } } : {}),
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
    !nextParent.grid &&
    !nextParent.item &&
    !nextParent.swiper &&
    !nextParent.presence &&
    !nextParent.animation &&
    !nextParent.langFields &&
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
          !parent.props && !parent.style && !parent.flex && !parent.item && !parent.swiper && !parent.presence && !parent.animation && !parent.langFields && !parent.states?.length && !parent.appliedState;
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

/** 语言分支路由：非空且非默认语言（简体中文）时返回语言 key，否则返回 null（走默认基准字段）。 */
function langKeyFor(locale: string | null | undefined): string | null {
  const key = locale?.trim() ?? '';
  return key && key !== DEFAULT_PAGE_LANG_KEY ? key : null;
}

/** 把字段差异包装成语言增量（仅保留非空字段）。 */
function langFieldFromFields(delta: WidgetStateFields | undefined): WidgetLangFieldDelta | undefined {
  if (!delta) {
    return undefined;
  }
  const next: WidgetLangFieldDelta = {};
  if (delta.props) next.props = delta.props;
  if (delta.style) next.style = delta.style;
  if (delta.flex) next.flex = delta.flex;
  if (delta.grid) next.grid = delta.grid;
  if (delta.item) next.item = delta.item;
  if (delta.swiper) next.swiper = delta.swiper;
  if (delta.presence) next.presence = delta.presence;
  return Object.keys(next).length > 0 ? next : undefined;
}

/** 更新某层 langFields 中指定语言的增量，返回新的 langFields（为空时返回 undefined）。 */
function withLangField(
  langFields: WidgetLangFields | undefined,
  langKey: string,
  langDelta: WidgetLangFieldDelta | undefined,
): WidgetLangFields | undefined {
  const next: WidgetLangFields = { ...(langFields ?? {}) };
  if (langDelta && Object.keys(langDelta).length > 0) {
    next[langKey] = langDelta;
  } else {
    delete next[langKey];
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

/** 把字段差异写入状态层：默认语言走扁平字段，非默认语言写入 langFields[langKey]。 */
function appliedFieldDelta(
  delta: WidgetStateFields,
  prev: WidgetStateDelta | undefined,
  langKey: string | null,
): WidgetStateDelta {
  if (!langKey) {
    return { ...(prev ?? { id: '' }), ...delta };
  }
  const next: WidgetStateDelta = { ...(prev ?? { id: '' }) };
  const langFields = withLangField(prev?.langFields, langKey, langFieldFromFields(delta));
  if (langFields) {
    next.langFields = langFields;
  } else {
    delete next.langFields;
  }
  return next;
}

/** 把语言增量写入控件基准层（widget.langFields）。 */
function writeBaseLangField(widget: PageWidget, langKey: string, langDelta: WidgetLangFieldDelta | undefined): PageWidget {
  const next = { ...widget };
  const langFields = withLangField(widget.langFields, langKey, langDelta);
  if (langFields) {
    next.langFields = langFields;
  } else {
    delete next.langFields;
  }
  return next;
}

function writeDelta(
  widget: PageWidget,
  stateId: string,
  role: WidgetStateRole,
  delta: WidgetStateFields,
  nestedIn?: string | null,
  langKey?: string | null,
): PageWidget {
  if (role === 'owner' && nestedIn) {
    return upsertNestedState(widget, nestedIn, stateId, (current) =>
      current ? appliedFieldDelta(delta, current, langKey ?? null) : current,
    );
  }
  const key = role === 'owner' ? 'states' : 'stateOverrides';
  const list = [...(widget[key] ?? [])];
  const index = list.findIndex((item) => item.id === stateId);
  const prev = index >= 0 ? list[index] : undefined;
  const nextLangFields = langKey
    ? withLangField(prev?.langFields, langKey, langFieldFromFields(delta))
    : prev?.langFields;
  const entry: WidgetStateDelta = {
    id: stateId,
    ...(role === 'owner' && prev?.name != null ? { name: prev.name } : {}),
    ...(langKey
      ? {
          ...(prev?.props ? { props: prev.props } : {}),
          ...(prev?.style ? { style: prev.style } : {}),
          ...(prev?.flex ? { flex: prev.flex } : {}),
          ...(prev?.grid ? { grid: prev.grid } : {}),
          ...(prev?.item ? { item: prev.item } : {}),
          ...(prev?.swiper ? { swiper: prev.swiper } : {}),
          ...(prev?.presence ? { presence: prev.presence } : {}),
          ...(prev?.animation ? { animation: prev.animation } : {}),
        }
      : delta),
    ...(role === 'owner' && prev?.transition != null ? { transition: prev.transition } : {}),
    ...(prev?.states?.length ? { states: prev.states } : {}),
    ...(role === 'descendant' && prev?.appliedState ? { appliedState: prev.appliedState } : {}),
  };
  if (nextLangFields) {
    entry.langFields = nextLangFields;
  }
  if (role === 'descendant') {
    const empty =
      !entry.props &&
      !entry.style &&
      !entry.flex &&
      !entry.grid &&
      !entry.item &&
      !entry.swiper &&
      !entry.presence &&
      !entry.animation &&
      !entry.langFields &&
      !entry.states?.length &&
      !entry.appliedState;
    if (empty) {
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
  }
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
    if (typeof patch.size === 'number' && patch.size > 0) {
      next.size = patch.size;
    } else {
      delete next.size;
    }
  }
  if ('current' in patch) {
    const current = patch.current?.trim() ?? '';
    if (current) {
      next.current = current;
    } else {
      delete next.current;
    }
  }
  return compactWidgetProps(next);
}

/** 动画写入：无状态层写控件基础字段；有状态层写目标状态层的扁平动画增量（只跟随状态，不区分语言）。 */
function patchAnimationField(
  widget: PageWidget,
  layers: WidgetStateLayer[],
  animation: WidgetAnimation | undefined,
): PageWidget {
  if (layers.length === 0) {
    const next: PageWidget = { ...widget };
    if (animation && animation.id) {
      next.animation = { ...animation };
    } else {
      delete next.animation;
    }
    return next;
  }
  const lastLayer = layers[layers.length - 1];
  const resolved = resolveWidgetStateStack(widget, layers);
  const desired: WidgetStateFields = { ...resolved, animation };
  const base = resolveWidgetStateStack(widget, layers.slice(0, -1));
  return writeDelta(
    widget,
    lastLayer.id,
    lastLayer.role,
    diffWidgetState(widget, desired, base),
    lastLayer.role === 'owner' ? nestedOwnerScope(widget, lastLayer.id) : null,
  );
}

export function patchResolvedWidget(
  widget: PageWidget,
  patch: WidgetPatch,
  layers: WidgetStateLayer[],
  locale?: string | null,
): PageWidget {
  const langKey = langKeyFor(locale);
  const baseContent: WidgetPatch = {};
  if ('loop' in patch) {
    baseContent.loop = patch.loop;
  }
  if ('events' in patch) {
    baseContent.events = patch.events;
  }
  if ('stateFn' in patch) {
    baseContent.stateFn = patch.stateFn;
  }
  if ('hoverStateId' in patch) {
    baseContent.hoverStateId = patch.hoverStateId;
  }
  if ('name' in patch) {
    baseContent.name = patch.name;
  }
  if ('slotId' in patch) {
    baseContent.slotId = patch.slotId;
  }
  if ('alias' in patch) {
    baseContent.alias = patch.alias;
  }
  if ('presence' in patch && patch.presence != null && layers.length === 0 && !langKey) {
    baseContent.presence = patch.presence;
  }
  const contentPatch: WidgetPatch =
    widget.type === 'checkbox' || widget.type === 'switch'
      ? { ...patch, value: undefined, size: undefined, activeColor: undefined }
      : patch;
  const hasPropPatch =
    contentPatch.value != null ||
    contentPatch.text != null ||
    contentPatch.src != null ||
    contentPatch.size != null ||
    'current' in contentPatch;
  const hasVisual = 'style' in patch || 'flex' in patch || 'grid' in patch || 'item' in patch || 'swiper' in patch;
  const hasPresence = 'presence' in patch && patch.presence != null;
  const hasAnimation = 'animation' in patch;
  // 动画只跟随状态、不区分语言：单独走状态化写入（写进目标状态层的扁平增量）。
  if (hasAnimation && !hasPropPatch && !hasVisual && !hasPresence) {
    return patchAnimationField(widget, layers, patch.animation);
  }
  if ('freezeHeader' in patch) {
    baseContent.freezeHeader = patch.freezeHeader;
  }
  if ('freezeFooter' in patch) {
    baseContent.freezeFooter = patch.freezeFooter;
  }
  if ('headerHeight' in patch) {
    baseContent.headerHeight = patch.headerHeight;
  }
  if ('lines' in patch) {
    baseContent.lines = patch.lines;
  }
  if ('width' in patch) {
    baseContent.width = patch.width;
  }
  if ('height' in patch) {
    baseContent.height = patch.height;
  }
  if ('align' in patch) {
    baseContent.align = patch.align;
  }
  if ('valign' in patch) {
    baseContent.valign = patch.valign;
  }
  if ('inputType' in patch) {
    baseContent.inputType = patch.inputType;
  }
  if ('modelValue' in patch) {
    baseContent.modelValue = patch.modelValue;
  }
  if ('selected' in patch) {
    baseContent.selected = patch.selected;
  }
  if ((widget.type === 'checkbox' || widget.type === 'switch') && patch.value != null) {
    baseContent.value = patch.value;
  }
  if (widget.type === 'switch') {
    if ('size' in patch) {
      baseContent.size = patch.size;
    }
    if ('activeColor' in patch) {
      baseContent.activeColor = patch.activeColor;
    }
  }
  if ('placeholder' in patch) {
    baseContent.placeholder = patch.placeholder;
  }
  if ('checked' in patch) {
    baseContent.checked = patch.checked;
  }
  if ('args' in patch) {
    baseContent.args = patch.args;
  }
  if ('editProps' in patch) {
    baseContent.editProps = patch.editProps;
  }
  if ('place' in patch) {
    baseContent.place = patch.place;
  }
  if ('mask' in patch) {
    baseContent.mask = patch.mask;
  }
  if ('maskClose' in patch) {
    baseContent.maskClose = patch.maskClose;
  }

  if (layers.length === 0) {
    if (!langKey) {
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
      if ('current' in patch) {
        baseContent.current = patch.current;
      }
      let next = Object.keys(baseContent).length > 0 ? patchWidget(widget, baseContent) : widget;
      if (!hasVisual) {
        return next;
      }
      const visual: WidgetPatch = {
        ...('style' in patch ? { style: patch.style } : {}),
        ...('flex' in patch ? { flex: patch.flex } : {}),
        ...('grid' in patch ? { grid: patch.grid } : {}),
        ...('item' in patch ? { item: patch.item } : {}),
        ...('swiper' in patch ? { swiper: patch.swiper } : {}),
      };
      const layered = patchWidget(next, visual);
      if (!('style' in patch)) {
        return layered;
      }
      return forcePositionFields(layered, patch.style);
    }
    // 非默认语言：结构字段写入基准，分支字段（props/style/flex/item/swiper/presence）写入 langFields[langKey]。
    let next = Object.keys(baseContent).length > 0 ? patchWidget(widget, baseContent) : widget;
    const existing = widget.langFields?.[langKey];
    const baseLocal = resolveWidgetStateStack(next, [], langKey);
    const desired: WidgetStateFields = {
      props: hasPropPatch ? desiredPropsAfterPatch(baseLocal.props, contentPatch) : baseLocal.props,
      style: 'style' in patch ? patch.style : baseLocal.style,
      flex: 'flex' in patch ? patch.flex : baseLocal.flex,
      grid: 'grid' in patch ? patch.grid : baseLocal.grid,
      item: 'item' in patch ? patch.item : baseLocal.item,
      swiper: 'swiper' in patch ? patch.swiper : baseLocal.swiper,
      presence: hasPresence ? patch.presence : existing?.presence,
    };
    const baseDefault = resolveWidgetStateStack(next, []);
    const langDelta = diffWidgetState(next, desired, baseDefault);
    let routed = writeBaseLangField(next, langKey, langFieldFromFields(langDelta));
    if ('style' in patch) {
      routed = forcePositionFields(routed, patch.style);
    }
    return routed;
  }

  let next = Object.keys(baseContent).length > 0 ? patchWidget(widget, baseContent) : widget;
  if (!hasPropPatch && !hasVisual && !hasPresence) {
    return next;
  }
  const lastLayer = layers[layers.length - 1];

  if (langKey) {
    // 非默认语言：计算目标层在语言下的完整贡献，与默认语言贡献相减得到的增量写入 langFields[langKey]。
    const baseLocal = resolveWidgetStateStack(next, layers.slice(0, -1), langKey);
    const resolvedLocal = resolveWidgetStateStack(next, layers, langKey);
    const desiredLocal: WidgetStateFields = {
      props: hasPropPatch ? desiredPropsAfterPatch(resolvedLocal.props, contentPatch) : resolvedLocal.props,
      style: 'style' in patch ? patch.style : resolvedLocal.style,
      flex: 'flex' in patch ? patch.flex : resolvedLocal.flex,
      grid: 'grid' in patch ? patch.grid : resolvedLocal.grid,
      item: 'item' in patch ? patch.item : resolvedLocal.item,
      swiper: 'swiper' in patch ? patch.swiper : resolvedLocal.swiper,
      presence: hasPresence ? patch.presence : resolvedLocal.presence,
    };
    const contribLocal = diffWidgetState(next, desiredLocal, baseLocal);
    const fullDefault = resolveWidgetStateStack(next, layers);
    const baseDefault = resolveWidgetStateStack(next, layers.slice(0, -1));
    const contribDefault = diffWidgetState(next, fullDefault, baseDefault);
    const langDelta = diffWidgetState(next, contribLocal, contribDefault);
    let layered = writeDelta(
      next,
      lastLayer.id,
      lastLayer.role,
      langDelta,
      lastLayer.role === 'owner' ? nestedOwnerScope(next, lastLayer.id) : null,
      langKey,
    );
    if ('style' in patch) {
      layered = forcePositionFields(layered, desiredLocal.style);
    }
    return layered;
  }

  const resolved = resolveWidgetStateStack(next, layers);
  const desired: WidgetStateFields = {
    props: hasPropPatch ? desiredPropsAfterPatch(resolved.props, contentPatch) : resolved.props,
    style: 'style' in patch ? patch.style : resolved.style,
    flex: 'flex' in patch ? patch.flex : resolved.flex,
    grid: 'grid' in patch ? patch.grid : resolved.grid,
    item: 'item' in patch ? patch.item : resolved.item,
    swiper: 'swiper' in patch ? patch.swiper : resolved.swiper,
    presence: hasPresence ? patch.presence : resolved.presence,
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
  locale?: string | null,
): PageWidget {
  const langKey = langKeyFor(locale);
  const hasPropPatch =
    patch.value != null || patch.text != null || patch.src != null || patch.size != null;
  const hasVisual = 'style' in patch || 'flex' in patch || 'grid' in patch || 'item' in patch || 'swiper' in patch;
  const hasPresence = 'presence' in patch && patch.presence != null;

  if (!stateId) {
    const structural: WidgetPatch = {
      ...('loop' in patch ? { loop: patch.loop } : {}),
      ...('events' in patch ? { events: patch.events } : {}),
      ...('stateFn' in patch ? { stateFn: patch.stateFn } : {}),
      ...('place' in patch ? { place: patch.place } : {}),
      ...('mask' in patch ? { mask: patch.mask } : {}),
      ...('maskClose' in patch ? { maskClose: patch.maskClose } : {}),
    };
    if (!langKey) {
      const allPatch: WidgetPatch = {
        ...(patch.value != null ? { value: patch.value } : {}),
        ...(patch.text != null ? { text: patch.text } : {}),
        ...(patch.src != null ? { src: patch.src } : {}),
        ...(patch.size != null ? { size: patch.size } : {}),
        ...('presence' in patch ? { presence: patch.presence } : {}),
        ...('style' in patch ? { style: patch.style } : {}),
        ...('flex' in patch ? { flex: patch.flex } : {}),
        ...('grid' in patch ? { grid: patch.grid } : {}),
        ...('item' in patch ? { item: patch.item } : {}),
        ...('swiper' in patch ? { swiper: patch.swiper } : {}),
        ...structural,
      };
      return Object.keys(allPatch).length > 0 ? patchWidget(widget, allPatch) : widget;
    }
    // 非默认语言：结构字段写入基准，分支字段写入 langFields[langKey]。
    let next = Object.keys(structural).length > 0 ? patchWidget(widget, structural) : widget;
    const existing = widget.langFields?.[langKey];
    const baseLocal = resolveWidgetStateStack(next, [], langKey);
    const desired: WidgetStateFields = {
      props: hasPropPatch ? desiredPropsAfterPatch(baseLocal.props, patch) : baseLocal.props,
      style: 'style' in patch ? patch.style : baseLocal.style,
      flex: 'flex' in patch ? patch.flex : baseLocal.flex,
      grid: 'grid' in patch ? patch.grid : baseLocal.grid,
      item: 'item' in patch ? patch.item : baseLocal.item,
      swiper: 'swiper' in patch ? patch.swiper : baseLocal.swiper,
      presence: hasPresence ? patch.presence : existing?.presence,
    };
    const baseDefault = resolveWidgetStateStack(next, []);
    const langDelta = diffWidgetState(next, desired, baseDefault);
    return writeBaseLangField(next, langKey, langFieldFromFields(langDelta));
  }

  const baseContent: WidgetPatch = {};
  if ('loop' in patch) {
    baseContent.loop = patch.loop;
  }
  if ('events' in patch) {
    baseContent.events = patch.events;
  }
  if ('stateFn' in patch) {
    baseContent.stateFn = patch.stateFn;
  }
  let next = Object.keys(baseContent).length > 0 ? patchWidget(widget, baseContent) : widget;
  if (!hasPropPatch && !hasVisual && !hasPresence) {
    return next;
  }
  const layers: WidgetStateLayer[] = nestedIn
    ? [
        { id: nestedIn, role: 'descendant' },
        { id: stateId, role: 'owner' },
      ]
    : [{ id: stateId, role }];
  const nestedRole = nestedIn ? 'owner' : role;

  if (langKey) {
    const baseLocal = resolveWidgetStateStack(next, layers.slice(0, -1), langKey);
    const resolvedLocal = resolveWidgetStateStack(next, layers, langKey);
    const desiredLocal: WidgetStateFields = {
      props: hasPropPatch ? desiredPropsAfterPatch(resolvedLocal.props, patch) : resolvedLocal.props,
      style: 'style' in patch ? patch.style : resolvedLocal.style,
      flex: 'flex' in patch ? patch.flex : resolvedLocal.flex,
      grid: 'grid' in patch ? patch.grid : resolvedLocal.grid,
      item: 'item' in patch ? patch.item : resolvedLocal.item,
      swiper: 'swiper' in patch ? patch.swiper : resolvedLocal.swiper,
      presence: hasPresence ? patch.presence : resolvedLocal.presence,
    };
    const contribLocal = diffWidgetState(next, desiredLocal, baseLocal);
    const fullDefault = resolveWidgetStateStack(next, layers);
    const baseDefault = resolveWidgetStateStack(next, layers.slice(0, -1));
    const contribDefault = diffWidgetState(next, fullDefault, baseDefault);
    const langDelta = diffWidgetState(next, contribLocal, contribDefault);
    return writeDelta(next, stateId, nestedRole, langDelta, nestedIn ?? null, langKey);
  }

  const resolved = resolveWidgetStateStack(next, layers);
  const desired: WidgetStateFields = {
    props: hasPropPatch ? desiredPropsAfterPatch(resolved.props, patch) : resolved.props,
    style: 'style' in patch ? patch.style : resolved.style,
    flex: 'flex' in patch ? patch.flex : resolved.flex,
    grid: 'grid' in patch ? patch.grid : resolved.grid,
    item: 'item' in patch ? patch.item : resolved.item,
    swiper: 'swiper' in patch ? patch.swiper : resolved.swiper,
    presence: hasPresence ? patch.presence : resolved.presence,
  };
  const baseStack = layers.slice(0, -1);
  const base = baseStack.length > 0 ? resolveWidgetStateStack(next, baseStack) : undefined;
  return writeDelta(
    next,
    stateId,
    nestedRole,
    diffWidgetState(next, desired, base),
    nestedIn ?? null,
  );
}
