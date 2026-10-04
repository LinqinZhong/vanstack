import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import {
  compactWidgetEvents,
  parseEventSource,
  widgetEventSpecs,
  type PageWidget,
  type WidgetEventPayload,
} from '@vanstack/xml';

export type WidgetEventLoader = (id: string) => Promise<string | null>;

const LONG_PRESS_MS = 500;

type Handler = (...args: unknown[]) => void;

export type WidgetRuntimeBindings = {
  dom: Record<string, Handler>;
  onIndexChange?: (index: number, oldIndex: number) => void;
};

const widgetText = new Map<string, string>();

export function rememberWidgetValue(id: string, value: string) {
  widgetText.set(id, value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function nativeEvent(event: unknown): Record<string, unknown> | null {
  const record = asRecord(event);
  if (!record) {
    return null;
  }
  return asRecord(record.nativeEvent) ?? record;
}

function numberField(record: Record<string, unknown> | null, key: string): number {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function firstTouch(list: unknown): Record<string, unknown> | null {
  if (!list || typeof list !== 'object') {
    return null;
  }
  return asRecord((list as ArrayLike<unknown>)[0]);
}

function pointOf(event: unknown): { x: number; y: number; pageX: number; pageY: number } {
  const native = nativeEvent(event);
  const touch = firstTouch(native?.changedTouches) ?? firstTouch(native?.touches) ?? firstTouch(native?.targetTouches);
  const source = touch ?? native;
  return {
    x: numberField(source, 'clientX'),
    y: numberField(source, 'clientY'),
    pageX: numberField(source, 'pageX'),
    pageY: numberField(source, 'pageY'),
  };
}

function textValue(event: unknown): string {
  const target = asRecord(nativeEvent(event)?.target);
  if (target?.type === 'checkbox' || target?.type === 'switch') {
    return typeof target.value === 'string' ? target.value : '';
  }
  const value = target?.value;
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function composeValue(event: unknown): string {
  const data = nativeEvent(event)?.data;
  return typeof data === 'string' ? data : '';
}

export function timeEventPayload() {
  return { timestamp: Date.now() };
}

export function pointEventPayload(event: unknown) {
  return { timestamp: Date.now(), ...pointOf(event) };
}

function eventPayload(widgetId: string, payload: WidgetEventPayload, event: unknown) {
  const timestamp = Date.now();
  if (payload === 'point') {
    return { timestamp, ...pointOf(event) };
  }
  if (payload === 'value') {
    const value = textValue(event);
    const oldValue = widgetText.get(widgetId) ?? '';
    widgetText.set(widgetId, value);
    return { timestamp, value, oldValue };
  }
  if (payload === 'compose') {
    return { timestamp, value: composeValue(event) };
  }
  return { timestamp };
}

export async function runEventIds(load: WidgetEventLoader, ids: string[], args: unknown[]) {
  for (const id of ids) {
    const source = await load(id);
    if (!source) {
      continue;
    }
    const parsed = parseEventSource(source);
    if (!parsed) {
      continue;
    }
    try {
      const fn = new Function(...parsed.paramNames, `"use strict";\n${parsed.body}`) as (
        ...values: unknown[]
      ) => unknown;
      await fn(...args);
    } catch (error) {
      console.error(error);
    }
  }
}

export function widgetRuntimeBindings(
  widget: PageWidget,
  load: WidgetEventLoader | undefined,
): WidgetRuntimeBindings | undefined {
  const events = compactWidgetEvents(widget.type, widget.events);
  if (!events || !load) {
    return undefined;
  }
  const dom: Record<string, Handler> = {};
  let onIndexChange: ((index: number, oldIndex: number) => void) | undefined;
  let longPressIds: string[] | undefined;

  for (const item of widgetEventSpecs(widget.type)) {
    const ids = events[item.name];
    if (!ids?.length) {
      continue;
    }
    if (item.payload === 'index') {
      onIndexChange = (index, oldIndex) => {
        void runEventIds(load, ids, [{ timestamp: Date.now(), value: index, oldValue: oldIndex }]);
      };
      continue;
    }
    if (item.name === 'longpress') {
      longPressIds = ids;
      continue;
    }
    dom[item.handler] = (event: unknown) => {
      void runEventIds(load, ids, [eventPayload(widget.id, item.payload, event)]);
    };
  }

  if (longPressIds) {
    let timer = 0;
    const clear = () => window.clearTimeout(timer);
    const ids = longPressIds;
    const prevStart = dom.onTouchStart;
    const prevMove = dom.onTouchMove;
    const prevEnd = dom.onTouchEnd;
    const prevCancel = dom.onTouchCancel;
    let start = { x: 0, y: 0, pageX: 0, pageY: 0 };
    dom.onTouchStart = (event: unknown) => {
      prevStart?.(event);
      clear();
      start = pointOf(event);
      timer = window.setTimeout(() => {
        void runEventIds(load, ids, [{ timestamp: Date.now(), ...start }]);
      }, LONG_PRESS_MS);
    };
    dom.onTouchMove = (event: unknown) => {
      prevMove?.(event);
      const point = pointOf(event);
      if (Math.hypot(point.x - start.x, point.y - start.y) > 10) {
        clear();
      }
    };
    const stop = (prev?: Handler): Handler => (event: unknown) => {
      clear();
      prev?.(event);
    };
    dom.onTouchEnd = stop(prevEnd);
    dom.onTouchCancel = stop(prevCancel);
  }

  if (!onIndexChange && Object.keys(dom).length === 0) {
    return undefined;
  }
  return { dom, onIndexChange };
}

export function chainEventProps<T extends Record<string, unknown>>(props: T, extra?: Record<string, Handler>): T {
  if (!extra) {
    return props;
  }
  const next: Record<string, unknown> = { ...props };
  for (const [key, handler] of Object.entries(extra)) {
    const current = next[key];
    next[key] =
      typeof current === 'function'
        ? (...args: unknown[]) => {
            (current as Handler)(...args);
            handler(...args);
          }
        : handler;
  }
  return next as T;
}

function optionalHandler(dom: Record<string, Handler>, key: string): Handler | undefined {
  return Object.prototype.hasOwnProperty.call(dom, key) ? dom[key] : undefined;
}

export function withDomEvents(node: ReactElement, bindings: WidgetRuntimeBindings | undefined, media: boolean): ReactElement {
  if (!bindings || Object.keys(bindings.dom).length === 0) {
    return node;
  }
  const onLoad = optionalHandler(bindings.dom, 'onLoad');
  const onError = optionalHandler(bindings.dom, 'onError');
  const rest = { ...bindings.dom };
  delete rest.onLoad;
  delete rest.onError;
  const props = chainEventProps(node.props as Record<string, unknown>, rest);
  let children: ReactNode = (node.props as { children?: ReactNode }).children;
  if (media && (onLoad || onError)) {
    const mediaProps: Record<string, Handler> = {
      ...(onLoad ? { onLoad } : {}),
      ...(onError ? { onError } : {}),
    };
    children = Children.map(children, (child) => {
      if (!isValidElement(child) || child.type !== 'img') {
        return child;
      }
      return cloneElement(child, chainEventProps(child.props as Record<string, unknown>, mediaProps));
    });
  }
  return cloneElement(node, props, children);
}
