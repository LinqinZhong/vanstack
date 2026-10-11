import type { BindingScope } from './binding';
import type { PageWidget } from './page';
import type { ScopeAssign } from './sugar';

/** 组件插槽被外层页面内容覆盖时，携带的覆盖内容与外层作用域。 */
export type WidgetSlotOverrideMeta = {
  content: PageWidget[];
  scope: BindingScope;
  outer: {
    scope: BindingScope;
    assignScope?: ScopeAssign;
    commitModelValue?: (name: string, value: string, done?: boolean) => void;
    emit?: (name: string, ...args: unknown[]) => void;
  };
};

export type WidgetRuntimeMeta = {
  scope: BindingScope;
  key: string;
  slotOverride?: WidgetSlotOverrideMeta;
};

const runtimeMeta = new WeakMap<object, WidgetRuntimeMeta>();

export function setWidgetRuntimeMeta(widget: object, value: WidgetRuntimeMeta) {
  runtimeMeta.set(widget, value);
}

export function getWidgetRuntimeMeta(widget: object): WidgetRuntimeMeta | undefined {
  return runtimeMeta.get(widget);
}

export function copyWidgetRuntimeMeta(from: object, to: object) {
  const value = runtimeMeta.get(from);
  if (value) {
    runtimeMeta.set(to, value);
  }
}
