import type { BindingScope } from './binding';

export type WidgetRuntimeMeta = {
  scope: BindingScope;
  key: string;
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
