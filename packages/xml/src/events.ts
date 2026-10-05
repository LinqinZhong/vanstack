export const WIDGET_KINDS = [
  'image',
  'icon',
  'text',
  'button',
  'input',
  'checkbox',
  'switch',
  'flex',
  'swiper',
  'swiper-item',
  'table',
  'th',
  'tr',
  'td',
  'component',
] as const;

export type WidgetKind = (typeof WIDGET_KINDS)[number];

export type WidgetEventParam = {
  name: string;
  type: string;
};

export type WidgetEventPayload = 'point' | 'value' | 'index' | 'compose' | 'time';

export type WidgetEventSpec = {
  /** XML 属性名。`click` 写成 `@click`，对应函数 `onClick`。 */
  name: string;
  handler: string;
  payload: WidgetEventPayload;
  params: WidgetEventParam[];
};

/** 事件脚本里的形参类型。运行时传入同名字段的普通对象，而不是浏览器事件。 */
export const WIDGET_EVENT_DECLARATIONS = `interface PointEvent {
  /** 触发时间，毫秒时间戳 */
  timestamp: number
  /** 屏幕位置，相对可视区域左边 */
  x: number
  /** 屏幕位置，相对可视区域顶边 */
  y: number
  /** 页面位置，相对页面左边 */
  pageX: number
  /** 页面位置，相对页面顶边 */
  pageY: number
}
interface ValueEvent {
  /** 触发时间，毫秒时间戳 */
  timestamp: number
  /** 新的值 */
  value: string
  /** 更新前的值 */
  oldValue: string
}
interface IndexEvent {
  /** 触发时间，毫秒时间戳 */
  timestamp: number
  /** 新的序号 */
  value: number
  /** 更新前的序号 */
  oldValue: number
}
interface ComposeEvent {
  /** 触发时间，毫秒时间戳 */
  timestamp: number
  /** 输入法正在组合的文本 */
  value: string
}
interface TimeEvent {
  /** 触发时间，毫秒时间戳 */
  timestamp: number
}`;

export type WidgetEventName = string;

export type WidgetEvents = Partial<Record<string, string[]>> & { order?: string[] };

const EVENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const touch: WidgetEventSpec[] = [
  spec('click', 'onClick', 'point'),
  spec('longpress', 'onLongPress', 'point'),
  spec('touchstart', 'onTouchStart', 'point'),
  spec('touchend', 'onTouchEnd', 'point'),
  spec('touchmove', 'onTouchMove', 'point'),
  spec('touchcancel', 'onTouchCancel', 'point'),
];

const focusable: WidgetEventSpec[] = [
  spec('focus', 'onFocus', 'time'),
  spec('blur', 'onBlur', 'time'),
];

const inputEvents: WidgetEventSpec[] = [
  spec('input', 'onInput', 'value'),
  spec('change', 'onChange', 'value'),
  spec('compositionstart', 'onCompositionStart', 'compose'),
  spec('compositionend', 'onCompositionEnd', 'compose'),
];

const mediaEvents: WidgetEventSpec[] = [
  spec('load', 'onLoad', 'time'),
  spec('error', 'onError', 'time'),
];

const swiperEvents: WidgetEventSpec[] = [spec('change', 'onChange', 'index')];

export const PAGE_EVENT_SPECS: WidgetEventSpec[] = [
  spec('init', 'onInit', 'time'),
  spec('beforeload', 'onBeforeLoad', 'time'),
  spec('load', 'onLoad', 'time'),
  spec('beforeshow', 'onBeforeShow', 'time'),
  spec('show', 'onShow', 'time'),
  spec('beforeleave', 'onBeforeLeave', 'time'),
  spec('left', 'onLeft', 'time'),
  spec('touchstart', 'onTouchStart', 'point'),
  spec('touchmove', 'onTouchMove', 'point'),
  spec('touchend', 'onTouchEnd', 'point'),
];

function spec(name: string, handler: string, payload: WidgetEventPayload): WidgetEventSpec {
  return { name, handler, payload, params: [{ name: 'event', type: payloadTypeName(payload) }] };
}

function payloadTypeName(payload: WidgetEventPayload): string {
  switch (payload) {
    case 'point':
      return 'PointEvent';
    case 'value':
      return 'ValueEvent';
    case 'index':
      return 'IndexEvent';
    case 'compose':
      return 'ComposeEvent';
    case 'time':
      return 'TimeEvent';
  }
}

export function widgetEventSpecs(type: WidgetKind): WidgetEventSpec[] {
  switch (type) {
    case 'button':
      return [...touch, ...focusable];
    case 'input':
      return [...touch, ...focusable, ...inputEvents];
    case 'checkbox':
    case 'switch':
      return [...touch, spec('change', 'onChange', 'value')];
    case 'image':
      return [...touch, ...mediaEvents];
    case 'swiper':
      return [...touch, ...swiperEvents];
    default:
      return touch;
  }
}

export function widgetEventSpec(type: WidgetKind, name: string): WidgetEventSpec | undefined {
  return widgetEventSpecs(type).find((item) => item.name === name);
}

export function isWidgetEventId(value: string): boolean {
  return EVENT_ID.test(value);
}

export function compactEvents(specs: WidgetEventSpec[], events: WidgetEvents | undefined): WidgetEvents | undefined {
  if (!events) {
    return undefined;
  }
  const allowed = new Set(specs.map((item) => item.name));
  const next: WidgetEvents = {};
  const known = new Set<string>();
  for (const [name, ids] of Object.entries(events)) {
    if (name === 'order' || !allowed.has(name) || !ids) {
      continue;
    }
    const clean: string[] = [];
    for (const id of ids) {
      const trimmed = id.trim();
      if (!isWidgetEventId(trimmed) || clean.includes(trimmed)) {
        continue;
      }
      clean.push(trimmed);
      known.add(trimmed);
    }
    if (clean.length > 0) {
      next[name] = clean;
    }
  }
  const order = (events.order ?? []).map((id) => id.trim()).filter((id) => known.has(id));
  if (order.length > 0) {
    next.order = [...new Set(order)];
  }
  return Object.keys(next).some((name) => name !== 'order') ? next : undefined;
}

export function compactWidgetEvents(type: WidgetKind, events: WidgetEvents | undefined): WidgetEvents | undefined {
  return compactEvents(widgetEventSpecs(type), events);
}

export function compactPageEvents(events: WidgetEvents | undefined): WidgetEvents | undefined {
  return compactEvents(PAGE_EVENT_SPECS, events);
}

export function hasWidgetEvents(events: WidgetEvents | undefined): boolean {
  return Object.entries(events ?? {}).some(([name, ids]) => name !== 'order' && (ids?.length ?? 0) > 0);
}

export type WidgetEventRow = {
  name: string;
  id: string;
};

export function eventRows(specs: WidgetEventSpec[], events: WidgetEvents | undefined): WidgetEventRow[] {
  const compact = compactEvents(specs, events);
  if (!compact) {
    return [];
  }
  const byId = new Map<string, WidgetEventRow>();
  for (const item of specs) {
    for (const id of compact[item.name] ?? []) {
      byId.set(id, { name: item.name, id });
    }
  }
  const rows: WidgetEventRow[] = [];
  const seen = new Set<string>();
  for (const id of compact.order ?? []) {
    const row = byId.get(id);
    if (!row || seen.has(id)) {
      continue;
    }
    rows.push(row);
    seen.add(id);
  }
  for (const row of byId.values()) {
    if (!seen.has(row.id)) {
      rows.push(row);
    }
  }
  return rows;
}

export function widgetEventRows(type: WidgetKind, events: WidgetEvents | undefined): WidgetEventRow[] {
  return eventRows(widgetEventSpecs(type), events);
}

export function eventsFromSpecRows(specs: WidgetEventSpec[], rows: WidgetEventRow[]): WidgetEvents | undefined {
  const events: WidgetEvents = { order: rows.map((row) => row.id) };
  for (const row of rows) {
    events[row.name] = [...(events[row.name] ?? []), row.id];
  }
  return compactEvents(specs, events);
}

export function eventsFromRows(type: WidgetKind, rows: WidgetEventRow[]): WidgetEvents | undefined {
  return eventsFromSpecRows(widgetEventSpecs(type), rows);
}

export function reorderEvents(
  specs: WidgetEventSpec[],
  events: WidgetEvents | undefined,
  fromId: string,
  toId: string,
): WidgetEvents | undefined {
  const rows = eventRows(specs, events);
  const from = rows.findIndex((row) => row.id === fromId);
  const to = rows.findIndex((row) => row.id === toId);
  if (from < 0 || to < 0 || from === to) {
    return compactEvents(specs, events);
  }
  const next = rows.slice();
  const [item] = next.splice(from, 1);
  if (!item) {
    return compactEvents(specs, events);
  }
  next.splice(to, 0, item);
  return eventsFromSpecRows(specs, next);
}

export function reorderWidgetEvents(
  type: WidgetKind,
  events: WidgetEvents | undefined,
  fromId: string,
  toId: string,
): WidgetEvents | undefined {
  return reorderEvents(widgetEventSpecs(type), events, fromId, toId);
}

export function appendWidgetEvent(events: WidgetEvents | undefined, name: string, id: string): WidgetEvents {
  const prev = events?.[name] ?? [];
  if (prev.includes(id)) {
    return events ?? { [name]: prev };
  }
  const next: WidgetEvents = { ...events, [name]: [...prev, id] };
  if (events?.order && !events.order.includes(id)) {
    next.order = [...events.order, id];
  }
  return next;
}

export function removeWidgetEvent(
  events: WidgetEvents | undefined,
  name: string,
  id: string,
): WidgetEvents | undefined {
  if (!events?.[name]) {
    return compactLoose(events);
  }
  const next: WidgetEvents = { ...events, [name]: (events[name] ?? []).filter((item) => item !== id) };
  if (next[name]?.length === 0) {
    delete next[name];
  }
  if (next.order) {
    next.order = next.order.filter((item) => item !== id);
    if (next.order.length === 0) {
      delete next.order;
    }
  }
  return compactLoose(next);
}

function compactLoose(events: WidgetEvents | undefined): WidgetEvents | undefined {
  if (!events || !Object.keys(events).some((name) => name !== 'order')) {
    return undefined;
  }
  return events;
}

export function eventLabelKey(name: string): string {
  const camel = name.replace(/(^|-)([a-z])/g, (_match, _dash: string, char: string) => char.toUpperCase());
  return `lowcode.event${camel}`;
}

export function eventFunctionHeader(item: WidgetEventSpec): string {
  const params = item.params.map((param) => `${param.name}: ${param.type}`).join(', ');
  return `function ${item.handler}(${params}){`;
}

export function buildEventSource(item: WidgetEventSpec, description: string, body: string): string {
  const desc = description.replace(/\s+/g, ' ').replace(/\*\//g, '* /').trim();
  const trimmed = body.replace(/^\n+/, '').replace(/\s+$/, '');
  const inner = trimmed ? `\n${trimmed}\n` : '\n';
  const comment = desc ? `/** ${desc} */\n` : '';
  return `${comment}${eventFunctionHeader(item)}${inner}}`;
}

const EVENT_SOURCE =
  /^(?:\/\*\*\s*([\s\S]*?)\s*\*\/\s*)?function\s+[A-Za-z_$][\w$]*\s*\(([^)]*)\)\s*\{([\s\S]*)\}\s*$/;

export function parseEventSource(source: string): { description: string; body: string; paramNames: string[] } | null {
  const match = source.trim().match(EVENT_SOURCE);
  if (!match) {
    return null;
  }
  const paramNames = match[2]
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split(':')[0]?.trim() ?? '')
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
  let body = match[3] ?? '';
  if (body.startsWith('\n')) {
    body = body.slice(1);
  }
  if (body.endsWith('\n')) {
    body = body.slice(0, -1);
  }
  return {
    description: (match[1] ?? '').replace(/\s+/g, ' ').trim(),
    body,
    paramNames,
  };
}
