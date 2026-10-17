import {
  compileScopeSugar,
  isJsIdentifier,
  type PageMethod,
  type PageVariable,
  type PageWidget,
  type PageXmlDocument,
  type ScopeAssign,
  type ScopeAssignCall,
} from '@vanstack/xml';
import { setterTargets } from './events';

/** 组件实例句柄：页面里指向组件实例的「控件」变量持有它，用它的方法访问组件暴露的方法。 */
export type ComponentInstance = {
  call: (name: string, args: unknown[]) => unknown;
};

/** 方法执行作用域：`$data`/`$props` 指向组件实例，`$local` 是方法私有单例。 */
export type MethodScope = {
  data: Record<string, unknown>;
  props: Record<string, unknown>;
  local: Record<string, unknown>;
  assign?: ScopeAssign;
  /** 当前文档自己的方法集合，方法体里用 `$this.xxx()` 调用。 */
  self?: Record<string, unknown>;
};

/**
 * 当前文档（页面/组件）自己的方法集合，暴露成 `$this`：
 * 脚本里可以 `$this.xxx()` 调用自己（同层）的方法。
 */
export function buildSelf(
  methods: PageMethod[] | undefined,
  invoke: (name: string, args: unknown[]) => unknown,
): Record<string, unknown> {
  const self: Record<string, unknown> = {};
  for (const method of methods ?? []) {
    if (!method.name) {
      continue;
    }
    self[method.name] = (...args: unknown[]) => invoke(method.name, args);
  }
  return self;
}

/** 方法私有数据的初始值：静态字面量字符串按声明类型转成实际值。 */
export function initMethodLocal(data: PageMethod['data']): Record<string, unknown> {
  const local: Record<string, unknown> = {};
  for (const item of data ?? []) {
    local[item.name] = localValue(item.type, item.value);
  }
  return local;
}

function localValue(type: string, raw: string): unknown {
  const text = raw ?? '';
  if (text === '') {
    if (type === 'number') {
      return 0;
    }
    if (type === 'boolean') {
      return false;
    }
    if (type === 'array') {
      return [];
    }
    if (type === 'object') {
      return {};
    }
    return '';
  }
  if (type === 'number') {
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : text;
  }
  if (type === 'boolean') {
    return text === '1' || text === 'true';
  }
  if (type === 'array' || type === 'object') {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

/**
 * 运行方法体：注入入参 + `$data`/`$props`/`$local`，
 * `$data.x(v)` / `$props.x(v)` 之类的 setter 糖走 `assign` 写回实例。
 */
export async function runMethodCode(
  code: string,
  paramNames: string[],
  scope: MethodScope,
  args: unknown[],
): Promise<unknown> {
  const compiled = compileScopeSugar(code);
  const names: string[] = [];
  const values: unknown[] = [];
  const used = new Set<string>();
  const add = (name: string, value: unknown) => {
    if (used.has(name) || !isJsIdentifier(name)) {
      return;
    }
    used.add(name);
    names.push(name);
    values.push(value);
  };
  for (const [setter, targets] of setterTargets(compiled.calls as ScopeAssignCall[])) {
    add(setter, (value: unknown) => {
      for (const target of targets) {
        scope.assign?.(target.bucket, target.name, value);
      }
    });
  }
  add('$data', scope.data);
  add('$props', scope.props);
  add('$local', scope.local);
  add('$this', scope.self ?? {});
  paramNames.forEach((name, index) => add(name, args[index]));
  const fn = new Function(...names, `"use strict";\n${compiled.code}`) as (...input: unknown[]) => unknown;
  return await fn(...values);
}

function walkWidgets(widgets: PageWidget[], visit: (widget: PageWidget) => void) {
  for (const widget of widgets) {
    visit(widget);
    if ('children' in widget && Array.isArray(widget.children)) {
      walkWidgets(widget.children, visit);
    }
    const slotContent = (widget as { slotContent?: Record<string, PageWidget[]> }).slotContent;
    if (slotContent) {
      for (const list of Object.values(slotContent)) {
        walkWidgets(list, visit);
      }
    }
  }
}

/**
 * 数据池里指向组件实例的「控件」变量，不再是字符串 id，而是组件实例：
 * 该组件暴露的方法（`method.expose`）挂到实例上，通过 `$data.xxx.method()` 调用。
 */
export function bindComponentInstances(
  data: Record<string, unknown>,
  variables: PageVariable[] | undefined,
  widgets: PageWidget[],
  components: Record<string, PageXmlDocument> | undefined,
  instances: Map<string, ComponentInstance>,
) {
  const componentOf = new Map<string, string>();
  walkWidgets(widgets, (widget) => {
    if (widget.type === 'component') {
      componentOf.set(widget.id, widget.componentId);
    }
  });
  for (const variable of variables ?? []) {
    if (variable.type !== 'widget' || !variable.name) {
      continue;
    }
    const current = data[variable.name];
    const id = typeof current === 'string' && current ? current : variable.value.trim();
    if (!id) {
      continue;
    }
    const componentId = componentOf.get(id);
    if (!componentId) {
      // 不是组件实例（抽屉等）交给各自的绑定逻辑处理。
      continue;
    }
    const exposed = components?.[componentId]?.methods?.filter((method) => method.expose && method.name) ?? [];
    const instance: Record<string, unknown> = {};
    for (const method of exposed) {
      instance[method.name] = (...args: unknown[]) => instances.get(id)?.call(method.name, args);
    }
    data[variable.name] = instance;
  }
}
